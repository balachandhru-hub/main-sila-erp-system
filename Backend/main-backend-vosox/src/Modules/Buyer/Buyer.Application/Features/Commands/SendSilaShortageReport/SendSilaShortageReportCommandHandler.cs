using System.Globalization;
using System.Net;
using System.Net.Mail;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SendSilaShortageReport
{
    /// <summary>
    /// Emails the shortage report summary (period, totals, SAP posting values) through the MasterData email service
    /// (email key SILA_SHORTAGE_REPORT). Nothing is attached: the recipients download the Excel from SILA ME.
    /// </summary>
    public class SendSilaShortageReportCommandHandler : IRequestHandler<SendSilaShortageReportCommand, SilaShortageReportSendResultDto>
    {
        public const string EMAIL_KEY = "SILA_SHORTAGE_REPORT";
        private const int MAX_RECIPIENTS = 10;
        private const int EMAIL_LENGTH = 254;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly IMetadataApiClient _metadataApiClient;

        public SendSilaShortageReportCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient, IMetadataApiClient metadataApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
            _metadataApiClient = metadataApiClient;
        }

        public async Task<SilaShortageReportSendResultDto> Handle(SendSilaShortageReportCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Sending shortage report. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            SilaShortageReportSendDto input = request.Request;
            List<string> recipients = Recipients(input);
            SilaInputRules.MaxLength(_logger, input.Subject, SilaInputRules.NAME_LENGTH, "subject");
            SilaInputRules.MaxLength(_logger, input.Message, SilaInputRules.DESCRIPTION_LENGTH, "message");

            (DateTime from, DateTime to) = SilaShortageReportRules.Period(_logger, input);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<SilaShortageLineDto> lines = await SilaShortageReportRules.LoadLinesAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, input, from, to, cancellationToken);
            SilaShortageTotalsDto totals = SilaShortageSummary.Totals(lines);
            string currency = await SilaCountContext.CurrencyAsync(
                _repository, buyer.Id, lines.Select(x => x.MaterialId).Distinct().ToList(), cancellationToken) ?? string.Empty;
            Dictionary<Guid, string> senders = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, new[] { request.UserId }, cancellationToken);

            string period = $"{from:dd MMM yyyy} - {to:dd MMM yyyy}";
            Dictionary<string, string> parameters = new Dictionary<string, string>
            {
                { "SUBJECT", string.IsNullOrWhiteSpace(input.Subject) ? $"Stock shortage report {period}" : input.Subject.Trim().ReplaceLineEndings(" ") },
                { "MESSAGE", Html(input.Message?.Trim() ?? string.Empty) },
                { "PERIOD", period },
                { "SENDER_NAME", Html(senders.GetValueOrDefault(request.UserId) ?? string.Empty) },
                { "LINES", totals.Lines.ToString(CultureInfo.InvariantCulture) },
                { "LOCATIONS", totals.Locations.ToString(CultureInfo.InvariantCulture) },
                { "MATERIALS", totals.Materials.ToString(CultureInfo.InvariantCulture) },
                { "CURRENCY", Html(currency) },
                { "SHORTAGE_VALUE", Money(totals.ShortageValue) },
                { "JUSTIFIED_VALUE", Money(totals.JustifiedValue) },
                { "UNRESOLVED_VALUE", Money(totals.UnresolvedValue) },
                { "APPROVED_VALUE", Money(totals.ApprovedValue) },
                { "POSTED_VALUE", Money(totals.PostedValue) },
                { "SAP_FAILED_VALUE", Money(totals.SapFailedValue) },
                { "SAP_PENDING_VALUE", Money(totals.SapPendingValue) }
            };

            int sent = 0;
            foreach (string email in recipients)
            {
                try
                {
                    await _metadataApiClient.SendEmailAsync(email, EMAIL_KEY, null, Common.SILA_REF_STOCK_COUNT, parameters, cancellationToken);
                    sent++;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    string? detail = (exception as BaseCustomException)?.Description;
                    _logger.LogError(
                        $"Shortage report email failed. Recipient: {recipients.IndexOf(email) + 1}/{recipients.Count}. Error: {SilaLogText.Short(exception.Message)}{(detail != null ? $" | {SilaLogText.Short(detail)}" : string.Empty)}");
                }
            }

            if (sent == 0)
            {
                _logger.LogError($"Shortage report email not sent to any recipient. Recipients: {recipients.Count}");
                throw new FailedDependencyCustomException(
                    "The report email could not be sent.",
                    "Email is not available right now. Download the Excel or PDF report and share it instead.");
            }

            _logger.LogInfo($"Shortage report sent. Lines: {totals.Lines}, Sent: {sent}, Recipients: {recipients.Count}");
            return new SilaShortageReportSendResultDto { Recipients = recipients.Count, Sent = sent };
        }

        /// <summary>To and Cc addresses: at least one To, at most 10 in all, each a valid address, duplicates removed.</summary>
        private List<string> Recipients(SilaShortageReportSendDto input)
        {
            List<string> all = (input.ToEmails ?? new List<string>())
                .Concat(input.CcEmails ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (input.ToEmails == null || !input.ToEmails.Any(x => !string.IsNullOrWhiteSpace(x)))
            {
                _logger.LogError("Shortage report send without a To address.");
                throw new BadRequestCustomException("Recipient is required.", "Enter at least one email address in To.");
            }

            if (all.Count > MAX_RECIPIENTS)
            {
                _logger.LogError($"Too many shortage report recipients. Count: {all.Count}");
                throw new BadRequestCustomException("Too many recipients.", $"Send the report to at most {MAX_RECIPIENTS} addresses.");
            }

            foreach (string email in all)
            {
                if (email.Length > EMAIL_LENGTH || !MailAddress.TryCreate(email, out MailAddress? address) || address.Address != email)
                {
                    _logger.LogError("Invalid shortage report recipient address.");
                    throw new BadRequestCustomException($"{email} is not a valid email address.", "Correct the address, e.g. name@company.com.");
                }
            }

            return all;
        }

        private static string Money(decimal value)
        {
            return value.ToString("N2", CultureInfo.InvariantCulture);
        }

        private static string Html(string value)
        {
            return WebUtility.HtmlEncode(value);
        }
    }
}

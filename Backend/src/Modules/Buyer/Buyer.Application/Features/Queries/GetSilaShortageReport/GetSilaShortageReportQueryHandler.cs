using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaShortageReport
{
    public class GetSilaShortageReportQueryHandler : IRequestHandler<GetSilaShortageReportQuery, SilaShortageReportDto>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaShortageReportQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaShortageReportDto> Handle(GetSilaShortageReportQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Fetching shortage report. OrganizationId: {request.OrganizationId}, From: {request.Filter.From:yyyy-MM-dd}, To: {request.Filter.To:yyyy-MM-dd}, LocationId: {request.Filter.LocationId}, Index: {request.Index}, Limit: {request.Limit}");

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, MAX_LIMIT);
            (DateTime from, DateTime to) = SilaShortageReportRules.Period(_logger, request.Filter);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<SilaShortageLineDto> lines = await SilaShortageReportRules.LoadLinesAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.Filter, from, to, cancellationToken, _identityApiClient);

            SilaShortageReportDto result = new SilaShortageReportDto
            {
                From = from,
                To = to,
                Totals = SilaShortageSummary.Totals(lines),
                ByLocation = SilaShortageSummary.ByLocation(lines),
                ByReason = SilaShortageSummary.ByReason(lines),
                TotalLines = lines.Count,
                Lines = lines.Skip(index).Take(limit).ToList()
            };

            result.Totals.Currency = await SilaCountContext.CurrencyAsync(
                _repository, buyer.Id, lines.Select(x => x.MaterialId).Distinct().ToList(), cancellationToken);

            _logger.LogInfo($"Shortage report fetched. BuyerId: {buyer.Id}, Lines: {lines.Count}, Returned: {result.Lines.Count}");
            return result;
        }
    }
}

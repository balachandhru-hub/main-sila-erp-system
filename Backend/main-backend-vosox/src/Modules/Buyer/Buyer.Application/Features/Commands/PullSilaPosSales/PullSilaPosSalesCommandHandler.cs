using System.Text.Json;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PullSilaPosSales
{
    /// <summary>
    /// Pulls the sold lines from the POS sales API configured under Integration (target fields PosSale.*), stores the
    /// new lines as an API batch and processes them like an uploaded file.
    /// </summary>
    public class PullSilaPosSalesCommandHandler : IRequestHandler<PullSilaPosSalesCommand, SilaPosImportResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IIntegrationHttpExecutor _executor;
        private readonly ILoggerManager _logger;

        public PullSilaPosSalesCommandHandler(
            IRepositoryWrapper repository,
            IMediator mediator,
            IIntegrationHttpExecutor executor,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _executor = executor;
            _logger = logger;
        }

        public Task<SilaPosImportResultDto> Handle(PullSilaPosSalesCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunForJobAsync(_repository, _logger, nameof(PullSilaPosSalesCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPosImportResultDto> HandleOnceAsync(PullSilaPosSalesCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Pulling POS sales. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = request.OrganizationId,
                ProcessType = IntegrationProcessType.GET_POS_SALE
            }, cancellationToken);
            ApiIntegrationConfiguration? configuration = api.Configured && api.ConfigurationId != null
                ? await _repository.ApiIntegrationConfiguration
                    .FindByCondition(x => x.Id == api.ConfigurationId.Value && x.OrganizationId == request.OrganizationId)
                    .FirstOrDefaultAsync(cancellationToken)
                : null;
            if (configuration == null)
            {
                _logger.LogError($"No active POS sales API. OrganizationId: {request.OrganizationId}");
                throw new BadRequestCustomException("POS sales API is not configured.", "Configure and activate the POS sales API under Integration first.");
            }

            List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == configuration.Id)
                .ToListAsync(cancellationToken);
            List<JsonElement> records;
            try
            {
                records = await _executor.PullRecordsAsync(configuration, false, cancellationToken);
            }
            catch (IntegrationException exception)
            {
                _logger.LogError($"POS sales API call failed. ConfigurationId: {configuration.Id}, Code: {exception.Code}, Error: {SilaLogText.Short(exception.Message)}");
                throw new FailedDependencyCustomException("The POS sales API call failed.", exception.Message);
            }

            PosSource? source = await SilaPosSources.ResolveAsync(_repository, _logger, buyer.Id, null, SilaPosSources.KIND_API, cancellationToken);
            SilaPosImportResultDto result = new SilaPosImportResultDto();
            List<SilaPosSaleRowDto> rows = new List<SilaPosSaleRowDto>();
            int position = 0;
            foreach (JsonElement record in records)
            {
                position++;
                result.Rows++;
                SilaPosSaleRowDto? row = SilaPosRows.Read(new SilaPosRawRow
                {
                    RowNumber = position,
                    BusinessDate = IntegrationRecordReader.Read(mappings, "PosSale.BusinessDate", record),
                    TransactionId = IntegrationRecordReader.Read(mappings, "PosSale.TransactionId", record),
                    LineId = IntegrationRecordReader.Read(mappings, "PosSale.LineId", record),
                    PosCode = IntegrationRecordReader.Read(mappings, "PosSale.PosCode", record),
                    Quantity = IntegrationRecordReader.Read(mappings, "PosSale.Quantity", record),
                    Uom = IntegrationRecordReader.Read(mappings, "PosSale.Uom", record),
                    OutletCode = IntegrationRecordReader.Read(mappings, "PosSale.OutletCode", record),
                    Currency = IntegrationRecordReader.Read(mappings, "PosSale.Currency", record),
                    Amount = IntegrationRecordReader.Read(mappings, "PosSale.Amount", record)
                }, result.Errors, out string? _);
                if (row == null)
                {
                    result.Invalid++;
                    continue;
                }

                rows.Add(row);
            }

            // The API pull stays one step: receive and process at once.
            SilaPosReceipt receipt = await SilaPosProcessing.ReceiveAsync(
                _repository, buyer.Id, request.UserId, Common.SILA_POS_SOURCE_API, source?.Id, configuration.Name,
                Common.SILA_POS_BATCH_PROCESSED, rows, result.Rows, result.Invalid, cancellationToken);
            result.BatchId = receipt.Batch.Id;
            result.BatchNumber = receipt.Batch.BatchNumber;
            result.Accepted = receipt.Transactions.Count;
            result.Duplicates = receipt.DuplicateRows.Count;
            result.Failed = await SilaPosProcessing.ProcessAsync(_repository, _logger, buyer.Id, request.UserId, receipt.Transactions, cancellationToken);
            result.Processed = receipt.Transactions.Count - result.Failed;
            await _repository.SaveAsync();

            _logger.LogInfo(
                $"POS sales pulled. BatchNumber: {result.BatchNumber}, Records: {result.Rows}, Accepted: {result.Accepted}, Duplicates: {result.Duplicates}, Invalid: {result.Invalid}, Failed: {result.Failed}");
            return result;
        }
    }
}

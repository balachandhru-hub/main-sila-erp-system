using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceExtractions
{
    public class GetSilaInvoiceExtractionsQueryHandler : IRequestHandler<GetSilaInvoiceExtractionsQuery, List<SilaInvoiceExtractionDto>>
    {
        // Readings kept on screen; an invoice is rarely read more often.
        private const int LIMIT = 50;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoiceExtractionsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaInvoiceExtractionDto>> Handle(GetSilaInvoiceExtractionsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoice extraction history. InvoiceId: {request.InvoiceId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            List<InvoiceExtraction> extractions = await _repository.InvoiceExtraction
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderByDescending(x => x.Attempt)
                .Take(LIMIT)
                .ToListAsync(cancellationToken);

            List<SilaInvoiceExtractionDto> result = extractions.Select(extraction =>
            {
                SilaInvoiceOcrResultDto? reading = SilaOcrSettings.ReadReading(extraction.FieldsJson);
                return new SilaInvoiceExtractionDto
                {
                    Id = extraction.Id,
                    Attempt = extraction.Attempt,
                    Trigger = extraction.Trigger,
                    Method = extraction.Method,
                    Status = extraction.Status,
                    Confidence = extraction.Confidence,
                    Message = extraction.Message,
                    Fields = reading?.Fields,
                    LineCount = reading?.Lines?.Count ?? 0,
                    CreatedBy = extraction.CreatedBy == Guid.Empty ? null : extraction.CreatedBy,
                    CreatedOn = extraction.DateCreated,
                    Provider = extraction.Provider,
                    DurationMs = extraction.DurationMs,
                    ContentHash = extraction.ContentHash
                };
            }).ToList();

            _logger.LogInfo($"Invoice extraction history fetched. InvoiceId: {invoice.Id}, Count: {result.Count}");
            return result;
        }
    }
}

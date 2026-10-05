using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceSupplierCandidates
{
    /// <summary>
    /// Candidates by the supplier name (the search text, else the invoice's supplier name) and by the tax number the last
    /// reading found.
    /// </summary>
    public class GetSilaInvoiceSupplierCandidatesQueryHandler : IRequestHandler<GetSilaInvoiceSupplierCandidatesQuery, List<SilaInvoiceSupplierCandidateDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoiceSupplierCandidatesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaInvoiceSupplierCandidateDto>> Handle(GetSilaInvoiceSupplierCandidatesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoice supplier candidates. InvoiceId: {request.InvoiceId}, Search: {request.Search}");
            SilaInputRules.MaxLength(_logger, request.Search, SilaInputRules.NAME_LENGTH, "Search");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            string? name = string.IsNullOrWhiteSpace(request.Search) ? invoice.SupplierName : request.Search.Trim();

            string? fieldsJson = await _repository.InvoiceExtraction
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && x.Status == SilaOcrSettings.EXTRACTION_COMPLETED)
                .OrderByDescending(x => x.Attempt)
                .Select(x => x.FieldsJson)
                .FirstOrDefaultAsync(cancellationToken);
            string? taxNumber = string.IsNullOrWhiteSpace(request.Search) ? SilaOcrSettings.ReadReading(fieldsJson)?.Fields?.SupplierTaxNumber : null;

            List<SilaInvoiceSupplierCandidateDto> result = await SilaInvoiceMatching.CandidatesAsync(_repository, buyer.Id, name, taxNumber, cancellationToken);
            _logger.LogInfo($"Invoice supplier candidates fetched. InvoiceId: {invoice.Id}, Count: {result.Count}");
            return result;
        }
    }
}

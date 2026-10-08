using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.ExportSilaMaterials
{
    public class ExportSilaMaterialsQueryHandler : IRequestHandler<ExportSilaMaterialsQuery, byte[]>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ExportSilaMaterialsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<byte[]> Handle(ExportSilaMaterialsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Exporting materials. OrganizationId: {request.OrganizationId}, TemplateOnly: {request.TemplateOnly}, Search: {request.Search}, PriceStatus: {request.PriceStatus}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            if (request.TemplateOnly)
            {
                byte[] template = SilaMaterialExcel.Build(new List<MaterialEntity>(), new Dictionary<Guid, List<MaterialUomConversion>>());
                _logger.LogInfo($"Material template built. BuyerId: {buyer.Id}");
                return template;
            }

            string? priceStatus = string.IsNullOrWhiteSpace(request.PriceStatus) ? null : request.PriceStatus.Trim().ToUpperInvariant();
            if (priceStatus != null && !SilaMaterialRules.PriceStatuses.Contains(priceStatus))
            {
                _logger.LogError($"Unknown price status filter. PriceStatus: {request.PriceStatus}");
                throw new BadRequestCustomException("Unknown price status.", "Filter by APPROVED, MISSING or PENDING_APPROVAL.");
            }

            IQueryable<MaterialEntity> query = _repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (request.InventoryOnly)
            {
                query = query.Where(x => x.IsInventoryItem);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string term = request.Search.Trim();
                query = query.Where(x =>
                    (x.MaterialCode != null && x.MaterialCode.Contains(term)) ||
                    (x.Description != null && x.Description.Contains(term)) ||
                    (x.Barcode != null && x.Barcode == term));
            }

            query = SilaMaterialRules.FilterByPriceStatus(query, _repository, buyer.Id, priceStatus);
            int total = await query.CountAsync(cancellationToken);
            if (total > SilaMaterialExcel.MAX_ROWS)
            {
                _logger.LogError($"Material export too large. Rows: {total}, BuyerId: {buyer.Id}");
                throw new BadRequestCustomException(
                    "Too many materials to export.",
                    $"Narrow the search or the price status filter to at most {SilaMaterialExcel.MAX_ROWS} materials.");
            }

            List<MaterialEntity> materials = await query.OrderBy(x => x.MaterialCode).ToListAsync(cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Select(x => x.Id), cancellationToken);
            byte[] file = SilaMaterialExcel.Build(materials, conversions);

            _logger.LogInfo($"Materials exported. Rows: {materials.Count}, BuyerId: {buyer.Id}");
            return file;
        }
    }
}

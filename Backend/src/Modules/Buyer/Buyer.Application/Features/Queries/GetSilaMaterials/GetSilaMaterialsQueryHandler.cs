using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaMaterials
{
    public class GetSilaMaterialsQueryHandler : IRequestHandler<GetSilaMaterialsQuery, List<SilaMaterialDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaMaterialsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaMaterialDto>> Handle(GetSilaMaterialsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory materials. OrganizationId: {request.OrganizationId}, Search: {request.Search}, PriceStatus: {request.PriceStatus}, Index: {request.Index}, Limit: {request.Limit}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string? priceStatus = string.IsNullOrWhiteSpace(request.PriceStatus) ? null : request.PriceStatus.Trim().ToUpperInvariant();
            if (priceStatus != null && !SilaMaterialRules.PriceStatuses.Contains(priceStatus))
            {
                _logger.LogError($"Unknown price status filter. PriceStatus: {request.PriceStatus}");
                throw new BadRequestCustomException("Unknown price status.", "Filter by APPROVED, MISSING or PENDING_APPROVAL.");
            }

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 50 : Math.Min(request.Limit, 200);
            SilaInputRules.MaxLength(_logger, request.Search, SilaInputRules.NAME_LENGTH, "Search");
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

            List<MaterialEntity> materials = await query
                .OrderBy(x => x.MaterialCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid> ids = materials.Select(x => x.Id).ToList();
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, ids, cancellationToken);
            Dictionary<Guid, MaterialPriceChange> pending = await SilaMaterialRules.GetPendingChangesAsync(_repository, buyer.Id, ids, cancellationToken);

            List<SilaMaterialDto> result = materials.Select(x => SilaMaterialRules.ToDto(
                x,
                conversions.TryGetValue(x.Id, out List<MaterialUomConversion>? list) ? list : null,
                pending.TryGetValue(x.Id, out MaterialPriceChange? change) ? change : null)).ToList();
            await SilaMaterialRules.ApplyApprovedPricesAsync(_repository, buyer.Id, result, cancellationToken);

            _logger.LogInfo($"Inventory materials fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}

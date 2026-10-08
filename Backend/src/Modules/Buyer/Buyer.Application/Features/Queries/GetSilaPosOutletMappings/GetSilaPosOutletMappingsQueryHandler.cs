using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosOutletMappings
{
    /// <summary>Outlet mappings of a POS source with the mapped location, its property, SAP plant and storage location.</summary>
    public class GetSilaPosOutletMappingsQueryHandler : IRequestHandler<GetSilaPosOutletMappingsQuery, SilaPosPageDto<SilaPosOutletMappingDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosOutletMappingsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosPageDto<SilaPosOutletMappingDto>> Handle(GetSilaPosOutletMappingsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS outlet mappings. OrganizationId: {request.OrganizationId}, SourceId: {request.SourceId}, Search: {request.Search}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            Guid buyerId = buyer.Id;
            IQueryable<PosOutletMapping> query = _repository.PosOutletMapping.FindByCondition(x => x.PosSourceId == source.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                IQueryable<Guid> locationIds = _repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && (x.LocationCode.Contains(search) || x.LocationName.Contains(search)))
                    .Select(x => x.Id);
                query = query.Where(x => x.PosOutletCode.Contains(search)
                    || (x.PosOutletName != null && x.PosOutletName.Contains(search))
                    || locationIds.Contains(x.OutletLocationId));
            }

            int limit = SilaPosSources.Limit(request.Limit);
            int index = Math.Max(0, request.Index);
            int total = await query.CountAsync(cancellationToken);
            List<PosOutletMapping> page = await query
                .OrderBy(x => x.PosOutletCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, (InventoryLocation Location, BuyerProperty? Property)> locations = await SilaPosSources.GetOutletLocationsAsync(
                _repository, buyerId, page.Select(x => x.OutletLocationId).ToList(), cancellationToken);

            SilaPosPageDto<SilaPosOutletMappingDto> result = new SilaPosPageDto<SilaPosOutletMappingDto>
            {
                Items = page.Select(x => SilaPosSources.ToDto(x, locations)).ToList(),
                Total = total,
                Index = index,
                Limit = limit
            };

            _logger.LogInfo($"POS outlet mappings fetched. Total: {total}, Page: {result.Items.Count}");
            return result;
        }
    }
}

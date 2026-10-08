using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaUoms
{
    /// <summary>
    /// Distinct units (upper case, sorted) from the active Item Master (base, order and alternate units), the material unit
    /// conversions and the serving defaults EA, PORTION, GLASS, SCOOP and SLICE. Used by the serving UOM select.
    /// </summary>
    public class GetSilaUomsQueryHandler : IRequestHandler<GetSilaUomsQuery, List<string>>
    {
        private const int MAX_UOM_LENGTH = 20;
        private static readonly string[] SERVING_DEFAULTS = { "EA", "PORTION", "GLASS", "SCOOP", "SLICE" };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaUomsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<string>> Handle(GetSilaUomsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching units of measure. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IQueryable<MaterialEntity> materials = _repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            List<string> baseUoms = await materials.Select(x => x.BaseUnitOfMeasure).Distinct().ToListAsync(cancellationToken);
            List<string> orderUoms = await materials.Select(x => x.OrderUnitOfMeasure).Distinct().ToListAsync(cancellationToken);
            List<string> alternateUoms = await materials.Select(x => x.AlternateUnitOfMeasure).Distinct().ToListAsync(cancellationToken);
            List<string> fromUoms = await _repository.MaterialUomConversion
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                .Select(x => x.FromUom)
                .Distinct()
                .ToListAsync(cancellationToken);
            List<string> toUoms = await _repository.MaterialUomConversion
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                .Select(x => x.ToUom)
                .Distinct()
                .ToListAsync(cancellationToken);

            List<string> result = baseUoms.Concat(orderUoms).Concat(alternateUoms).Concat(fromUoms).Concat(toUoms).Concat(SERVING_DEFAULTS)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToUpperInvariant())
                .Where(x => x.Length <= MAX_UOM_LENGTH)
                .Distinct()
                .OrderBy(x => x)
                .ToList();

            _logger.LogInfo($"Units of measure fetched. Count: {result.Count}");
            return result;
        }
    }
}

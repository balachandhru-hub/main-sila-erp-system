using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInventoryTransactions
{
    /// <summary>The inventory ledger of the caller's locations, newest first.</summary>
    public class GetSilaInventoryTransactionsQueryHandler : IRequestHandler<GetSilaInventoryTransactionsQuery, List<SilaInventoryTransactionDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInventoryTransactionsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaInventoryTransactionDto>> Handle(GetSilaInventoryTransactionsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory transactions. OrganizationId: {request.OrganizationId}, LocationId: {request.LocationId}, MaterialId: {request.MaterialId}, Type: {request.TransactionType}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit);
            SilaInputRules.MaxLength(_logger, request.TransactionType, SilaInputRules.CODE_LENGTH, "Transaction type");
            SilaInputRules.SaneDate(_logger, request.FromDate, "from date", 25, 1);
            SilaInputRules.SaneDate(_logger, request.ToDate, "to date", 25, 1);
            if (request.FromDate != null && request.ToDate != null && request.FromDate.Value.Date > request.ToDate.Value.Date)
            {
                _logger.LogError($"Transaction period is reversed. From: {request.FromDate:yyyy-MM-dd}, To: {request.ToDate:yyyy-MM-dd}");
                throw new BadRequestCustomException("Period is not valid.", "The from date must be on or before the to date.");
            }

            IQueryable<InventoryTransaction> query = _repository.InventoryTransaction.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (request.LocationId != null && request.LocationId != Guid.Empty)
            {
                Guid locationId = request.LocationId.Value;
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, locationId, cancellationToken);
                query = query.Where(x => x.LocationId == locationId);
            }
            else if (!SilaAccess.HasFullAccess(request.RoleId))
            {
                List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
                query = query.Where(x => locationIds.Contains(x.LocationId));
            }

            if (request.MaterialId != null && request.MaterialId != Guid.Empty)
            {
                Guid materialId = request.MaterialId.Value;
                query = query.Where(x => x.MaterialId == materialId);
            }

            if (!string.IsNullOrWhiteSpace(request.TransactionType))
            {
                string transactionType = request.TransactionType.Trim().ToUpperInvariant();
                query = query.Where(x => x.TransactionType == transactionType);
            }

            if (request.FromDate != null)
            {
                DateTime from = request.FromDate.Value.Date;
                query = query.Where(x => x.BusinessDate >= from);
            }

            if (request.ToDate != null)
            {
                DateTime toExclusive = request.ToDate.Value.Date.AddDays(1);
                query = query.Where(x => x.BusinessDate < toExclusive);
            }

            List<InventoryTransaction> rows = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.TransactionNumber)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            List<Guid> rowLocationIds = rows.Select(x => x.LocationId).Distinct().ToList();
            List<Guid> rowMaterialIds = rows.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && rowLocationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, MaterialEntity> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && rowMaterialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            List<SilaInventoryTransactionDto> result = rows.Select(x => new SilaInventoryTransactionDto
            {
                Id = x.Id,
                TransactionNumber = x.TransactionNumber,
                TransactionType = x.TransactionType,
                Direction = x.Direction,
                LocationId = x.LocationId,
                LocationCode = locations.TryGetValue(x.LocationId, out InventoryLocation? location) ? location.LocationCode : null,
                LocationName = location?.LocationName,
                MaterialId = x.MaterialId,
                MaterialCode = materials.TryGetValue(x.MaterialId, out MaterialEntity? material) ? material.MaterialCode : null,
                MaterialDescription = material?.Description,
                Quantity = x.Quantity,
                BaseUom = x.BaseUom,
                EnteredQuantity = x.EnteredQuantity,
                EnteredUom = x.EnteredUom,
                UnitCost = x.UnitCost,
                Value = x.Value,
                ReferenceType = x.ReferenceType,
                ReferenceId = x.ReferenceId,
                ReferenceNumber = x.ReferenceNumber,
                Reason = x.Reason,
                BusinessDate = x.BusinessDate,
                DateCreated = x.DateCreated
            }).ToList();

            _logger.LogInfo($"Inventory transactions fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}

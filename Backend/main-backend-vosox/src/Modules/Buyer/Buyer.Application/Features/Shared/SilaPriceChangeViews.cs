using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Builds the price change rows of the approval inbox and the price history, with batch lookups only.</summary>
    public static class SilaPriceChangeViews
    {
        public static async Task<List<SilaMaterialPriceChangeDto>> ToDtosAsync(
            IRepositoryWrapper repository,
            IIdentityApiClient identityApiClient,
            List<MaterialPriceChange> changes,
            CancellationToken cancellationToken)
        {
            if (changes.Count == 0)
            {
                return new List<SilaMaterialPriceChangeDto>();
            }

            List<Guid> changeIds = changes.Select(x => x.Id).ToList();
            List<Guid> materialIds = changes.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<SilaApprovalStep> steps = await repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_MATERIAL_PRICE && changeIds.Contains(x.ReferenceId) && x.IsActive)
                .OrderBy(x => x.Order)
                .ToListAsync(cancellationToken);

            List<Guid> userIds = steps.Select(x => x.UserId)
                .Concat(changes.Select(x => x.RequestedBy))
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToList();
            List<IdentityUserDto> users = userIds.Count == 0
                ? new List<IdentityUserDto>()
                : await identityApiClient.GetUsersByIds(userIds, cancellationToken);
            Dictionary<Guid, string> names = users
                .GroupBy(x => x.UserId)
                .ToDictionary(x => x.Key, x => x.First().Name);

            return changes.Select(change =>
            {
                ItemBuyerMaster? material = materials.TryGetValue(change.MaterialId, out ItemBuyerMaster? found) ? found : null;
                List<SilaApprovalStep> own = steps.Where(x => x.ReferenceId == change.Id).ToList();
                return new SilaMaterialPriceChangeDto
                {
                    Id = change.Id,
                    RequestNumber = change.RequestNumber,
                    MaterialId = change.MaterialId,
                    MaterialCode = material?.MaterialCode ?? string.Empty,
                    Description = material?.Description ?? string.Empty,
                    BaseUom = material == null ? string.Empty : UomConverter.BaseUomOf(material),
                    CurrentUnitCost = change.CurrentUnitCost,
                    ProposedUnitCost = change.ProposedUnitCost,
                    Currency = change.Currency,
                    PriceUom = change.PriceUom,
                    EffectiveFrom = change.EffectiveFrom,
                    Reason = change.Reason,
                    Status = change.Status,
                    RequestedBy = change.RequestedBy,
                    RequestedByName = names.TryGetValue(change.RequestedBy, out string? requester) ? requester : null,
                    RequestedOn = change.DateCreated,
                    DecidedOn = change.DecidedOn,
                    CurrentLevel = own.FirstOrDefault(x => x.Status == Common.SILA_APPROVAL_PENDING)?.Order,
                    Steps = own.Select(x => new SilaPriceApprovalStepDto
                    {
                        UserId = x.UserId,
                        Name = names.TryGetValue(x.UserId, out string? approver) ? approver : null,
                        Order = x.Order,
                        Status = x.Status,
                        Comment = x.Comment,
                        ActedOn = x.ActedOn
                    }).ToList()
                };
            }).ToList();
        }
    }
}

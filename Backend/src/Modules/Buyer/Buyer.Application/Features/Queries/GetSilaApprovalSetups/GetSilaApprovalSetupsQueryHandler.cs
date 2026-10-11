using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using FlowEntity = Buyer.Domain.Entities.MasterApprovalFlow;
using FlowUserEntity = Buyer.Domain.Entities.ApprovalFlowUserMapping;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaApprovalSetups
{
    /// <summary>
    /// Active approval flows grouped into inventory, menu engineering, recipe, material and every other type, with create,
    /// change and deactivation called out. Recipe create and change share the RECIPE flow. Deactivation does not use one.
    /// </summary>
    public class GetSilaApprovalSetupsQueryHandler : IRequestHandler<GetSilaApprovalSetupsQuery, List<SilaApprovalSetupDto>>
    {
        private const int MAX_FLOWS = 200;
        private const string CONFIGURED = "CONFIGURED";
        private const string NOT_CONFIGURED = "NOT_CONFIGURED";
        private const string IMMEDIATE = "IMMEDIATE";
        private const string MATERIAL_CREATE = "MATERIAL_CREATE";

        /// <summary>Approval type null means the action does not wait for a flow.</summary>
        private static readonly (string Area, string Action, string? Type, string Note)[] Catalog =
        {
            ("Inventory", "Stock count", Common.SILA_APPROVAL_TYPE_INVENTORY, "A submitted stock count. The buyer administrator can approve any level."),
            ("Inventory", "Internal transfer", Common.SILA_APPROVAL_TYPE_ITO, "A transfer waiting for approval. The buyer administrator can approve any level."),
            ("Menu engineering", "Create", Common.SILA_APPROVAL_TYPE_RECIPE, "A new menu recipe uses the RECIPE flow. The buyer administrator can approve any level."),
            ("Menu engineering", "Change", Common.SILA_APPROVAL_TYPE_RECIPE, "A new version of a menu recipe uses the RECIPE flow."),
            ("Menu engineering", "Deactivation", null, "Deactivating a recipe does not wait for approval."),
            ("Recipe", "Create", Common.SILA_APPROVAL_TYPE_RECIPE, "A new recipe uses the RECIPE flow. The buyer administrator can approve any level."),
            ("Recipe", "Change", Common.SILA_APPROVAL_TYPE_RECIPE, "A change of an approved recipe uses the RECIPE flow."),
            ("Recipe", "Deactivation", null, "Deactivating a recipe does not wait for approval."),
            ("Material", "Create", MATERIAL_CREATE, "A new material master, when that flow exists."),
            ("Material", "Change", Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE, "A material price change. The buyer administrator can approve any level."),
            ("Material", "Deactivation", null, "Deactivating a material does not wait for approval.")
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaApprovalSetupsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaApprovalSetupDto>> Handle(GetSilaApprovalSetupsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching approval setups. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<FlowEntity> flows = await _repository.MasterApprovalFlow
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Type != null && x.Type != "")
                .OrderByDescending(x => x.DateCreated)
                .Take(MAX_FLOWS)
                .ToListAsync(cancellationToken);
            List<Guid> flowIds = flows.Select(x => x.Id).ToList();
            List<FlowUserEntity> levels = flowIds.Count == 0
                ? new List<FlowUserEntity>()
                : await _repository.ApprovalFlowUserMapping
                    .FindByCondition(x => flowIds.Contains(x.ApprovalFlowId) && x.IsActive)
                    .ToListAsync(cancellationToken);
            Dictionary<Guid, IdentityUserDto> users = await UserNamesAsync(levels.Select(x => x.UserId), cancellationToken);
            Dictionary<string, List<SilaApprovalWorkflowDto>> byType = flows
                .GroupBy(x => x.Type.Trim().ToUpperInvariant())
                .ToDictionary(
                    x => x.Key,
                    x => x.Select(flow => ToWorkflow(flow, levels, users)).ToList());

            List<SilaApprovalSetupDto> result = Catalog
                .GroupBy(x => x.Area)
                .Select(area => new SilaApprovalSetupDto
                {
                    Area = area.Key,
                    Actions = area.Select(row => ActionOf(row.Action, row.Type, row.Note, byType)).ToList()
                })
                .ToList();

            HashSet<string> known = Catalog.Where(x => x.Type != null).Select(x => x.Type!).ToHashSet();
            List<SilaApprovalSetupActionDto> others = byType
                .Where(x => !known.Contains(x.Key))
                .OrderBy(x => x.Key)
                .Select(x => ActionOf(Label(x.Key), x.Key, "Another function that uses this approval type.", byType))
                .ToList();
            if (others.Count > 0)
            {
                result.Add(new SilaApprovalSetupDto { Area = "Other functions", Actions = others });
            }

            _logger.LogInfo($"Approval setups fetched. Areas: {result.Count}, Flows: {flows.Count}");
            return result;
        }

        private static SilaApprovalSetupActionDto ActionOf(
            string action, string? type, string note, Dictionary<string, List<SilaApprovalWorkflowDto>> byType)
        {
            List<SilaApprovalWorkflowDto> matched = type != null && byType.TryGetValue(type, out List<SilaApprovalWorkflowDto>? rows)
                ? rows
                : new List<SilaApprovalWorkflowDto>();
            return new SilaApprovalSetupActionDto
            {
                Action = action,
                ApprovalType = type,
                Status = type == null ? IMMEDIATE : matched.Count == 0 ? NOT_CONFIGURED : CONFIGURED,
                Note = note,
                Flows = matched
            };
        }

        private static SilaApprovalWorkflowDto ToWorkflow(
            FlowEntity flow, List<FlowUserEntity> levels, Dictionary<Guid, IdentityUserDto> users)
        {
            List<FlowUserEntity> own = levels.Where(x => x.ApprovalFlowId == flow.Id).OrderBy(x => x.Order).ToList();
            return new SilaApprovalWorkflowDto
            {
                Id = flow.Id,
                Code = flow.ApprovalCode,
                Name = flow.ApprovalName,
                ScopeKind = string.IsNullOrWhiteSpace(flow.ScopeKind) ? Common.SILA_SCOPE_ALL : flow.ScopeKind,
                ScopeId = flow.ScopeId,
                ScopeCode = flow.ScopeCode,
                LevelCount = own.Count,
                Levels = own.Select((x, index) =>
                {
                    users.TryGetValue(x.UserId, out IdentityUserDto? user);
                    return new SilaApprovalWorkflowLevelDto
                    {
                        Level = index + 1,
                        UserId = x.UserId,
                        Name = user?.Name,
                        RoleName = user?.RoleName
                    };
                }).ToList()
            };
        }

        private async Task<Dictionary<Guid, IdentityUserDto>> UserNamesAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = userIds.Where(x => x != Guid.Empty).Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, IdentityUserDto>();
            }

            try
            {
                List<IdentityUserDto> users = await _identityApiClient.GetUsersByIds(ids, cancellationToken);
                return users.GroupBy(x => x.UserId).ToDictionary(x => x.Key, x => x.First());
            }
            catch (Exception exception)
            {
                _logger.LogError($"Approval setup names could not be loaded. Users: {ids.Count}, Error: {SilaLogText.Short(exception.Message)}");
                return new Dictionary<Guid, IdentityUserDto>();
            }
        }

        private static string Label(string code)
        {
            string text = code.Replace('_', ' ').ToLowerInvariant();
            return char.ToUpperInvariant(text[0]) + text.Substring(1);
        }
    }
}

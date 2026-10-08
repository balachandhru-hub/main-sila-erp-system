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

namespace Buyer.Application.Features.Queries.GetSilaRecipeWorkflows
{
    /// <summary>
    /// The active RECIPE approval flows (newest first, as the approval engine resolves them) with their levels: the approver
    /// of each level with name and role. Flows, levels and users are loaded in three lookups.
    /// </summary>
    public class GetSilaRecipeWorkflowsQueryHandler : IRequestHandler<GetSilaRecipeWorkflowsQuery, List<SilaApprovalWorkflowDto>>
    {
        private const int MAX_FLOWS = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaRecipeWorkflowsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaApprovalWorkflowDto>> Handle(GetSilaRecipeWorkflowsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipe approval workflows. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string type = Common.SILA_APPROVAL_TYPE_RECIPE;
            List<FlowEntity> flows = await _repository.MasterApprovalFlow
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Type != null && x.Type.ToUpper() == type)
                .OrderByDescending(x => x.DateCreated)
                .Take(MAX_FLOWS)
                .ToListAsync(cancellationToken);
            List<Guid> flowIds = flows.Select(x => x.Id).ToList();
            List<FlowUserEntity> levels = flowIds.Count == 0
                ? new List<FlowUserEntity>()
                : await _repository.ApprovalFlowUserMapping
                    .FindByCondition(x => flowIds.Contains(x.ApprovalFlowId) && x.IsActive)
                    .ToListAsync(cancellationToken);
            List<Guid> userIds = levels.Select(x => x.UserId).Distinct().ToList();
            List<IdentityUserDto> users = userIds.Count == 0 ? new List<IdentityUserDto>() : await _identityApiClient.GetUsersByIds(userIds, cancellationToken);

            List<SilaApprovalWorkflowDto> result = flows.Select(flow =>
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
                    Levels = own.Select((x, index) => new SilaApprovalWorkflowLevelDto
                    {
                        Level = index + 1,
                        UserId = x.UserId,
                        Name = users.FirstOrDefault(u => u.UserId == x.UserId)?.Name,
                        RoleName = users.FirstOrDefault(u => u.UserId == x.UserId)?.RoleName
                    }).ToList()
                };
            }).ToList();

            _logger.LogInfo($"Recipe approval workflows fetched. Count: {result.Count}");
            return result;
        }
    }
}

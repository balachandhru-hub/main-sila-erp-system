using Contracts.IRepository;
using Identity.Domain.Common;
using Identity.Domain.Dto;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Identity.Application.Features.Queries.GetAssignableRoles
{
    public class GetAssignableRolesQueryHandler
        : IRequestHandler<GetAssignableRolesQuery, List<RoleDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetAssignableRolesQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<List<RoleDto>> Handle(
            GetAssignableRolesQuery request,
            CancellationToken cancellationToken)
        {
            if (!Guid.TryParse(request.LoggedInRole, out Guid loggedInRoleId))
            {
                _logger.LogError($"LoggedInRole {request.LoggedInRole} is not a role id.");
                throw new BadRequestCustomException("Invalid LoggedInRole.", "The signed-in role is not valid.");
            }

            string? loggedInRole = _repository.Role
                .FindByConditionAsync(x => x.IsActive && x.Id == loggedInRoleId)
                .Select(x => x.UserRole)
                .FirstOrDefault();
            if (string.IsNullOrEmpty(loggedInRole))
            {
                _logger.LogError($"LoggedInRoleId {loggedInRoleId} does not match an active role.");
                throw new BadRequestCustomException("Invalid LoggedInRole.", "The provided role does not correspond to any active role.");
            }

            // Same roles each role may manage in the user list (GetOrganizationUserQueryHandler).
            string[] assignable;
            if (loggedInRole == Common.PLATFORM_ADMINISTRATOR)
            {
                assignable = new[]
                {
                    Common.BUYER_NETWORK_ADMIN, Common.SUPPLIER_NETWORK_ADMIN, Common.BUYER_ADMINISTRATOR, Common.SUPPLIER_ADMINISTRATOR,
                    Common.BUYER_USER, Common.OUTLET_MANAGER, Common.STORE_MANAGER, Common.COST_CONTROLLER, Common.SUPPLIER_USER
                };
            }
            else if (loggedInRole == Common.BUYER_NETWORK_ADMIN)
            {
                assignable = new[]
                {
                    Common.BUYER_ADMINISTRATOR, Common.BUYER_USER, Common.OUTLET_MANAGER, Common.STORE_MANAGER, Common.COST_CONTROLLER
                };
            }
            else if (loggedInRole == Common.BUYER_ADMINISTRATOR)
            {
                assignable = new[] { Common.BUYER_USER, Common.OUTLET_MANAGER, Common.STORE_MANAGER, Common.COST_CONTROLLER };
            }
            else if (loggedInRole == Common.SUPPLIER_NETWORK_ADMIN)
            {
                assignable = new[] { Common.SUPPLIER_ADMINISTRATOR, Common.SUPPLIER_USER };
            }
            else if (loggedInRole == Common.SUPPLIER_ADMINISTRATOR)
            {
                assignable = new[] { Common.SUPPLIER_USER };
            }
            else
            {
                _logger.LogInfo($"Role {loggedInRole} cannot create users. Returning no roles.");
                return Task.FromResult(new List<RoleDto>());
            }

            _logger.LogInfo($"Fetching the roles {loggedInRole} may assign.");
            List<RoleDto> result = _repository.Role
                .FindByConditionAsync(x => x.IsActive && assignable.Contains(x.UserRole))
                .OrderBy(x => x.UserRole)
                .Select(x => new RoleDto { Id = x.Id, Name = x.UserRole })
                .ToList();

            _logger.LogInfo($"Fetched {result.Count} assignable roles.");
            return Task.FromResult(result);
        }
    }
}

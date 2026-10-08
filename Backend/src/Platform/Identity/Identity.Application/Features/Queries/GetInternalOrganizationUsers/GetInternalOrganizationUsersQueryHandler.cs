using Contracts.IRepository;
using Identity.Domain.Dto;
using MediatR;
using SharedKernel.LoggerServices;

namespace Identity.Application.Features.Queries.GetInternalOrganizationUsers
{
    public class GetInternalOrganizationUsersQueryHandler
        : IRequestHandler<GetInternalOrganizationUsersQuery, List<UserListDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetInternalOrganizationUsersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<List<UserListDto>> Handle(GetInternalOrganizationUsersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching users by role for a service call. OrganizationId: {request.OrganizationId}, Role: {request.Role}");

            List<UserListDto> users =
            (
                from person in _repository.Person.FindByConditionAsync(x =>
                    x.OrganizationId == request.OrganizationId &&
                    x.IsActive)

                join user in _repository.User.FindByConditionAsync(x => x.IsActive)
                    on person.Id equals user.PersonId

                join mapping in _repository.UserRoleMapping.FindByConditionAsync(x => x.IsActive)
                    on user.Id equals mapping.UserId

                join role in _repository.Role.FindByConditionAsync(x => x.IsActive)
                    on mapping.RoleId equals role.Id

                where role.UserRole == request.Role

                select new UserListDto
                {
                    PersonId = person.Id,
                    UserId = user.Id,
                    Name = person.Name,
                    Email = person.Email,
                    UserName = user.UserName,
                    RoleId = role.Id,
                    RoleName = role.UserRole
                }
            ).ToList();

            _logger.LogInfo($"Users by role fetched. OrganizationId: {request.OrganizationId}, Role: {request.Role}, Count: {users.Count}");
            return Task.FromResult(users);
        }
    }
}

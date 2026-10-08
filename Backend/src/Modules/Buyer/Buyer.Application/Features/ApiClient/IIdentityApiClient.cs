using Buyer.Domain.Dto;

namespace Buyer.Application.Contracts
{
    public interface IIdentityApiClient
    {
        Task UpdateOrganization(
            UpdateBuyerBusinessProfileDto organization,
            string accessToken,
            CancellationToken cancellationToken = default);
        Task<List<ModelDto>> GetOrganizationModels(
            Guid? organizationId = null,
            CancellationToken cancellationToken = default);
        Task<List<IdentityUserDto>> GetOrganizationUsers(
            Guid organizationId,
            CancellationToken cancellationToken = default,
            bool includeAdministrators = false);
        /// <summary>
        /// The users of an organization that hold a role, for a scheduler job with no signed-in user. The call carries the
        /// internal service key instead of a sign-in cookie.
        /// </summary>
        Task<List<IdentityUserDto>> GetUsersByRoleInternal(
            Guid organizationId,
            string role,
            CancellationToken cancellationToken = default);
        Task<List<IdentityUserDto>> GetUsersByIds(
            List<Guid> userIds,
            CancellationToken cancellationToken = default);
        Task<List<IdentityUserDto>> GetOrganizationUserRFQ(
            Guid organizationId,
            CancellationToken cancellationToken = default);
    }
}
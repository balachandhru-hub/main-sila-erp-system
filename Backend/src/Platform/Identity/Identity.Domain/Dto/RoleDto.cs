
namespace Identity.Domain.Dto
{
    public class RoleDto
    {
        public Guid Id { get; set; }

        /// <summary>The role name, e.g. OUTLET_MANAGER.</summary>
        public string Name { get; set; }
    }
}

namespace Buyer.Domain.Dtos
{
    /// <summary>Create or edit a recipe family or category.</summary>
    public class SilaRecipeMasterWriteDto
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}

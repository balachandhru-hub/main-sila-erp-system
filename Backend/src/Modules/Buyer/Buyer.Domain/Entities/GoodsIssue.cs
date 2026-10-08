using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class GoodsIssue : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string IssueNumber { get; set; } = string.Empty;

        public Guid FromLocationId { get; set; }

        public Guid ToLocationId { get; set; }

        public Guid? WeeklyBucketId { get; set; }

        public Guid IssuedBy { get; set; }

        public string? Comment { get; set; }

        public ICollection<GoodsIssueItem> Items { get; set; } = new List<GoodsIssueItem>();
    }
}

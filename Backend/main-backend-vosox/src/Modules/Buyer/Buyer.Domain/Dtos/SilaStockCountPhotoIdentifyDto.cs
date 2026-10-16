namespace Buyer.Domain.Dtos
{
    /// <summary>Candidate materials from a photo. Empty when no vision provider is configured.</summary>
    public class SilaStockCountPhotoIdentifyDto
    {
        public bool Configured { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<SilaStockCountPhotoCandidateDto> Candidates { get; set; } = new List<SilaStockCountPhotoCandidateDto>();
    }

    public class SilaStockCountPhotoCandidateDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
    }
}

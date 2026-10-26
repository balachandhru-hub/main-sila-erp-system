using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Photo identification suggests a material. It never posts inventory and never selects a material on its own.
    /// Replace <see cref="Identify"/> when a vision provider is configured; callers must still ask the user to confirm.
    /// </summary>
    public static class SilaMaterialPhotoIdentifier
    {
        public static SilaStockCountPhotoIdentifyDto Identify()
        {
            return new SilaStockCountPhotoIdentifyDto
            {
                Configured = false,
                Message = "Photo identification is not configured. Search the material. No material was selected and inventory was not changed.",
                Candidates = new List<SilaStockCountPhotoCandidateDto>()
            };
        }
    }
}

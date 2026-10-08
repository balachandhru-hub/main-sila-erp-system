using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Count line photos: JPEG or PNG up to 8 MB, recognised by their content (magic bytes), stored under
    /// FolderPath:BasePath/sila/counts/{countId}/ with a generated file name.
    /// </summary>
    public static class SilaPhotoRules
    {
        public const int MAX_PHOTO_BYTES = 8 * 1024 * 1024;
        public const int MAX_PHOTOS_PER_LINE = 10;
        public const string COUNT_PHOTO_FOLDER = "sila/counts";
        public const string CONTENT_TYPE_JPEG = "image/jpeg";
        public const string CONTENT_TYPE_PNG = "image/png";

        /// <summary>The extension of a JPEG or PNG image, from its first bytes; null for anything else.</summary>
        public static string? DetectExtension(byte[] content)
        {
            string? kind = SilaFileRules.DetectBinaryKind(content);
            return kind == SilaFileRules.KIND_JPEG || kind == SilaFileRules.KIND_PNG ? SilaFileRules.ExtensionOf(kind) : null;
        }

        public static string ContentTypeOf(string fileName)
        {
            return Path.GetExtension(fileName).Equals(".png", StringComparison.OrdinalIgnoreCase) ? CONTENT_TYPE_PNG : CONTENT_TYPE_JPEG;
        }

        /// <summary>The absolute path of a stored photo, or null when the stored path leaves the storage folder.</summary>
        public static string? ResolvePath(string basePath, string relativePath)
        {
            return SilaFileRules.ResolveUnderRoot(basePath, relativePath);
        }

        public static SilaStockCountPhotoDto Map(StockCountPhoto photo)
        {
            return new SilaStockCountPhotoDto
            {
                Id = photo.Id,
                StockCountItemId = photo.StockCountItemId,
                FileName = photo.FileName,
                DateCreated = photo.DateCreated
            };
        }
    }
}

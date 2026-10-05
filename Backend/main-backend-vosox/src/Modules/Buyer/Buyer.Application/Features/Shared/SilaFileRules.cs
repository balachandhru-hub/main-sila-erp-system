using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// One place for the checks of every SILA ME upload: size limit, file extension and real content (magic bytes),
    /// plus the safe handling of stored files (generated names, paths kept under the storage root, clean download names).
    /// </summary>
    public static class SilaFileRules
    {
        public const string KIND_PDF = "PDF";
        public const string KIND_PNG = "PNG";
        public const string KIND_JPEG = "JPEG";
        public const string KIND_XLSX = "XLSX";
        public const string KIND_CSV = "CSV";

        public const string CONTENT_TYPE_OCTET = "application/octet-stream";

        /// <summary>A CSV upload must be text: no NUL byte in its first part.</summary>
        private const int CSV_SNIFF_BYTES = 8192;
        private const int MAX_DOWNLOAD_NAME_LENGTH = 120;

        private static readonly byte[] PdfSignature = { 0x25, 0x50, 0x44, 0x46 };
        private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        private static readonly byte[] JpegSignature = { 0xFF, 0xD8, 0xFF };
        private static readonly byte[] ZipSignature = { 0x50, 0x4B, 0x03, 0x04 };

        private static readonly Dictionary<string, string> KindByExtension = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = KIND_PDF,
            [".png"] = KIND_PNG,
            [".jpg"] = KIND_JPEG,
            [".jpeg"] = KIND_JPEG,
            [".xlsx"] = KIND_XLSX,
            [".csv"] = KIND_CSV
        };

        private static readonly Dictionary<string, string> ExtensionByKind = new Dictionary<string, string>
        {
            [KIND_PDF] = ".pdf",
            [KIND_PNG] = ".png",
            [KIND_JPEG] = ".jpg",
            [KIND_XLSX] = ".xlsx",
            [KIND_CSV] = ".csv"
        };

        private static readonly Dictionary<string, string> ContentTypeByKind = new Dictionary<string, string>
        {
            [KIND_PDF] = "application/pdf",
            [KIND_PNG] = "image/png",
            [KIND_JPEG] = "image/jpeg",
            [KIND_XLSX] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            [KIND_CSV] = "text/csv"
        };

        /// <summary>
        /// Refuses an upload that is empty, larger than maxBytes, has an extension outside the allowed kinds, or whose
        /// content is not what the extension says. Returns the kind of the accepted file.
        /// </summary>
        public static string Validate(ILoggerManager logger, string label, string? fileName, byte[] content, IReadOnlyCollection<string> allowedKinds, long maxBytes)
        {
            string allowedText = string.Join(", ", allowedKinds.Select(kind => ExtensionByKind[kind]));
            if (content.Length == 0)
            {
                logger.LogError($"{label} upload is empty. FileName: {fileName}");
                throw new BadRequestCustomException("The file is empty.", $"Select a {allowedText} file with content and upload it again.");
            }

            if (content.Length > maxBytes)
            {
                logger.LogError($"{label} upload is too large. FileName: {fileName}, Bytes: {content.Length}, MaxBytes: {maxBytes}");
                throw new BadRequestCustomException("The file is too large.", $"Upload a file of at most {FormatMegabytes(maxBytes)}.");
            }

            string? kind = KindOf(fileName);
            if (kind == null || !allowedKinds.Contains(kind))
            {
                logger.LogError($"{label} upload type is not accepted. FileName: {fileName}");
                throw new BadRequestCustomException("File type not accepted.", $"Upload a {allowedText} file.");
            }

            if (!HasSignature(kind, content))
            {
                logger.LogError($"{label} upload content does not match its type. FileName: {fileName}, Kind: {kind}");
                throw new BadRequestCustomException(
                    "File content not accepted.",
                    $"The file is not a valid {ExtensionByKind[kind]} file. Save or export it again as {ExtensionByKind[kind]} and upload it.");
            }

            return kind;
        }

        /// <summary>The kind of a file by its extension, or null when the extension is not one of ours.</summary>
        public static string? KindOf(string? fileName)
        {
            return KindByExtension.TryGetValue(Path.GetExtension(fileName ?? string.Empty), out string? kind) ? kind : null;
        }

        /// <summary>The kind of a binary file (PDF, PNG, JPEG, XLSX) from its first bytes; null when unknown.</summary>
        public static string? DetectBinaryKind(byte[] content)
        {
            foreach (string kind in new[] { KIND_PDF, KIND_PNG, KIND_JPEG, KIND_XLSX })
            {
                if (HasSignature(kind, content))
                {
                    return kind;
                }
            }

            return null;
        }

        /// <summary>Whether the content really is a file of that kind (magic bytes; CSV = text without NUL bytes).</summary>
        public static bool HasSignature(string kind, byte[] content)
        {
            return kind switch
            {
                KIND_PDF => StartsWith(content, PdfSignature),
                KIND_PNG => StartsWith(content, PngSignature),
                KIND_JPEG => StartsWith(content, JpegSignature),
                KIND_XLSX => StartsWith(content, ZipSignature),
                KIND_CSV => content.Length > 0 && !content.Take(CSV_SNIFF_BYTES).Any(x => x == 0),
                _ => false
            };
        }

        /// <summary>The safe extension (with dot) stored for a kind, e.g. ".jpg".</summary>
        public static string ExtensionOf(string kind)
        {
            return ExtensionByKind.TryGetValue(kind, out string? extension) ? extension : string.Empty;
        }

        public static string ContentTypeOf(string? kind)
        {
            return kind != null && ContentTypeByKind.TryGetValue(kind, out string? type) ? type : CONTENT_TYPE_OCTET;
        }

        /// <summary>A generated stored file name: a new Guid plus the safe extension of the kind. Never the user's name.</summary>
        public static string StoredName(Guid id, string kind)
        {
            return $"{id:N}{ExtensionOf(kind)}";
        }

        /// <summary>The absolute path of a stored file, or null when the stored path leaves the storage root.</summary>
        public static string? ResolveUnderRoot(string? basePath, string? relativePath)
        {
            if (string.IsNullOrWhiteSpace(basePath) || string.IsNullOrWhiteSpace(relativePath) || Path.IsPathRooted(relativePath))
            {
                return null;
            }

            string root = Path.GetFullPath(basePath);
            string full = Path.GetFullPath(Path.Combine(root, relativePath));
            string rootWithSeparator = root.EndsWith(Path.DirectorySeparatorChar) ? root : root + Path.DirectorySeparatorChar;
            return full.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase) ? full : null;
        }

        /// <summary>
        /// A display/download name without folders, control characters, quotes or path characters, at most 120 characters,
        /// ending with the extension of the kind; the fallback is used when nothing usable is left.
        /// </summary>
        public static string SafeDisplayName(string? fileName, string fallback, string kind)
        {
            string extension = ExtensionOf(kind);
            string name = Path.GetFileNameWithoutExtension(Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/')));
            char[] invalid = Path.GetInvalidFileNameChars();
            string cleaned = new string(name.Where(x => !char.IsControl(x) && !invalid.Contains(x) && x != '"' && x != '/' && x != '\\').ToArray()).Trim(' ', '.');
            if (string.IsNullOrWhiteSpace(cleaned))
            {
                cleaned = fallback;
            }

            int maxBase = MAX_DOWNLOAD_NAME_LENGTH - extension.Length;
            if (cleaned.Length > maxBase)
            {
                cleaned = cleaned.Substring(0, maxBase);
            }

            return cleaned + extension;
        }

        private static string FormatMegabytes(long bytes)
        {
            return bytes % (1024 * 1024) == 0 ? $"{bytes / (1024 * 1024)} MB" : $"{bytes / 1024} KB";
        }

        private static bool StartsWith(byte[] content, byte[] signature)
        {
            return content.Length >= signature.Length && content.Take(signature.Length).SequenceEqual(signature);
        }
    }
}

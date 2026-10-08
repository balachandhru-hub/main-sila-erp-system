using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.AddSilaStockCountPhoto
{
    /// <summary>Stores a photo of a count line (evidence of what was counted). Inventory is not changed.</summary>
    public class AddSilaStockCountPhotoCommandHandler : IRequestHandler<AddSilaStockCountPhotoCommand, SilaStockCountPhotoDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public AddSilaStockCountPhotoCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SilaStockCountPhotoDto> Handle(AddSilaStockCountPhotoCommand request, CancellationToken cancellationToken)
        {
            SilaStockCountPhotoUploadDto file = request.Request;
            _logger.LogInfo($"Adding count photo. StockCountId: {request.StockCountId}, ItemId: {request.ItemId}, Bytes: {file.Content.Length}, UserId: {request.UserId}");

            if (file.Content.Length == 0)
            {
                _logger.LogError("Count photo is empty.");
                throw new BadRequestCustomException("Photo is empty.", "Take or select a photo of the counted stock.");
            }

            if (file.Content.Length > SilaPhotoRules.MAX_PHOTO_BYTES)
            {
                _logger.LogError($"Count photo is too large. Bytes: {file.Content.Length}");
                throw new BadRequestCustomException("Photo is too large.", "Upload a photo of at most 8 MB.");
            }

            string? extension = SilaPhotoRules.DetectExtension(file.Content);
            if (extension == null)
            {
                _logger.LogError($"Count photo is not a JPEG or PNG image. FileName: {file.FileName}");
                throw new BadRequestCustomException("File type not accepted.", "Upload the photo as a JPEG or PNG image.");
            }

            string basePath = _configuration[Common.BASE_FOLDER_PATH] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(basePath))
            {
                _logger.LogError("FolderPath:BasePath is not configured.");
                throw new FailedDependencyCustomException("File storage is not configured.", "Ask your administrator to configure the file storage folder.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            if (count.Status == Common.SILA_COUNT_POSTED || count.Status == Common.SILA_COUNT_CANCELLED)
            {
                _logger.LogError($"Photo added to a closed count. StockCountId: {count.Id}, Status: {count.Status}");
                throw new BadRequestCustomException("Stock count is closed.", $"Count {count.CountNumber} is {count.Status}. Photos can be added until it is approved.");
            }

            StockCountItem? item = await _repository.StockCountItem
                .FindByCondition(x => x.Id == request.ItemId && x.StockCountId == count.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (item == null)
            {
                _logger.LogError($"Count line not found. ItemId: {request.ItemId}, StockCountId: {count.Id}");
                throw new NotFoundCustomException("Count line not found.", "Select a material of this stock count.");
            }

            int existing = await _repository.StockCountPhoto
                .FindByCondition(x => x.StockCountItemId == item.Id && x.IsActive)
                .CountAsync(cancellationToken);
            if (existing >= SilaPhotoRules.MAX_PHOTOS_PER_LINE)
            {
                _logger.LogError($"Too many photos on the count line. ItemId: {item.Id}, Photos: {existing}");
                throw new BadRequestCustomException("Too many photos.", $"A count line can have at most {SilaPhotoRules.MAX_PHOTOS_PER_LINE} photos.");
            }

            // The stored name is generated; only a display name is kept from the client.
            Guid photoId = Guid.NewGuid();
            string storedName = $"{photoId}{extension}";
            string relativePath = Path.Combine(SilaPhotoRules.COUNT_PHOTO_FOLDER, count.Id.ToString(), storedName);
            string directory = Path.Combine(basePath, SilaPhotoRules.COUNT_PHOTO_FOLDER, count.Id.ToString());
            Directory.CreateDirectory(directory);
            await File.WriteAllBytesAsync(Path.Combine(directory, storedName), file.Content, cancellationToken);

            string displayName = Path.GetFileNameWithoutExtension(Path.GetFileName(file.FileName ?? string.Empty)).Trim();
            if (string.IsNullOrWhiteSpace(displayName) || displayName.Length > 100)
            {
                displayName = $"{item.MaterialCode}-{DateTime.UtcNow:yyyyMMddHHmmss}";
            }

            StockCountPhoto photo = new StockCountPhoto
            {
                Id = photoId,
                StockCountItemId = item.Id,
                FilePath = relativePath,
                FileName = displayName + extension,
                IsActive = true
            };
            _repository.StockCountPhoto.Create(photo);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, SilaStockCountRules.EVENT_PHOTO_ADDED, $"{item.MaterialCode}: {photo.FileName}");
            await _repository.SaveAsync();

            _logger.LogInfo($"Count photo added. StockCountId: {count.Id}, ItemId: {item.Id}, PhotoId: {photo.Id}");
            return SilaPhotoRules.Map(photo);
        }
    }
}

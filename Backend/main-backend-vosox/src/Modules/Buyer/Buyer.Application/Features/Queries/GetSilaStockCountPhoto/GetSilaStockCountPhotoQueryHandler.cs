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

namespace Buyer.Application.Features.Queries.GetSilaStockCountPhoto
{
    public class GetSilaStockCountPhotoQueryHandler : IRequestHandler<GetSilaStockCountPhotoQuery, SilaStockCountPhotoFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public GetSilaStockCountPhotoQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SilaStockCountPhotoFileDto> Handle(GetSilaStockCountPhotoQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching count photo. StockCountId: {request.StockCountId}, PhotoId: {request.PhotoId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            List<Guid> itemIds = await _repository.StockCountItem
                .FindByCondition(x => x.StockCountId == count.Id)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            StockCountPhoto? photo = await _repository.StockCountPhoto
                .FindByCondition(x => x.Id == request.PhotoId && x.IsActive && itemIds.Contains(x.StockCountItemId))
                .FirstOrDefaultAsync(cancellationToken);
            if (photo == null)
            {
                _logger.LogError($"Count photo not found. PhotoId: {request.PhotoId}, StockCountId: {count.Id}");
                throw new NotFoundCustomException("Photo not found.", "Open a photo of this stock count.");
            }

            string basePath = _configuration[Common.BASE_FOLDER_PATH] ?? string.Empty;
            string? fullPath = string.IsNullOrWhiteSpace(basePath) ? null : SilaPhotoRules.ResolvePath(basePath, photo.FilePath);
            if (fullPath == null || !File.Exists(fullPath))
            {
                _logger.LogError($"Count photo file is missing. PhotoId: {photo.Id}");
                throw new NotFoundCustomException("Photo file not found.", "The stored photo is no longer available. Take the photo again.");
            }

            byte[] content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            _logger.LogInfo($"Count photo fetched. PhotoId: {photo.Id}, Bytes: {content.Length}");
            return new SilaStockCountPhotoFileDto
            {
                FileName = SilaFileRules.SafeDisplayName(
                    photo.FileName, $"photo-{photo.Id:N}", SilaFileRules.KindOf(photo.FilePath) ?? SilaFileRules.KIND_JPEG),
                ContentType = SilaPhotoRules.ContentTypeOf(photo.FilePath),
                Content = content
            };
        }
    }
}

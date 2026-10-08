using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaStockCount
{
    public class GetSilaStockCountQueryHandler : IRequestHandler<GetSilaStockCountQuery, SilaStockCountDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaStockCountQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaStockCountDetailDto> Handle(GetSilaStockCountQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching stock count. StockCountId: {request.StockCountId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            List<StockCountItem> items = await _repository.StockCountItem
                .FindByCondition(x => x.StockCountId == count.Id && x.IsActive)
                .OrderBy(x => x.MaterialCode)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = items.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, string?> barcodes = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Barcode, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, materialIds, cancellationToken);
            List<Guid> people = items.Where(x => x.CountedBy != null).Select(x => x.CountedBy!.Value)
                .Append(count.CreatedBy)
                .Concat(new[] { count.SubmittedBy, count.ApprovedBy }.Where(x => x != null).Select(x => x!.Value))
                .ToList();
            SilaCountContext context = await SilaCountContext.LoadAsync(
                _repository, _identityApiClient, _logger, buyer.Id, new[] { count.LocationId }, people, cancellationToken);
            InventoryLocation? location = context.Locations.GetValueOrDefault(count.LocationId);
            Dictionary<Guid, InventoryErpPosting> postings = await SilaCountPosting.GetPostingsAsync(_repository, buyer.Id, new[] { count.Id }, cancellationToken);
            string? currency = await SilaCountContext.CurrencyAsync(_repository, buyer.Id, materialIds, cancellationToken);

            bool canSee = SilaStockCountRules.CanSeeSystemQty(count, request.RoleId);
            int counted = items.Count(x => x.Status != Common.SILA_COUNT_LINE_NOT_COUNTED);
            SilaStockCountDetailDto result = new SilaStockCountDetailDto
            {
                Id = count.Id,
                CountNumber = count.CountNumber,
                LocationId = count.LocationId,
                LocationName = location?.LocationName,
                CountType = count.CountType,
                BlindCount = count.BlindCount,
                Status = count.Status,
                Notes = count.Notes,
                CanSeeSystemQty = canSee,
                TotalItems = items.Count,
                CountedItems = counted,
                RemainingItems = items.Count - counted,
                MatchedItems = canSee ? items.Count(x => x.Status == Common.SILA_COUNT_LINE_MATCHED) : 0,
                ShortageItems = canSee ? items.Count(x => x.Status == Common.SILA_COUNT_LINE_SHORTAGE) : 0,
                SurplusItems = canSee ? items.Count(x => x.Status == Common.SILA_COUNT_LINE_SURPLUS) : 0,
                ShortageValue = canSee
                    ? items.Where(x => x.Status == Common.SILA_COUNT_LINE_SHORTAGE && x.VarianceValue != null).Sum(x => -x.VarianceValue!.Value)
                    : null,
                CreatedBy = count.CreatedBy,
                DateCreated = count.DateCreated,
                SubmittedBy = count.SubmittedBy,
                SubmittedOn = count.SubmittedOn,
                ApprovedBy = count.ApprovedBy,
                ApprovedOn = count.ApprovedOn,
                PropertyId = context.PropertyIdOf(count.LocationId),
                PropertyName = context.PropertyOf(count.LocationId),
                BusinessDate = count.BusinessDate,
                Currency = currency,
                CreatedByName = context.NameOf(count.CreatedBy),
                SubmittedByName = context.NameOf(count.SubmittedBy),
                ApprovedByName = context.NameOf(count.ApprovedBy),
                Items = items
                    .Select(x => SilaStockCountRules.MapItem(x, canSee, barcodes.TryGetValue(x.MaterialId, out string? barcode) ? barcode : null, conversions))
                    .ToList()
            };

            await AddEnquiriesAndPhotosAsync(result, buyer.Id, count.Id, cancellationToken);
            Dictionary<Guid, StockCountItem> itemsById = items.ToDictionary(x => x.Id);
            string? manager = context.ManagerOf(count.LocationId);
            foreach (SilaStockCountItemDto item in result.Items)
            {
                StockCountItem source = itemsById[item.Id];
                (string? Status, string? Document, string? Error) sap = SilaCountPosting.Of(count, source, postings);
                item.CountedByName = context.NameOf(source.CountedBy);
                item.Manager = manager;
                item.SapStatus = sap.Status;
                item.SapMaterialDocument = sap.Document;
                item.SapError = sap.Error;
            }

            _logger.LogInfo($"Stock count fetched. StockCountId: {count.Id}, Items: {items.Count}, Counted: {counted}");
            return result;
        }

        /// <summary>The open enquiry and the photos of every line, loaded in two queries.</summary>
        private async Task AddEnquiriesAndPhotosAsync(SilaStockCountDetailDto result, Guid buyerId, Guid countId, CancellationToken cancellationToken)
        {
            Dictionary<Guid, StockShortageEnquiry> enquiries = (await _repository.StockShortageEnquiry
                    .FindByCondition(x => x.BuyerId == buyerId && x.StockCountId == countId && x.IsActive)
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.StockCountItemId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(e => e.DateCreated).First());
            List<Guid> itemIds = result.Items.Select(x => x.Id).ToList();
            Dictionary<Guid, List<SilaStockCountPhotoDto>> photos = (await _repository.StockCountPhoto
                    .FindByCondition(x => itemIds.Contains(x.StockCountItemId) && x.IsActive)
                    .OrderBy(x => x.DateCreated)
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.StockCountItemId)
                .ToDictionary(x => x.Key, x => x.Select(SilaPhotoRules.Map).ToList());

            foreach (SilaStockCountItemDto item in result.Items)
            {
                if (enquiries.TryGetValue(item.Id, out StockShortageEnquiry? enquiry))
                {
                    item.EnquiryId = enquiry.Id;
                    item.EnquiryNumber = enquiry.EnquiryNumber;
                    item.EnquiryStatus = enquiry.Status;
                }

                if (photos.TryGetValue(item.Id, out List<SilaStockCountPhotoDto>? list))
                {
                    item.Photos = list;
                }
            }
        }
    }
}

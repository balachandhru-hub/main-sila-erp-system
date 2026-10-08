using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.IdentifySilaStockCountBarcode
{
    public class IdentifySilaStockCountBarcodeQueryHandler : IRequestHandler<IdentifySilaStockCountBarcodeQuery, SilaStockCountBarcodeDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public IdentifySilaStockCountBarcodeQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaStockCountBarcodeDto> Handle(IdentifySilaStockCountBarcodeQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Identifying barcode. StockCountId: {request.StockCountId}, Barcode: {request.Barcode}, UserId: {request.UserId}");

            string code = (request.Barcode ?? string.Empty).Trim();
            if (code.Length == 0)
            {
                _logger.LogError($"Empty barcode. StockCountId: {request.StockCountId}");
                throw new BadRequestCustomException("Barcode is required.", "Scan or type the barcode of the material.");
            }

            SilaInputRules.MaxLength(_logger, code, SilaInputRules.NAME_LENGTH, "barcode");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);

            // The barcode first; the material code is accepted too, so a typed code finds the material as well.
            Buyer.Domain.Entities.ItemBuyerMaster? material = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Barcode == code)
                .FirstOrDefaultAsync(cancellationToken)
                ?? await _repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.MaterialCode == code)
                    .FirstOrDefaultAsync(cancellationToken);
            if (material == null)
            {
                _logger.LogError($"No material for the barcode. Barcode: {code}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Barcode not recognised.", "Search the material by name, or add the barcode to the material in the Item Master.");
            }

            StockCountItem? item = await _repository.StockCountItem
                .FindByCondition(x => x.StockCountId == count.Id && x.MaterialId == material.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, new[] { material.Id }, cancellationToken);

            _logger.LogInfo($"Barcode identified. MaterialId: {material.Id}, OnCountSheet: {item != null}");
            return new SilaStockCountBarcodeDto
            {
                MaterialId = material.Id,
                MaterialCode = material.MaterialCode ?? string.Empty,
                MaterialName = material.Description ?? string.Empty,
                BaseUom = UomConverter.BaseUomOf(material),
                Item = item == null
                    ? null
                    : SilaStockCountRules.MapItem(item, SilaStockCountRules.CanSeeSystemQty(count, request.RoleId), material.Barcode, conversions)
            };
        }
    }
}

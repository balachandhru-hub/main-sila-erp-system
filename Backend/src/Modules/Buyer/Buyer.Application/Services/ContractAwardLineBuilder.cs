using Buyer.Application.Contracts;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services
{
    /// <summary>
    /// The lines of a contract: the RFQ items awarded to the contract supplier, priced from that supplier's
    /// quotation (read from the Supplier service). Used for the contract's items and for the purchase order lines.
    /// </summary>
    public class ContractAwardLineBuilder
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ISupplierApiClient _supplierApiClient;
        private readonly ILoggerManager _logger;

        public ContractAwardLineBuilder(IRepositoryWrapper repository, ISupplierApiClient supplierApiClient, ILoggerManager logger)
        {
            _repository = repository;
            _supplierApiClient = supplierApiClient;
            _logger = logger;
        }

        /// <summary>
        /// The awarded, priced lines for a purchase order. Null for a lot-wise award, which has no item rows.
        /// Throws when the RFQ has no award or an awarded item has no price.
        /// </summary>
        public async Task<List<ContractItemDto>?> BuildForPurchaseOrderAsync(PredefinedContract contract, CancellationToken cancellationToken)
        {
            RFQAward award = await GetAwardAsync(contract, cancellationToken)
                ?? throw new BadRequestCustomException("RFQ is not awarded.", "The RFQ of this contract has no active award, so there is nothing to order.");

            List<RFQAwardItem> awardItems = await GetAwardItemsAsync(award, contract, cancellationToken);
            if (awardItems.Count == 0)
            {
                if (award.SupplierId == contract.SupplierId)
                {
                    // A lot-wise award has no item rows: the whole RFQ went to this supplier.
                    return null;
                }

                _logger.LogError($"The contract's supplier has no awarded item. ContractId: {contract.Id}, SupplierId: {contract.SupplierId}");
                throw new BadRequestCustomException("No awarded items.", "The supplier of this contract has no awarded item in the RFQ.");
            }

            BidCompareResponseDto bid;
            try
            {
                bid = await _supplierApiClient.GetBidCompare(contract.RFQId, cancellationToken);
            }
            catch (Exception exception) when (exception is not BaseCustomException)
            {
                _logger.LogError($"The supplier quotation could not be read. ContractId: {contract.Id}, Error: {exception.Message}");
                throw new FailedDependencyCustomException("Quotation is not available.", "The supplier quotation could not be read. Try again later.");
            }

            return await PriceAsync(contract, awardItems, bid, true, cancellationToken);
        }

        /// <summary>
        /// The contract's items for display. Awarded items with their prices; for a lot-wise award, or when the
        /// quotation cannot be read, the RFQ items without prices. Never throws for a missing price.
        /// </summary>
        public async Task<List<ContractItemDto>> BuildForDisplayAsync(PredefinedContract contract, CancellationToken cancellationToken)
        {
            RFQAward? award = await GetAwardAsync(contract, cancellationToken);
            List<RFQAwardItem> awardItems = award == null
                ? new List<RFQAwardItem>()
                : await GetAwardItemsAsync(award, contract, cancellationToken);

            if (awardItems.Count > 0)
            {
                try
                {
                    BidCompareResponseDto bid = await _supplierApiClient.GetBidCompare(contract.RFQId, cancellationToken);
                    return await PriceAsync(contract, awardItems, bid, false, cancellationToken);
                }
                catch (Exception exception)
                {
                    _logger.LogError($"The supplier quotation could not be read for the contract items. ContractId: {contract.Id}, Error: {exception.Message}");
                }
            }

            // Lot-wise award, or no prices: every RFQ item, unpriced.
            List<RFQItem> rfqItems = await _repository.RFQItem
                .FindByCondition(x => x.RFQId == contract.RFQId && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            return rfqItems.Select(Line).ToList();
        }

        private async Task<RFQAward?> GetAwardAsync(PredefinedContract contract, CancellationToken cancellationToken)
        {
            return await _repository.RFQAward
                .FindByCondition(x => x.RFQId == contract.RFQId && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<List<RFQAwardItem>> GetAwardItemsAsync(RFQAward award, PredefinedContract contract, CancellationToken cancellationToken)
        {
            return await _repository.RFQAwardItem
                .FindByCondition(x => x.RFQAwardId == award.Id && x.SupplierId == contract.SupplierId && x.IsActive)
                .ToListAsync(cancellationToken);
        }

        private async Task<List<ContractItemDto>> PriceAsync(
            PredefinedContract contract,
            List<RFQAwardItem> awardItems,
            BidCompareResponseDto bid,
            bool priceRequired,
            CancellationToken cancellationToken)
        {
            List<Guid> rfqItemIds = awardItems.Select(x => x.RFQItemId).ToList();
            List<RFQItem> rfqItems = await _repository.RFQItem
                .FindByCondition(x => rfqItemIds.Contains(x.Id) && x.IsActive)
                .ToListAsync(cancellationToken);

            BidCompareSupplierDto? supplier = bid.Suppliers.FirstOrDefault(x => x.SupplierId == contract.SupplierId);
            List<BidCompareItemDto> bidItems = new List<BidCompareItemDto>();
            if (supplier?.LatestVersion != null)
            {
                bidItems.AddRange(supplier.LatestVersion.Items);
            }

            if (supplier?.FirstVersion != null)
            {
                bidItems.AddRange(supplier.FirstVersion.Items);
            }

            List<ContractItemDto> lines = new List<ContractItemDto>();
            foreach (RFQAwardItem awardItem in awardItems)
            {
                RFQItem? rfqItem = rfqItems.FirstOrDefault(x => x.Id == awardItem.RFQItemId);
                if (rfqItem == null)
                {
                    continue;
                }

                BidCompareItemDto? bidItem = bidItems.FirstOrDefault(x => awardItem.SupplierQuotationItemId != null && x.SupplierQuotationItemId == awardItem.SupplierQuotationItemId)
                    ?? bidItems.FirstOrDefault(x => x.BuyerRFQItemId == awardItem.RFQItemId);
                if (bidItem == null && priceRequired)
                {
                    _logger.LogError($"An awarded item has no quotation. ContractId: {contract.Id}, RFQItemId: {awardItem.RFQItemId}");
                    throw new BadRequestCustomException("Quotation is missing.", $"The awarded RFQ item {awardItem.RFQItemId} has no quotation price.");
                }

                ContractItemDto line = Line(rfqItem);
                if (bidItem != null)
                {
                    line.UnitPrice = bidItem.QuotedPrice;
                    line.LineAmount = bidItem.SubTotal > 0 ? bidItem.SubTotal : bidItem.QuotedAmount;
                }

                lines.Add(line);
            }

            return lines.OrderBy(x => x.LineNumber).ToList();
        }

        private static ContractItemDto Line(RFQItem rfqItem)
        {
            return new ContractItemDto
            {
                LineNumber = rfqItem.LineNumber,
                MaterialCode = rfqItem.MaterialCode,
                MaterialGroup = rfqItem.MaterialGroup,
                CostCenter = rfqItem.CostCenter,
                Description = rfqItem.Description,
                Quantity = rfqItem.Quantity,
                UnitOfMeasure = rfqItem.UOM
            };
        }
    }
}

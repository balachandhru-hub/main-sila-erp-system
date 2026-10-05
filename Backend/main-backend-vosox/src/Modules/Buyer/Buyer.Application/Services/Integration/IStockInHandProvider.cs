namespace Buyer.Application.Services.Integration
{
    /// <summary>
    /// Integration point for stock in hand. The buyer's stock is read from its own ERP through the stock
    /// API configured under Integrations (ErpStockInHandProvider). Another inventory source is connected by
    /// registering another implementation of this interface in Buyer.API.
    /// </summary>
    public interface IStockInHandProvider
    {
        /// <summary>
        /// Stock the buyer has in the storage location for the material, or null when it is not known.
        /// </summary>
        Task<decimal?> GetStockInHandAsync(
            Guid buyerId,
            string? storageLocation,
            string? materialCode,
            CancellationToken cancellationToken);
    }
}

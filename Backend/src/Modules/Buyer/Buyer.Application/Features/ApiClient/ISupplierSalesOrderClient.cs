using SharedKernel.Integration.Dtos;

namespace Buyer.Application.Contracts
{
    /// <summary>
    /// Hands a purchase order to the Supplier service, which sends it to the supplier's own ERP. The call has no signed-in
    /// supplier: it carries the internal key the services share.
    /// </summary>
    public interface ISupplierSalesOrderClient
    {
        Task<SupplierSalesOrderResultDto> SendSalesOrderAsync(
            SupplierSalesOrderRequestDto order,
            CancellationToken cancellationToken = default);
    }
}

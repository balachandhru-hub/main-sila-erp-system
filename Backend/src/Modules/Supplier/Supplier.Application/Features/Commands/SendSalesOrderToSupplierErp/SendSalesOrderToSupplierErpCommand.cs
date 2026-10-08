using MediatR;
using SharedKernel.Integration.Dtos;

namespace Supplier.Application.Features.Commands.SendSalesOrderToSupplierErp
{
    /// <summary>
    /// Hands a purchase order of a buyer to the supplier's ERP through the supplier's active sales order API.
    /// </summary>
    public class SendSalesOrderToSupplierErpCommand : IRequest<SupplierSalesOrderResultDto>
    {
        public SupplierSalesOrderRequestDto Order { get; set; } = new SupplierSalesOrderRequestDto();
    }
}

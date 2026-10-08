using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Controllers;
using SharedKernel.Integration.Dtos;
using SharedKernel.LoggerServices;
using SharedKernel.Tenancy;
using Supplier.Application.Features.Commands.SendSalesOrderToSupplierErp;
using Swashbuckle.AspNetCore.Annotations;

namespace Supplier.API.Controllers
{
    /// <summary>
    /// Called by the Buyer service when a purchase order has to reach the supplier's ERP. There is no signed-in supplier: the
    /// caller must send the internal key, which is derived from the token signing key the services share, so a sign-in cookie
    /// is not enough.
    /// </summary>
    [ApiController]
    public class SalesOrderController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public SalesOrderController(IMediator mediator, ILoggerManager logger, IConfiguration configuration)
        {
            _mediator = mediator;
            _logger = logger;
            _configuration = configuration;
        }

        [HttpPost]
        [Route("api/v1/supplier/internal/sales-orders")]
        [SwaggerOperation("SendSalesOrderToSupplierErp")]
        [SwaggerResponse(200, type: typeof(SupplierSalesOrderResultDto))]
        public async Task<IActionResult> Send([FromBody] SupplierSalesOrderRequestDto request)
        {
            string sent = Request.Headers[HttpTenantRegistry.INTERNAL_KEY_HEADER].ToString();
            string expected = HttpTenantRegistry.InternalKey(_configuration);
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sent), Encoding.UTF8.GetBytes(expected)))
            {
                _logger.LogError("Sales order call refused: the internal key is missing or wrong.");
                return Unauthorized();
            }

            if (request.SupplierId == Guid.Empty || string.IsNullOrWhiteSpace(request.PurchaseOrderNumber))
            {
                return BadRequest("supplierId and purchaseOrderNumber are required.");
            }

            SupplierSalesOrderResultDto result = await _mediator.Send(new SendSalesOrderToSupplierErpCommand { Order = request });
            return Ok(result);
        }
    }
}

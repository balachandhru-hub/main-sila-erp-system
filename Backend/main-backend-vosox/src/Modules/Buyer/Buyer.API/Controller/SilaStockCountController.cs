using Buyer.Application.Features.Commands.AddSilaStockCountPhoto;
using Buyer.Application.Features.Commands.ApproveSilaStockCount;
using Buyer.Application.Features.Commands.ReviewSilaStockCountItem;
using Buyer.Application.Features.Commands.SendSilaShortageReport;
using Buyer.Application.Features.Queries.ExportSilaShortageReport;
using Buyer.Application.Features.Queries.GetSilaShortageReport;
using Buyer.Application.Features.Queries.GetSilaStockCountPhoto;
using Buyer.Application.Features.Commands.CancelSilaStockCount;
using Buyer.Application.Features.Commands.CountSilaStockCountItem;
using Buyer.Application.Features.Commands.CreateSilaStockCount;
using Buyer.Application.Features.Commands.RespondSilaEnquiry;
using Buyer.Application.Features.Commands.ReviewSilaEnquiry;
using Buyer.Application.Features.Commands.SubmitSilaStockCount;
using Buyer.Application.Features.Queries.GetSilaEnquiries;
using Buyer.Application.Features.Queries.GetSilaEnquiry;
using Buyer.Application.Features.Queries.GetSilaStockCount;
using Buyer.Application.Features.Queries.GetSilaStockCounts;
using Buyer.Application.Features.Queries.GetSilaStockCountTasks;
using Buyer.Application.Features.Queries.IdentifySilaStockCountBarcode;
using Buyer.Application.Features.Queries.IdentifySilaStockCountPhoto;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME physical stock counts and the shortage enquiries they raise. Counting never changes inventory;
    /// only the approval of a count posts the variances.
    /// </summary>
    [ApiController]
    public class SilaStockCountController : BaseController
    {
        /// <summary>8 MB photo plus multipart overhead; the handler enforces the exact 8 MB limit.</summary>
        private const long PHOTO_UPLOAD_LIMIT = 9L * 1024 * 1024;
        private const string EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaStockCountController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaStockCounts")]
        [SwaggerResponse(200, type: typeof(List<SilaStockCountListItemDto>))]
        public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] Guid? locationId, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching stock counts. Status: {status}, LocationId: {locationId}, Index: {index}, Limit: {limit}");
            List<SilaStockCountListItemDto> result = await _mediator.Send(new GetSilaStockCountsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                LocationId = locationId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Stock counts fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("CreateSilaStockCount")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaStockCountWriteDto request)
        {
            _logger.LogDebug($"Creating stock count. LocationId: {request.LocationId}, CountType: {request.CountType}");
            Guid id = await _mediator.Send(new CreateSilaStockCountCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Stock count created. StockCountId: {id}");
            return Ok(new SuccessResponseDto
            {
                Id = id.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Stock count started."
            });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/tasks")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaStockCountTasks")]
        [SwaggerResponse(200, type: typeof(List<SilaStockCountTaskDto>))]
        public async Task<IActionResult> Tasks()
        {
            _logger.LogDebug("Fetching stock count tasks.");
            List<SilaStockCountTaskDto> result = await _mediator.Send(new GetSilaStockCountTasksQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });
            _logger.LogDebug($"Stock count tasks fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaStockCount")]
        [SwaggerResponse(200, type: typeof(SilaStockCountDetailDto))]
        public async Task<IActionResult> Get([FromRoute] Guid stockCountId)
        {
            _logger.LogDebug($"Fetching stock count. StockCountId: {stockCountId}");
            SilaStockCountDetailDto result = await _mediator.Send(new GetSilaStockCountQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId
            });
            _logger.LogDebug($"Stock count fetched. StockCountId: {stockCountId}, Items: {result.Items.Count}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/items/{itemId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("CountSilaStockCountItem")]
        [SwaggerResponse(200, type: typeof(SilaStockCountItemResultDto))]
        public async Task<IActionResult> CountItem([FromRoute] Guid stockCountId, [FromRoute] Guid itemId, [FromBody] SilaStockCountItemWriteDto request)
        {
            _logger.LogDebug($"Counting item. StockCountId: {stockCountId}, ItemId: {itemId}");
            SilaStockCountItemResultDto result = await _mediator.Send(new CountSilaStockCountItemCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                ItemId = itemId,
                Request = request
            });
            _logger.LogDebug($"Item counted. StockCountId: {stockCountId}, ItemId: {itemId}, Status: {result.Item.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/items")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("AddSilaStockCountItem")]
        [SwaggerResponse(200, type: typeof(SilaStockCountItemResultDto))]
        public async Task<IActionResult> AddItem([FromRoute] Guid stockCountId, [FromBody] SilaStockCountItemWriteDto request)
        {
            _logger.LogDebug($"Adding counted material. StockCountId: {stockCountId}, MaterialId: {request.MaterialId}");
            SilaStockCountItemResultDto result = await _mediator.Send(new CountSilaStockCountItemCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                ItemId = null,
                Request = request
            });
            _logger.LogDebug($"Counted material added. StockCountId: {stockCountId}, ItemId: {result.Item.Id}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/identify-barcode")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("IdentifySilaStockCountBarcode")]
        [SwaggerResponse(200, type: typeof(SilaStockCountBarcodeDto))]
        public async Task<IActionResult> IdentifyBarcode([FromRoute] Guid stockCountId, [FromQuery] string barcode)
        {
            _logger.LogDebug($"Identifying barcode. StockCountId: {stockCountId}, Barcode: {barcode}");
            SilaStockCountBarcodeDto result = await _mediator.Send(new IdentifySilaStockCountBarcodeQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                Barcode = barcode
            });
            _logger.LogDebug($"Barcode identified. StockCountId: {stockCountId}, MaterialId: {result.MaterialId}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/identify-photo")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("IdentifySilaStockCountPhoto")]
        [SwaggerResponse(200, type: typeof(SilaStockCountPhotoIdentifyDto))]
        public async Task<IActionResult> IdentifyPhoto([FromRoute] Guid stockCountId)
        {
            _logger.LogDebug($"Identifying material from a photo. StockCountId: {stockCountId}");
            SilaStockCountPhotoIdentifyDto result = await _mediator.Send(new IdentifySilaStockCountPhotoQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId
            });
            _logger.LogDebug($"Photo identification finished. StockCountId: {stockCountId}, Candidates: {result.Candidates.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/submit")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("SubmitSilaStockCount")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Submit([FromRoute] Guid stockCountId, [FromBody] SilaStockCountSubmitDto? request)
        {
            _logger.LogDebug($"Submitting stock count. StockCountId: {stockCountId}");
            await _mediator.Send(new SubmitSilaStockCountCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                Request = request ?? new SilaStockCountSubmitDto()
            });
            _logger.LogDebug($"Stock count submitted. StockCountId: {stockCountId}");
            return Ok(new SuccessResponseDto
            {
                Id = stockCountId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Stock count submitted. Shortages were sent to the location as enquiries."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/approve")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("ApproveSilaStockCount")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Approve([FromRoute] Guid stockCountId)
        {
            _logger.LogDebug($"Approving stock count. StockCountId: {stockCountId}");
            await _mediator.Send(new ApproveSilaStockCountCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId
            });
            _logger.LogDebug($"Stock count approved. StockCountId: {stockCountId}");
            return Ok(new SuccessResponseDto
            {
                Id = stockCountId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Stock count approved. Variances were posted to inventory."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/cancel")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("CancelSilaStockCount")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Cancel([FromRoute] Guid stockCountId)
        {
            _logger.LogDebug($"Cancelling stock count. StockCountId: {stockCountId}");
            await _mediator.Send(new CancelSilaStockCountCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId
            });
            _logger.LogDebug($"Stock count cancelled. StockCountId: {stockCountId}");
            return Ok(new SuccessResponseDto
            {
                Id = stockCountId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Stock count cancelled."
            });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/enquiries")]
        [ApiAuthorization(Name = "RESPOND_SILA_ENQUIRY")]
        [SwaggerOperation("GetSilaEnquiries")]
        [SwaggerResponse(200, type: typeof(List<SilaEnquiryDto>))]
        public async Task<IActionResult> Enquiries([FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching shortage enquiries. Status: {status}, Index: {index}, Limit: {limit}");
            List<SilaEnquiryDto> result = await _mediator.Send(new GetSilaEnquiriesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Shortage enquiries fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/enquiries/{enquiryId:guid}")]
        [ApiAuthorization(Name = "RESPOND_SILA_ENQUIRY")]
        [SwaggerOperation("GetSilaEnquiry")]
        [SwaggerResponse(200, type: typeof(SilaEnquiryDto))]
        public async Task<IActionResult> Enquiry([FromRoute] Guid enquiryId)
        {
            _logger.LogDebug($"Fetching shortage enquiry. EnquiryId: {enquiryId}");
            SilaEnquiryDto result = await _mediator.Send(new GetSilaEnquiryQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                EnquiryId = enquiryId
            });
            _logger.LogDebug($"Shortage enquiry fetched. EnquiryId: {enquiryId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/enquiries/{enquiryId:guid}/respond")]
        [ApiAuthorization(Name = "RESPOND_SILA_ENQUIRY")]
        [SwaggerOperation("RespondSilaEnquiry")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Respond([FromRoute] Guid enquiryId, [FromBody] SilaEnquiryRespondDto request)
        {
            _logger.LogDebug($"Responding to shortage enquiry. EnquiryId: {enquiryId}, Category: {request.JustificationCategory}");
            await _mediator.Send(new RespondSilaEnquiryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                EnquiryId = enquiryId,
                Request = request
            });
            _logger.LogDebug($"Shortage enquiry answered. EnquiryId: {enquiryId}");
            return Ok(new SuccessResponseDto
            {
                Id = enquiryId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Response sent for review."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/enquiries/{enquiryId:guid}/review")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("ReviewSilaEnquiry")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Review([FromRoute] Guid enquiryId, [FromBody] SilaEnquiryReviewDto request)
        {
            _logger.LogDebug($"Reviewing shortage enquiry. EnquiryId: {enquiryId}, Accept: {request.Accept}");
            await _mediator.Send(new ReviewSilaEnquiryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                EnquiryId = enquiryId,
                Request = request
            });
            _logger.LogDebug($"Shortage enquiry reviewed. EnquiryId: {enquiryId}");
            return Ok(new SuccessResponseDto
            {
                Id = enquiryId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = request.Accept ? "Justification accepted." : "Justification rejected."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/items/{itemId:guid}/review")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("ReviewSilaStockCountItem")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> ReviewItem([FromRoute] Guid stockCountId, [FromRoute] Guid itemId, [FromBody] SilaStockCountItemReviewDto request)
        {
            _logger.LogDebug($"Reviewing count line. StockCountId: {stockCountId}, ItemId: {itemId}, Decision: {request.Decision}");
            await _mediator.Send(new ReviewSilaStockCountItemCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                ItemId = itemId,
                Request = request
            });
            _logger.LogDebug($"Count line reviewed. StockCountId: {stockCountId}, ItemId: {itemId}");
            return Ok(new SuccessResponseDto
            {
                Id = itemId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Review saved."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/items/{itemId:guid}/photo")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(PHOTO_UPLOAD_LIMIT)]
        [SwaggerOperation("AddSilaStockCountPhoto")]
        [SwaggerResponse(200, type: typeof(SilaStockCountPhotoDto))]
        public async Task<IActionResult> AddPhoto([FromRoute] Guid stockCountId, [FromRoute] Guid itemId, IFormFile file)
        {
            _logger.LogDebug($"Adding count photo. StockCountId: {stockCountId}, ItemId: {itemId}, Bytes: {file?.Length}");
            byte[] content = Array.Empty<byte>();
            if (file != null && file.Length > 0)
            {
                using MemoryStream stream = new MemoryStream();
                await file.CopyToAsync(stream);
                content = stream.ToArray();
            }

            SilaStockCountPhotoDto result = await _mediator.Send(new AddSilaStockCountPhotoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                ItemId = itemId,
                Request = new SilaStockCountPhotoUploadDto
                {
                    FileName = file?.FileName ?? string.Empty,
                    ContentType = file?.ContentType,
                    Content = content
                }
            });
            _logger.LogDebug($"Count photo added. StockCountId: {stockCountId}, PhotoId: {result.Id}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/{stockCountId:guid}/photos/{photoId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaStockCountPhoto")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> GetPhoto([FromRoute] Guid stockCountId, [FromRoute] Guid photoId)
        {
            _logger.LogDebug($"Fetching count photo. StockCountId: {stockCountId}, PhotoId: {photoId}");
            SilaStockCountPhotoFileDto result = await _mediator.Send(new GetSilaStockCountPhotoQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                StockCountId = stockCountId,
                PhotoId = photoId
            });
            _logger.LogDebug($"Count photo fetched. PhotoId: {photoId}, Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/shortages")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaShortageReport")]
        [SwaggerResponse(200, type: typeof(SilaShortageReportDto))]
        public async Task<IActionResult> Shortages([FromQuery] SilaShortageReportFilterDto filter, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching shortage report. From: {filter.From:yyyy-MM-dd}, To: {filter.To:yyyy-MM-dd}, LocationId: {filter.LocationId}");
            SilaShortageReportDto result = await _mediator.Send(new GetSilaShortageReportQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Filter = filter,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Shortage report fetched. Lines: {result.TotalLines}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/stock-counts/shortages/export")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("ExportSilaShortageReport")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> ExportShortages([FromQuery] SilaShortageReportFilterDto filter)
        {
            _logger.LogDebug($"Exporting shortage report. From: {filter.From:yyyy-MM-dd}, To: {filter.To:yyyy-MM-dd}, LocationId: {filter.LocationId}");
            SilaExcelFileDto result = await _mediator.Send(new ExportSilaShortageReportQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Filter = filter
            });
            _logger.LogDebug($"Shortage report exported. Bytes: {result.Content.Length}");
            return File(result.Content, EXCEL_CONTENT_TYPE, result.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/stock-counts/shortages/send")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("SendSilaShortageReport")]
        [SwaggerResponse(200, type: typeof(SilaShortageReportSendResultDto))]
        public async Task<IActionResult> SendShortages([FromBody] SilaShortageReportSendDto request)
        {
            _logger.LogDebug($"Sending shortage report. From: {request.From:yyyy-MM-dd}, Recipients: {request.ToEmails?.Count}");
            SilaShortageReportSendResultDto result = await _mediator.Send(new SendSilaShortageReportCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Shortage report sent. Sent: {result.Sent}, Recipients: {result.Recipients}");
            return Ok(result);
        }
    }
}

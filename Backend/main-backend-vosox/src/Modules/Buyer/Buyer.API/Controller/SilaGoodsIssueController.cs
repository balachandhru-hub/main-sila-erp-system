using Buyer.Application.Features.Commands.CreateSilaGoodsIssue;
using Buyer.Application.Features.Queries.GetSilaGoodsIssue;
using Buyer.Application.Features.Queries.GetSilaGoodsIssueFromBucket;
using Buyer.Application.Features.Queries.GetSilaGoodsIssues;
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
    /// <summary>SILA ME goods issues from a store to an outlet, optionally prefilled from the outlet's weekly bucket.</summary>
    [ApiController]
    public class SilaGoodsIssueController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaGoodsIssueController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/goods-issues")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaGoodsIssues")]
        [SwaggerResponse(200, type: typeof(List<SilaGoodsIssueListItemDto>))]
        public async Task<IActionResult> List([FromQuery] Guid? locationId, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching goods issues. LocationId: {locationId}, Index: {index}, Limit: {limit}");
            List<SilaGoodsIssueListItemDto> result = await _mediator.Send(new GetSilaGoodsIssuesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Goods issues fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/goods-issues/from-bucket")]
        [ApiAuthorization(Name = "POST_SILA_GOODS_ISSUE")]
        [SwaggerOperation("GetSilaGoodsIssueFromBucket")]
        [SwaggerResponse(200, type: typeof(SilaGoodsIssueBucketDto))]
        public async Task<IActionResult> FromBucket([FromQuery] Guid outletLocationId)
        {
            _logger.LogDebug($"Fetching weekly bucket lines for a goods issue. OutletLocationId: {outletLocationId}");
            SilaGoodsIssueBucketDto result = await _mediator.Send(new GetSilaGoodsIssueFromBucketQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                OutletLocationId = outletLocationId
            });
            _logger.LogDebug($"Weekly bucket lines fetched. BucketCode: {result.BucketCode}, Lines: {result.Lines.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/goods-issues/{goodsIssueId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaGoodsIssue")]
        [SwaggerResponse(200, type: typeof(SilaGoodsIssueDetailDto))]
        public async Task<IActionResult> Get([FromRoute] Guid goodsIssueId)
        {
            _logger.LogDebug($"Fetching goods issue. GoodsIssueId: {goodsIssueId}");
            SilaGoodsIssueDetailDto result = await _mediator.Send(new GetSilaGoodsIssueQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                GoodsIssueId = goodsIssueId
            });
            _logger.LogDebug($"Goods issue fetched. IssueNumber: {result.IssueNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/goods-issues")]
        [ApiAuthorization(Name = "POST_SILA_GOODS_ISSUE")]
        [SwaggerOperation("CreateSilaGoodsIssue")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaGoodsIssueWriteDto request)
        {
            _logger.LogDebug($"Creating goods issue. From: {request.FromLocationId}, To: {request.ToLocationId}");
            Guid id = await _mediator.Send(new CreateSilaGoodsIssueCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Goods issue posted. GoodsIssueId: {id}");
            return Ok(new SuccessResponseDto
            {
                Id = id.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Goods issue posted."
            });
        }
    }
}

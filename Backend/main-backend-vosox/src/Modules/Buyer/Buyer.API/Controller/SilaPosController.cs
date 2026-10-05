using Buyer.Application.Features.Commands.DiscardSilaPosBatch;
using Buyer.Application.Features.Commands.ProcessSilaPosBatch;
using Buyer.Application.Features.Commands.PullSilaPosSales;
using Buyer.Application.Features.Commands.ReprocessSilaPosTransaction;
using Buyer.Application.Features.Commands.UploadSilaPosSales;
using Buyer.Application.Features.Queries.GetSilaPosBatch;
using Buyer.Application.Features.Queries.GetSilaPosBatches;
using Buyer.Application.Features.Queries.GetSilaPosTransaction;
using Buyer.Application.Features.Queries.GetSilaPosTransactions;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME POS sales: sales file upload (preview, then process), POS API pull (one step), batches, and the transaction
    /// tracker with the transaction detail and reprocess.
    /// </summary>
    [ApiController]
    public class SilaPosController : BaseController
    {
        private const long MAX_FILE_BYTES = 10 * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaPosController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/batches")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("GetSilaPosBatches")]
        [SwaggerResponse(200, type: typeof(List<SilaPosBatchDto>))]
        public async Task<IActionResult> Batches([FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching POS batches. Index: {index}, Limit: {limit}");
            List<SilaPosBatchDto> result = await _mediator.Send(new GetSilaPosBatchesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"POS batches fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/batches")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("UploadSilaPosSales")]
        [SwaggerResponse(200, type: typeof(SilaPosPreviewDto))]
        public async Task<IActionResult> Upload(IFormFile file, [FromQuery] Guid? posSourceId)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError("POS sales upload without a file.");
                throw new BadRequestCustomException("A file is required.", "Choose a .csv or .xlsx sales file to upload.");
            }

            if (file.Length > MAX_FILE_BYTES)
            {
                _logger.LogError($"POS sales file too large. Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a sales file of at most 10 MB.");
            }

            _logger.LogDebug($"Previewing POS sales. FileName: {file.FileName}, Bytes: {file.Length}, PosSourceId: {posSourceId}");
            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            SilaPosPreviewDto result = await _mediator.Send(new UploadSilaPosSalesCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                PosSourceId = posSourceId,
                FileName = file.FileName,
                Content = stream.ToArray()
            });
            _logger.LogDebug($"POS sales previewed. BatchNumber: {result.BatchNumber}, Valid: {result.ValidRows}, Ready: {result.ReadyToProcess}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/batches/{batchId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("GetSilaPosBatch")]
        [SwaggerResponse(200, type: typeof(SilaPosBatchDto))]
        public async Task<IActionResult> Batch([FromRoute] Guid batchId)
        {
            _logger.LogDebug($"Fetching POS batch. BatchId: {batchId}");
            SilaPosBatchDto result = await _mediator.Send(new GetSilaPosBatchQuery { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), BatchId = batchId });
            _logger.LogDebug($"POS batch fetched. BatchNumber: {result.BatchNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/batches/{batchId}/process")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("ProcessSilaPosBatch")]
        [SwaggerResponse(200, type: typeof(SilaPosImportResultDto))]
        public async Task<IActionResult> Process([FromRoute] Guid batchId)
        {
            _logger.LogDebug($"Processing POS batch. BatchId: {batchId}");
            SilaPosImportResultDto result = await _mediator.Send(new ProcessSilaPosBatchCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), BatchId = batchId });
            _logger.LogDebug($"POS batch processed. BatchNumber: {result.BatchNumber}, Processed: {result.Processed}, Failed: {result.Failed}");
            return Ok(result);
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/pos/batches/{batchId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("DiscardSilaPosBatch")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Discard([FromRoute] Guid batchId)
        {
            _logger.LogDebug($"Discarding POS batch. BatchId: {batchId}");
            await _mediator.Send(new DiscardSilaPosBatchCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), BatchId = batchId });
            _logger.LogDebug($"POS batch discarded. BatchId: {batchId}");
            return Ok(new SuccessResponseDto { Id = batchId.ToString(), StatusCode = 200, Message = "Success", Description = "Upload discarded." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/pull")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("PullSilaPosSales")]
        [SwaggerResponse(200, type: typeof(SilaPosImportResultDto))]
        public async Task<IActionResult> Pull()
        {
            _logger.LogDebug("Pulling POS sales from the POS API.");
            SilaPosImportResultDto result = await _mediator.Send(new PullSilaPosSalesCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });
            _logger.LogDebug($"POS sales pulled. BatchNumber: {result.BatchNumber}, Accepted: {result.Accepted}, Failed: {result.Failed}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/transactions")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("GetSilaPosTransactions")]
        [SwaggerResponse(200, type: typeof(SilaPosTransactionPageDto))]
        public async Task<IActionResult> Transactions(
            [FromQuery] string? status,
            [FromQuery] DateTime? businessDate,
            [FromQuery] Guid? outletLocationId,
            [FromQuery] Guid? batchId,
            [FromQuery] Guid? materialId,
            [FromQuery] string? postingStatus,
            [FromQuery] string? search,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching POS transactions. Status: {status}, PostingStatus: {postingStatus}, BusinessDate: {businessDate}, MaterialId: {materialId}, Search: {search}");
            SilaPosTransactionPageDto result = await _mediator.Send(new GetSilaPosTransactionsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                BusinessDate = businessDate,
                OutletLocationId = outletLocationId,
                BatchId = batchId,
                MaterialId = materialId,
                PostingStatus = postingStatus,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"POS transactions fetched. Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/transactions/{transactionId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("GetSilaPosTransaction")]
        [SwaggerResponse(200, type: typeof(SilaPosTransactionDetailDto))]
        public async Task<IActionResult> Transaction([FromRoute] Guid transactionId)
        {
            _logger.LogDebug($"Fetching POS transaction. TransactionId: {transactionId}");
            SilaPosTransactionDetailDto result = await _mediator.Send(new GetSilaPosTransactionQuery { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), TransactionId = transactionId });
            _logger.LogDebug($"POS transaction fetched. TransactionId: {transactionId}, Lines: {result.Lines.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/transactions/{transactionId}/reprocess")]
        [ApiAuthorization(Name = "MANAGE_SILA_POS")]
        [SwaggerOperation("ReprocessSilaPosTransaction")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Reprocess([FromRoute] Guid transactionId)
        {
            _logger.LogDebug($"Reprocessing POS transaction. TransactionId: {transactionId}");
            await _mediator.Send(new ReprocessSilaPosTransactionCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransactionId = transactionId
            });
            _logger.LogDebug($"POS transaction reprocessed. TransactionId: {transactionId}");
            return Ok(new SuccessResponseDto { Id = transactionId.ToString(), StatusCode = 200, Message = "Success", Description = "Transaction reprocessed." });
        }
    }
}

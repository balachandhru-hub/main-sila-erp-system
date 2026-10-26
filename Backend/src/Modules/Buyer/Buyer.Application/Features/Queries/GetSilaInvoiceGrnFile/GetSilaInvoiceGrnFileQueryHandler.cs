using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceGrnFile
{
    public class GetSilaInvoiceGrnFileQueryHandler : IRequestHandler<GetSilaInvoiceGrnFileQuery, SilaInvoiceFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public GetSilaInvoiceGrnFileQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SilaInvoiceFileDto> Handle(GetSilaInvoiceGrnFileQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching GRN PDF. InvoiceId: {request.InvoiceId}, GoodsReceiptId: {request.GoodsReceiptId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            string receiptKey = request.GoodsReceiptId.ToString("N");
            InventoryWorkflowEvent? stored = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Action == SilaGrnDocument.ACTION
                    && x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoice.Id
                    && x.Comment != null && x.Comment.Contains(receiptKey))
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
            string? fullPath = stored == null ? null : SilaFileRules.ResolveUnderRoot(_configuration[Common.BASE_FOLDER_PATH], stored.Comment);
            if (fullPath == null || !File.Exists(fullPath))
            {
                _logger.LogError($"GRN PDF is missing. InvoiceId: {invoice.Id}, GoodsReceiptId: {request.GoodsReceiptId}");
                throw new NotFoundCustomException("GRN PDF not found.", "The goods receipt PDF is not stored on this invoice yet.");
            }

            GoodsReceipt? receipt = await _repository.GoodsReceipt.FindFirstByConditionAsync(x => x.Id == request.GoodsReceiptId && x.BuyerId == buyer.Id);
            byte[] content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            _logger.LogInfo($"GRN PDF fetched. InvoiceId: {invoice.Id}, Bytes: {content.Length}");
            return new SilaInvoiceFileDto
            {
                FileName = SilaFileRules.SafeDisplayName(receipt == null ? "grn.pdf" : receipt.GrnNumber + ".pdf", "grn", ".pdf"),
                ContentType = "application/pdf",
                Content = content
            };
        }
    }
}

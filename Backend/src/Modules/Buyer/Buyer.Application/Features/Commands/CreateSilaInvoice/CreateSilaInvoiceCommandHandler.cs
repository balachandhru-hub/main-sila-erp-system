using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaInvoice
{
    public class CreateSilaInvoiceCommandHandler : IRequestHandler<CreateSilaInvoiceCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public CreateSilaInvoiceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<Guid> Handle(CreateSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            SilaCreateInvoiceRequestDto body = request.Request;
            bool nonPo = SilaInvoiceCreation.IsNonPo(body.CreationType);
            string creationType = nonPo ? Common.SILA_INVOICE_CREATION_NON_PO : Common.SILA_INVOICE_CREATION_PO;
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string? company = await SilaInvoiceCreation.ResolveCompanyCodeAsync(_repository, buyer.Id, body.PropertyId, body.CompanyCode, cancellationToken);
            if (string.IsNullOrWhiteSpace(company))
            {
                throw new BadRequestCustomException("Company code is required.", "Select a property or company code.");
            }

            if (body.SilaSupplierId == null && body.SupplierId == null && string.IsNullOrWhiteSpace(body.SupplierName))
            {
                throw new BadRequestCustomException("Supplier is required.", "Select a supplier.");
            }

            if (body.Content == null || body.Content.Length == 0)
            {
                throw new BadRequestCustomException("An invoice attachment is required.", "Upload one PDF, JPEG or PNG.");
            }

            Guid invoiceId = Guid.NewGuid();
            string kind = SilaFileRules.Validate(
                _logger, "Invoice", body.FileName ?? "invoice.pdf", body.Content,
                new[] { SilaFileRules.KIND_PDF, SilaFileRules.KIND_JPEG, SilaFileRules.KIND_PNG }, SilaReceivingRules.MAX_INVOICE_BYTES);
            string basePath = _configuration[Common.BASE_FOLDER_PATH] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(basePath))
            {
                throw new FailedDependencyCustomException("File storage is not configured.", "Ask your administrator to configure the local downloads path.");
            }

            SilaOcrConfiguration storage = await SilaOcrSettings.GetAsync(_repository, buyer.Id, cancellationToken);
            string? writeRoot = SilaOcrPolicy.AttachmentWriteRoot(storage, basePath);
            string storedName = SilaFileRules.StoredName(invoiceId, kind);
            string relativePath = Path.Combine(Common.SILA_INVOICE_FOLDER, invoiceId.ToString(), storedName);
            string? fullPath = SilaFileRules.ResolveUnderRoot(writeRoot, relativePath);
            if (fullPath == null)
            {
                throw new FailedDependencyCustomException("File storage is not configured.", "Ask your administrator to check the file storage folder.");
            }

            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllBytesAsync(fullPath, body.Content, cancellationToken);
            string fileName = SilaFileRules.SafeDisplayName(body.FileName, $"invoice-{DateTime.UtcNow:yyyyMMddHHmmss}", kind);

            DateTime invoiceDate = body.InvoiceDate?.Date ?? DateTime.UtcNow.Date;
            Invoice invoice = new Invoice
            {
                Id = invoiceId,
                BuyerId = buyer.Id,
                CreationType = creationType,
                CompanyCode = company,
                PropertyId = body.PropertyId,
                InvoiceNumber = string.IsNullOrWhiteSpace(body.InvoiceNumber) ? null : body.InvoiceNumber.Trim(),
                SupplierId = body.SupplierId,
                SilaSupplierId = body.SilaSupplierId,
                SupplierName = body.SupplierName?.Trim(),
                InvoiceDate = invoiceDate,
                Currency = string.IsNullOrWhiteSpace(body.Currency) ? null : body.Currency.Trim(),
                GrossAmount = body.GrossAmount,
                NetAmount = body.NetAmount,
                TaxAmount = body.TaxAmount,
                PurchaseOrderId = nonPo ? null : body.PurchaseOrderId,
                InvoiceType = nonPo ? "SERVICE" : "MATERIAL",
                FilePath = relativePath,
                FileName = fileName,
                Status = Common.SILA_INVOICE_REVIEWED,
                UploadedBy = request.UserId,
                IsActive = true,
                CreatedBy = request.UserId,
                UpdatedBy = request.UserId,
                DateCreated = DateTime.UtcNow,
                DateUpdated = DateTime.UtcNow
            };

            if (!nonPo && body.PurchaseOrderId != null)
            {
                PurchaseOrder? order = await _repository.PurchaseOrder.FindFirstByConditionAsync(
                    x => x.Id == body.PurchaseOrderId && x.BuyerId == buyer.Id && x.IsActive);
                invoice.PoNumber = order?.PoNumber;
                invoice.Currency ??= order?.Currency;
            }

            _repository.Invoice.Create(invoice);
            await _repository.SaveAsync();
            _logger.LogInfo($"Create Invoice draft stored. InvoiceId: {invoice.Id}, CreationType: {creationType}, CompanyCode: {company}");
            return invoice.Id;
        }
    }
}

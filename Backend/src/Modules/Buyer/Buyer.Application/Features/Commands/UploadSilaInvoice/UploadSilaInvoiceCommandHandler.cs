using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Application.Features.Commands.ExtractSilaInvoice;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UploadSilaInvoice
{
    public class UploadSilaInvoiceCommandHandler : IRequestHandler<UploadSilaInvoiceCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;
        private readonly IMediator _mediator;

        public UploadSilaInvoiceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
            _mediator = mediator;
        }

        public async Task<Guid> Handle(UploadSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            SilaInvoiceUploadDto file = request.Request;
            _logger.LogInfo($"Uploading invoice. OrganizationId: {request.OrganizationId}, FileName: {file.FileName}, Bytes: {file.Content.Length}");

            string kind = SilaFileRules.Validate(
                _logger, "Invoice", file.FileName, file.Content,
                new[] { SilaFileRules.KIND_PDF, SilaFileRules.KIND_JPEG, SilaFileRules.KIND_PNG }, SilaReceivingRules.MAX_INVOICE_BYTES);

            string basePath = _configuration[Common.BASE_FOLDER_PATH] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(basePath))
            {
                _logger.LogError("FolderPath:BasePath is not configured.");
                throw new FailedDependencyCustomException("File storage is not configured.", "Ask your administrator to configure the file storage folder.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Guid invoiceId = Guid.NewGuid();
            // The stored name is generated (Guid + safe extension); the client's name is only kept for display.
            string storedName = SilaFileRules.StoredName(invoiceId, kind);
            string relativePath = Path.Combine(Common.SILA_INVOICE_FOLDER, invoiceId.ToString(), storedName);
            string? fullPath = SilaFileRules.ResolveUnderRoot(basePath, relativePath);
            if (fullPath == null)
            {
                _logger.LogError($"Invoice storage path leaves the storage folder. InvoiceId: {invoiceId}");
                throw new FailedDependencyCustomException("File storage is not configured.", "Ask your administrator to check the file storage folder.");
            }

            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllBytesAsync(fullPath, file.Content, cancellationToken);
            string fileName = SilaFileRules.SafeDisplayName(file.FileName, $"invoice-{DateTime.UtcNow:yyyyMMddHHmmss}", kind);

            Invoice invoice = new Invoice
            {
                Id = invoiceId,
                BuyerId = buyer.Id,
                FilePath = relativePath,
                FileName = fileName,
                Status = Common.SILA_INVOICE_UPLOADED,
                UploadedBy = request.UserId,
                IsActive = true
            };
            _repository.Invoice.Create(invoice);
            await _repository.SaveAsync();

            _logger.LogInfo($"Invoice uploaded. InvoiceId: {invoice.Id}, BuyerId: {buyer.Id}");

            // Automatic reading (OCR settings): the upload stands even when the reading fails; the failure is in the history.
            SilaOcrConfiguration settings = await SilaOcrSettings.GetAsync(_repository, buyer.Id, cancellationToken);
            if (settings.AutoExtractOnUpload)
            {
                try
                {
                    await _mediator.Send(new ExtractSilaInvoiceCommand
                    {
                        OrganizationId = request.OrganizationId,
                        UserId = request.UserId,
                        InvoiceId = invoice.Id,
                        Trigger = SilaOcrSettings.TRIGGER_UPLOAD
                    }, cancellationToken);
                }
                catch (BaseCustomException exception)
                {
                    _logger.LogError($"Automatic invoice reading failed. InvoiceId: {invoice.Id}, HttpStatus: {exception.Code}");
                }
            }

            return invoice.Id;
        }
    }
}

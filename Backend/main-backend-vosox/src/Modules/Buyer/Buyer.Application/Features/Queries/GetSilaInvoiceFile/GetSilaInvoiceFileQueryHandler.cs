using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceFile
{
    public class GetSilaInvoiceFileQueryHandler : IRequestHandler<GetSilaInvoiceFileQuery, SilaInvoiceFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public GetSilaInvoiceFileQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SilaInvoiceFileDto> Handle(GetSilaInvoiceFileQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoice file. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            string? fullPath = SilaFileRules.ResolveUnderRoot(_configuration[Common.BASE_FOLDER_PATH], invoice.FilePath);
            if (fullPath == null || !File.Exists(fullPath))
            {
                _logger.LogError($"Invoice file is missing. InvoiceId: {invoice.Id}");
                throw new NotFoundCustomException("Invoice file not found.", "The stored file of this invoice is missing. Upload the invoice again.");
            }

            byte[] content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            _logger.LogInfo($"Invoice file fetched. InvoiceId: {invoice.Id}, Bytes: {content.Length}");
            // The stored type decides the content type; the download name is cleaned of path and quote characters.
            string kind = SilaFileRules.KindOf(invoice.FilePath) ?? SilaFileRules.KindOf(invoice.FileName) ?? string.Empty;
            return new SilaInvoiceFileDto
            {
                FileName = SilaFileRules.SafeDisplayName(invoice.FileName, $"invoice-{invoice.Id:N}", kind),
                ContentType = SilaFileRules.ContentTypeOf(kind),
                Content = content
            };
        }
    }
}

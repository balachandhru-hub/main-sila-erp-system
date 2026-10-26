using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessSilaInvoiceAttachment
{
    public class ReprocessSilaInvoiceAttachmentCommandHandler : IRequestHandler<ReprocessSilaInvoiceAttachmentCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;
        private readonly IConfiguration _configuration;

        public ReprocessSilaInvoiceAttachmentCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
            _configuration = configuration;
        }

        public async Task<SilaInvoiceDetailDto> Handle(ReprocessSilaInvoiceAttachmentCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reprocessing invoice attachment. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            await SilaInvoiceAttachment.ReprocessAsync(
                _repository, _logger, _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE], invoice, request.UserId, cancellationToken);
            _logger.LogInfo($"Invoice attachment reprocess finished. InvoiceId: {invoice.Id}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }
    }
}

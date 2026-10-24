using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;

namespace Buyer.Application.Features.Commands.RemoveSilaInvoiceAttachment
{
    public class RemoveSilaInvoiceAttachmentCommandHandler : IRequestHandler<RemoveSilaInvoiceAttachmentCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly SharedKernel.LoggerServices.ILoggerManager _logger;

        public RemoveSilaInvoiceAttachmentCommandHandler(IRepositoryWrapper repository, SharedKernel.LoggerServices.ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(RemoveSilaInvoiceAttachmentCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Removing user invoice attachment. InvoiceId: {request.InvoiceId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            InventoryErpPosting? posting = invoice.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == buyer.Id);
            SilaInvoiceUserAttachment.Remove(_repository, invoice, posting, request.UserId);
            await _repository.SaveAsync();
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }
    }
}

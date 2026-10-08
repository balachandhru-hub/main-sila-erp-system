using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RejectSilaTransfer
{
    /// <summary>The source location refuses a pending transfer. A comment is required.</summary>
    public class RejectSilaTransferCommandHandler : IRequestHandler<RejectSilaTransferCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public RejectSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(RejectSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Rejecting transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            if (string.IsNullOrWhiteSpace(request.Request.Comment))
            {
                _logger.LogError($"Reject comment is missing. TransferId: {request.TransferId}");
                throw new BadRequestCustomException("A comment is required.", "Enter why the transfer is rejected.");
            }

            SilaTransferRules.ValidateComment(_logger, request.Request.Comment);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            SilaTransferRules.EnsureStatus(_logger, transfer, "rejected", Common.SILA_ITO_PENDING_APPROVAL);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);

            string comment = request.Request.Comment.Trim();
            transfer.Status = Common.SILA_ITO_REJECTED;
            transfer.ApprovedBy = request.UserId;
            transfer.ApprovedOn = DateTime.UtcNow;
            transfer.Comment = comment;

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_REJECTED, comment);
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer rejected. TransferId: {transfer.Id}");
            return Unit.Value;
        }
    }
}

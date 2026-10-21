using Buyer.Application.Features.Commands.ReprocessPurchaseOrder;
using Buyer.Application.Features.Commands.ReprocessSilaErpPosting;
using Buyer.Application.Features.Commands.ReprocessSilaPosTransaction;
using Buyer.Application.Features.Commands.RunIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessSilaTracker
{
    public class ReprocessSilaTrackerCommand : IRequest<SilaTrackerReprocessResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public List<string> Ids { get; set; } = new List<string>();
    }

    /// <summary>
    /// Continues each selected transaction from the stage that failed. A confirmed ERP document is never sent again.
    /// Unknown ERP results are left for reconciliation.
    /// </summary>
    public class ReprocessSilaTrackerCommandHandler : IRequestHandler<ReprocessSilaTrackerCommand, SilaTrackerReprocessResultDto>
    {
        private const int MAX_IDS = 25;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public ReprocessSilaTrackerCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public async Task<SilaTrackerReprocessResultDto> Handle(ReprocessSilaTrackerCommand request, CancellationToken cancellationToken)
        {
            if (request.Ids.Count == 0 || request.Ids.Count > MAX_IDS)
            {
                throw new BadRequestCustomException("Select transactions to reprocess.", $"Choose between 1 and {MAX_IDS} transactions.");
            }

            SilaTrackerReprocessResultDto result = new SilaTrackerReprocessResultDto();
            HashSet<Guid> resumedPostings = new HashSet<Guid>();
            foreach (string id in request.Ids.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    string message = await OneAsync(request, id, resumedPostings, cancellationToken);
                    result.Eligible++;
                    result.Completed++;
                    result.Messages.Add(message);
                }
                catch (BaseCustomException exception)
                {
                    result.Ineligible++;
                    result.Failed++;
                    result.Messages.Add(exception.Description ?? exception.Message);
                }
            }

            return result;
        }

        private async Task<string> OneAsync(ReprocessSilaTrackerCommand request, string id, HashSet<Guid> resumedPostings, CancellationToken cancellationToken)
        {
            if (!SilaTrackerRules.TryParseKey(id, out string source, out Guid key))
            {
                throw new BadRequestCustomException("Transaction is not eligible.", "The selected row is not a tracked transaction.");
            }

            return source switch
            {
                SilaTrackerRules.SOURCE_ERP => await ErpAsync(request, key, cancellationToken),
                SilaTrackerRules.SOURCE_LEDGER => await LedgerAsync(request, key, resumedPostings, cancellationToken),
                SilaTrackerRules.SOURCE_POS => await PosAsync(request, key, cancellationToken),
                SilaTrackerRules.SOURCE_PO => await PurchaseAsync(request, key, cancellationToken),
                _ => await RunAsync(request, key, cancellationToken)
            };
        }

        private async Task<string> LedgerAsync(ReprocessSilaTrackerCommand request, Guid id, HashSet<Guid> resumedPostings, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryTransaction? line = await _repository.InventoryTransaction.FindFirstByConditionAsync(x => x.Id == id && x.BuyerId == buyer.Id && x.IsActive);
            if (line == null)
            {
                throw new BadRequestCustomException("Transaction cannot be reprocessed.", "This inventory transaction is not on the tracker.");
            }

            InventoryErpPosting? posting = await _repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.ReferenceType == line.ReferenceType && x.ReferenceId == line.ReferenceId)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
            if (posting == null)
            {
                throw new BadRequestCustomException("Transaction cannot be reprocessed.", "This inventory transaction has no ERP posting to continue.");
            }

            if (!resumedPostings.Add(posting.Id))
            {
                return line.TransactionNumber + " uses the same ERP posting as another selected line. SAP is called once.";
            }

            string message = await ErpAsync(request, posting.Id, cancellationToken);
            return line.TransactionNumber + " " + message;
        }

        private async Task<string> ErpAsync(ReprocessSilaTrackerCommand request, Guid id, CancellationToken cancellationToken)
        {
            await _mediator.Send(new ReprocessSilaErpPostingCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                PostingId = id
            }, cancellationToken);
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == id);
            bool local = posting != null && (posting.Status == Common.SILA_POSTING_POSTED || posting.Status == Common.SILA_POSTING_FAILED_LOCAL) && !string.IsNullOrWhiteSpace(posting.ErpReference);
            return local
                ? $"{posting!.ReferenceNumber} resumed from local finalization. SAP was not called."
                : $"{posting?.ReferenceNumber ?? id.ToString()} resumed from ERP processing.";
        }

        private async Task<string> PosAsync(ReprocessSilaTrackerCommand request, Guid id, CancellationToken cancellationToken)
        {
            await _mediator.Send(new ReprocessSilaPosTransactionCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                RoleId = request.RoleId,
                TransactionId = id
            }, cancellationToken);
            return "The POS transaction resumed from the failed stage. A confirmed SAP document is not sent again.";
        }

        private async Task<string> PurchaseAsync(ReprocessSilaTrackerCommand request, Guid id, CancellationToken cancellationToken)
        {
            PurchaseDocumentIntegration? document = await _repository.PurchaseDocumentIntegration
                .FindFirstByConditionAsync(x => x.Id == id && x.BuyerOrganizationId == request.OrganizationId && x.IsActive);
            if (document?.PurchaseOrderId == null)
            {
                throw new BadRequestCustomException("Transaction cannot be reprocessed.", "This purchasing hand-off has no purchase order to continue.");
            }

            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPurchase(document.Status, document.OutcomeUnknown, document.ExternalDocumentNumber, document.RetryCount);
            if (stages.Action == SilaTrackerRules.ACTION_RECONCILE || stages.Erp == SilaTrackerRules.UNKNOWN)
            {
                throw new BadRequestCustomException("Reconcile this transaction.", "The ERP result is unknown. Confirm it in SAP before anything is sent again.");
            }

            if (stages.ReprocessFrom == SilaTrackerRules.FROM_LOCAL)
            {
                PurchaseOrder? order = await _repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == document.PurchaseOrderId);
                if (order != null && string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId) && !string.IsNullOrWhiteSpace(document.ExternalDocumentNumber))
                {
                    order.ErpPurchaseOrderId = document.ExternalDocumentNumber;
                    _repository.PurchaseOrder.Update(order);
                }

                document.Status = Common.INTEGRATION_SUCCEEDED;
                document.OutcomeUnknown = false;
                _repository.PurchaseDocumentIntegration.Update(document);
                await RecordAsync(request, document.Id, stages.ReprocessFrom, document.ErrorMessage, false, true, "Local purchase-order number restored. SAP was not called.");
                await _repository.SaveAsync();
                return $"{order?.PoNumber ?? document.ExternalDocumentNumber} resumed from local finalization. SAP was not called.";
            }

            if (!stages.ErpCallAllowed)
            {
                throw new BadRequestCustomException("Transaction cannot be reprocessed.", "This purchasing hand-off is not waiting for an ERP call.");
            }

            string? previous = document.ErrorMessage;
            await _mediator.Send(new ReprocessPurchaseOrderCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                PurchaseOrderId = document.PurchaseOrderId.Value
            }, cancellationToken);
            await RecordAsync(request, document.Id, SilaTrackerRules.FROM_ERP, previous, true, true, "ERP hand-off continued. A leg that already succeeded is not sent again.");
            await _repository.SaveAsync();
            return "The purchase order resumed from the ERP stage. A hand-off that already succeeded was not sent again.";
        }

        private async Task<string> RunAsync(ReprocessSilaTrackerCommand request, Guid id, CancellationToken cancellationToken)
        {
            ApiIntegrationExecution? execution = await _repository.ApiIntegrationExecution.FindFirstByConditionAsync(x => x.Id == id);
            if (execution == null)
            {
                throw new NotFoundCustomException("Transaction not found.", "The integration run no longer exists.");
            }

            ApiIntegrationConfiguration? configuration = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.Id == execution.ConfigurationId && IntegrationLookup.BuyerIdsOf(_repository, request.OrganizationId).Contains(x.BuyerId))
                .FirstOrDefaultAsync(cancellationToken);
            if (configuration == null)
            {
                throw new NotFoundCustomException("Transaction not found.", "The integration run belongs to another organization.");
            }

            SilaTrackerRules.Stages stages = SilaTrackerRules.OfRun(execution.Status.ToString(), execution.RecordsRead, execution.RecordsFailed, execution.Trigger.ToString());
            if (!stages.ErpCallAllowed || stages.Action != SilaTrackerRules.ACTION_REPROCESS)
            {
                throw new BadRequestCustomException(
                    "Run cannot be repeated automatically.",
                    "The external system already returned data, or this was a connection test. The failed run is kept. Start a new pull from Integration only after checking the failed records.");
            }

            await _mediator.Send(new RunIntegrationCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                ConfigurationId = configuration.Id,
                Trigger = IntegrationExecutionTrigger.RETRY
            }, cancellationToken);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            _repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                ReferenceType = "INTEGRATION_RUN",
                ReferenceId = execution.Id,
                Action = SilaTrackerRules.EVENT_REPROCESS,
                Comment = $"Stage=ERP; ErpCalled=Yes; LocalCalled=Yes; Previous={execution.ErrorMessageSafe}; Result=A new pull was started. This failed run was kept.",
                ActorUserId = request.UserId,
                IsActive = true
            });
            await _repository.SaveAsync();
            return $"{configuration.Name} started a new pull. The failed run was kept.";
        }

        private async Task RecordAsync(ReprocessSilaTrackerCommand request, Guid id, string? stage, string? previous, bool erpCalled, bool localCalled, string result)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string comment = $"Stage={stage}; ErpCalled={(erpCalled ? "Yes" : "No")}; LocalCalled={(localCalled ? "Yes" : "No")}; Previous={previous}; Result={result}";
            _repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                ReferenceType = "PO_INTEGRATION",
                ReferenceId = id,
                Action = SilaTrackerRules.EVENT_REPROCESS,
                Comment = comment.Length > 1000 ? comment[..1000] : comment,
                ActorUserId = request.UserId,
                IsActive = true
            });
        }
    }
}

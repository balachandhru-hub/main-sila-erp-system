using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaPurchaseOrders
{
    /// <summary>
    /// One row per purchase order line (header fields repeated). The whole file is checked first; nothing is written when
    /// any row is invalid. Purchase orders already imported are updated (received lines are protected).
    /// </summary>
    public class ImportSilaPurchaseOrdersCommandHandler : IRequestHandler<ImportSilaPurchaseOrdersCommand, SilaMasterImportResultDto>
    {
        private const string SOURCE_SYSTEM_EXCEL = "EXCEL";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaPurchaseOrdersCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaMasterImportResultDto> Handle(ImportSilaPurchaseOrdersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing purchase orders. OrganizationId: {request.OrganizationId}, FileName: {request.FileName}, Bytes: {request.Content.Length}, Commit: {request.Commit}");
            List<Dictionary<string, string>> table = SilaReceivingExcel.Read(_logger, request.FileName, request.Content, SilaPurchaseOrderRows.RequiredColumns);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);

            List<SilaPoImportRowDto> rows = SilaPurchaseOrderRows.FromExcel(table);
            (List<SilaMasterImportRowDto> checkedRows, List<SilaPurchaseOrderSync.Plan> plans) =
                await SilaPurchaseOrderSync.CheckAsync(_repository, buyer.Id, rows, false, cancellationToken);
            SilaMasterImportResultDto result = SilaReceivingExcel.Summarize(request.FileName, checkedRows);
            if (request.Commit)
            {
                if (result.InvalidRows > 0)
                {
                    _logger.LogError($"Purchase order import refused. InvalidRows: {result.InvalidRows}, FileName: {request.FileName}");
                    throw new BadRequestCustomException("Import refused: the file has invalid rows.", SilaReceivingExcel.RefusalMessage(checkedRows));
                }

                SilaPurchaseOrderSync.Apply(_repository, buyer, plans, SOURCE_SYSTEM_EXCEL);
                await _repository.SaveAsync();
                result.Committed = true;
            }

            _logger.LogInfo($"Purchase order import {(result.Committed ? "done" : "checked")}. Rows: {result.TotalRows}, PurchaseOrders: {plans.Count}, Invalid: {result.InvalidRows}");
            return result;
        }
    }
}

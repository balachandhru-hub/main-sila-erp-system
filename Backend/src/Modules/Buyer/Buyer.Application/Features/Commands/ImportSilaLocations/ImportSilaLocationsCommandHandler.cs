using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaLocations
{
    /// <summary>
    /// Imports a previewed location Excel file: the file is checked again and saved only when every row is valid
    /// (all or nothing). New codes create locations, existing codes update them.
    /// </summary>
    public class ImportSilaLocationsCommandHandler : IRequestHandler<ImportSilaLocationsCommand, SilaLocationImportPreviewDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaLocationsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaLocationImportPreviewDto> Handle(ImportSilaLocationsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing locations. OrganizationId: {request.OrganizationId}, FileName: {request.FileName}, Bytes: {request.Content.Length}");

            if (!SilaLocationExcel.LooksLikeXlsx(request.Content))
            {
                _logger.LogError($"Location import file is not an xlsx workbook. FileName: {request.FileName}");
                throw new BadRequestCustomException("The file is not an Excel workbook.", "Upload the location file as .xlsx, starting from the downloaded template.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<string> fileErrors = new List<string>();
            List<(int RowNumber, Dictionary<string, string> Cells)> input = SilaLocationExcel.Read(request.Content, fileErrors);
            SilaLocationContext context = await SilaLocationRules.LoadContextAsync(_repository, buyer.Id, cancellationToken);
            (List<SilaLocationImportRowDto> rows, List<InventoryLocation> created, List<InventoryLocation> updated) = SilaLocationImport.Evaluate(input, context, buyer.Id);
            SilaLocationImportPreviewDto result = SilaLocationImport.ToPreview(request.FileName, rows, fileErrors);
            if (fileErrors.Count > 0 || result.InvalidRows > 0 || result.TotalRows == 0)
            {
                _logger.LogError($"Location import refused. FileErrors: {fileErrors.Count}, InvalidRows: {result.InvalidRows}, Rows: {result.TotalRows}");
                throw new BadRequestCustomException(
                    "The file has errors; nothing was imported.",
                    "Preview the file, fix the rows marked invalid and upload it again.");
            }

            foreach (InventoryLocation location in created)
            {
                _repository.InventoryLocation.Create(location);
            }

            if (updated.Count > 0)
            {
                _repository.InventoryLocation.UpdateRange(updated);
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_MASTER_DATA, buyer.Id, "LOCATIONS_IMPORTED", $"{request.FileName}: {created.Count} created, {updated.Count} updated");
            await _repository.SaveAsync();
            result.Imported = true;

            _logger.LogInfo($"Locations imported. BuyerId: {buyer.Id}, Created: {created.Count}, Updated: {updated.Count}");
            return result;
        }
    }
}

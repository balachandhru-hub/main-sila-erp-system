using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using ClosedXML.Excel;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaMaterials
{
    /// <summary>
    /// Reads the material Excel file (Materials + Conversions sheets), validates every row and, when confirmed and valid,
    /// updates the inventory fields, upserts the conversions and creates a price change request (approval) for every new
    /// unit price. The approved price is never overwritten by an import.
    /// </summary>
    public class ImportSilaMaterialsCommandHandler : IRequestHandler<ImportSilaMaterialsCommand, SilaMaterialImportResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaMaterialsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaMaterialImportResultDto> Handle(ImportSilaMaterialsCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ImportSilaMaterialsCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaMaterialImportResultDto> HandleOnceAsync(ImportSilaMaterialsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing materials. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, FileName: {request.FileName}, Bytes: {request.Content.Length}, Confirm: {request.Confirm}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            if (!string.Equals(Path.GetExtension(request.FileName ?? string.Empty), ".xlsx", StringComparison.OrdinalIgnoreCase)
                || !SilaMaterialExcel.LooksLikeXlsx(request.Content))
            {
                _logger.LogError($"Material import file is not an .xlsx workbook. FileName: {request.FileName}");
                throw new BadRequestCustomException("File type is not supported.", "Upload the material file as an .xlsx workbook (start from the template).");
            }

            SilaMaterialImportPlan plan = new SilaMaterialImportPlan();
            plan.Result.FileName = Path.GetFileName(request.FileName ?? string.Empty);
            List<SilaMaterialExcelRow> materialRows = new List<SilaMaterialExcelRow>();
            List<SilaConversionExcelRow> conversionRows = new List<SilaConversionExcelRow>();
            try
            {
                using MemoryStream stream = new MemoryStream(request.Content);
                using XLWorkbook workbook = new XLWorkbook(stream);
                SilaMaterialExcelReader.Read(workbook, plan.Result.FileErrors, materialRows, conversionRows);
            }
            catch (Exception exception) when (exception is not BaseCustomException)
            {
                _logger.LogError($"Material workbook cannot be read. FileName: {request.FileName}, Error: {SilaLogText.Short(exception.Message)}");
                throw new BadRequestCustomException("The Excel file cannot be read.", "Save the materials as an .xlsx workbook based on the downloaded template.");
            }

            if (plan.Result.FileErrors.Count == 0 && materialRows.Count == 0 && conversionRows.Count == 0)
            {
                plan.Result.FileErrors.Add("The file has no material or conversion rows.");
            }

            if (plan.Result.FileErrors.Count == 0)
            {
                await SilaMaterialImportValidator.ValidateAsync(_repository, _logger, buyer.Id, materialRows, conversionRows, plan, cancellationToken);
            }

            if (request.Confirm && plan.CanApply)
            {
                await ApplyAsync(buyer.Id, request.UserId, request.FileName ?? string.Empty, plan, cancellationToken);
            }

            _logger.LogInfo(
                $"Material import {(plan.Result.Applied ? "applied" : "previewed")}. Rows: {plan.Result.TotalRows}, Invalid: {plan.Result.InvalidRows}, Changed: {plan.Result.ChangedRows}, PriceChanges: {plan.Result.PriceChanges}, Conversions: {plan.Result.Conversions}, FileErrors: {plan.Result.FileErrors.Count}");
            return plan.Result;
        }

        private async Task ApplyAsync(Guid buyerId, Guid userId, string fileName, SilaMaterialImportPlan plan, CancellationToken cancellationToken)
        {
            foreach (ItemBuyerMaster material in plan.ChangedMaterials)
            {
                _repository.ItemBuyerMaster.Update(material);
            }

            if (plan.NewConversions.Count > 0)
            {
                _repository.MaterialUomConversion.CreateRange(plan.NewConversions);
            }

            if (plan.UpdatedConversions.Count > 0)
            {
                _repository.MaterialUomConversion.UpdateRange(plan.UpdatedConversions);
            }

            if (plan.PriceRows.Count > 0)
            {
                ApprovalScope scope = await SilaMaterialPricing.GetScopeAsync(_repository, buyerId, cancellationToken);
                foreach (SilaMaterialExcelRow row in plan.PriceRows)
                {
                    ItemBuyerMaster material = plan.Materials[row.MaterialCode];
                    await SilaMaterialPricing.CreateAsync(
                        _repository, _logger, buyerId, material, plan.Conversions, row.NewUnitPrice!.Value, row.Currency, row.PriceUom,
                        row.EffectiveFrom, row.PriceReason ?? $"Excel import {fileName}", userId, scope, cancellationToken);
                }
            }

            await _repository.SaveAsync();
            plan.Result.Applied = true;
        }
    }
}

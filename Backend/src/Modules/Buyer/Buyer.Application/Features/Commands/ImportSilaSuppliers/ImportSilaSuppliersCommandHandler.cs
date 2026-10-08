using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaSuppliers
{
    public class ImportSilaSuppliersCommandHandler : IRequestHandler<ImportSilaSuppliersCommand, SilaMasterImportResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaSuppliersCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaMasterImportResultDto> Handle(ImportSilaSuppliersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing suppliers. OrganizationId: {request.OrganizationId}, FileName: {request.FileName}, Bytes: {request.Content.Length}, Commit: {request.Commit}");
            List<Dictionary<string, string>> table = SilaReceivingExcel.Read(_logger, request.FileName, request.Content, new[] { "SupplierCode", "Name" });
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);

            List<(int RowNumber, SilaSupplierWriteDto Supplier)> rows = table
                .Select(row => (SilaReceivingExcel.RowNumber(row), new SilaSupplierWriteDto
                {
                    SupplierCode = SilaReceivingExcel.Value(row, "SupplierCode") ?? string.Empty,
                    Name = SilaReceivingExcel.Value(row, "Name") ?? string.Empty,
                    TaxNumber = SilaReceivingExcel.Value(row, "TaxNumber"),
                    Aliases = SilaReceivingExcel.Value(row, "Aliases") is string aliases ? new List<string> { aliases } : null,
                    Country = SilaReceivingExcel.Value(row, "Country"),
                    Status = SilaReceivingExcel.Value(row, "Status"),
                    LegalName = SilaReceivingExcel.Value(row, "LegalName"),
                    City = SilaReceivingExcel.Value(row, "City"),
                    Address = SilaReceivingExcel.Value(row, "Address"),
                    Currency = SilaReceivingExcel.Value(row, "Currency")
                }))
                .ToList();

            // The rows are classified without writing; an import writes only when every row is valid.
            List<SilaMasterImportRowDto> checkedRows = await SilaSupplierSync.UpsertAsync(_repository, buyer.Id, rows, false, cancellationToken);
            SilaMasterImportResultDto result = SilaReceivingExcel.Summarize(request.FileName, checkedRows);
            if (request.Commit)
            {
                if (result.InvalidRows > 0)
                {
                    _logger.LogError($"Supplier import refused. InvalidRows: {result.InvalidRows}, FileName: {request.FileName}");
                    throw new BadRequestCustomException("Import refused: the file has invalid rows.", SilaReceivingExcel.RefusalMessage(checkedRows));
                }

                await SilaSupplierSync.UpsertAsync(_repository, buyer.Id, rows, true, cancellationToken);
                await _repository.SaveAsync();
                result.Committed = true;
            }

            _logger.LogInfo($"Suppliers import {(result.Committed ? "done" : "checked")}. Rows: {result.TotalRows}, New: {result.NewRows}, Updated: {result.UpdateRows}, Invalid: {result.InvalidRows}");
            return result;
        }
    }
}

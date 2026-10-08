using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaCompanyCodes
{
    /// <summary>
    /// New codes are added, known codes get the name/country/currency of the file, deleted codes are brought back.
    /// Nothing is written unless every row is valid.
    /// </summary>
    public class ImportSilaCompanyCodesCommandHandler : IRequestHandler<ImportSilaCompanyCodesCommand, SilaMasterImportResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaCompanyCodesCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaMasterImportResultDto> Handle(ImportSilaCompanyCodesCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing company codes. OrganizationId: {request.OrganizationId}, FileName: {request.FileName}, Bytes: {request.Content.Length}, Commit: {request.Commit}");
            List<Dictionary<string, string>> table = SilaReceivingExcel.Read(_logger, request.FileName, request.Content, new[] { "Code", "Name" });
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);

            // Few rows per buyer: all of them are read once (valid changes are staged with Update when the file is imported).
            Dictionary<string, CompanyCodeMaster> existing = (await _repository.CompanyCodeMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id)
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            List<SilaMasterImportRowDto> rows = new List<SilaMasterImportRowDto>();
            List<(SilaCompanyCodeWriteDto Input, CompanyCodeMaster? Current)> changes = new List<(SilaCompanyCodeWriteDto, CompanyCodeMaster?)>();
            foreach (Dictionary<string, string> cells in table)
            {
                SilaCompanyCodeWriteDto input = SilaMasterDataRules.Normalize(new SilaCompanyCodeWriteDto
                {
                    Code = SilaReceivingExcel.Value(cells, "Code") ?? string.Empty,
                    Name = SilaReceivingExcel.Value(cells, "Name") ?? string.Empty,
                    Country = SilaReceivingExcel.Value(cells, "Country"),
                    Currency = SilaReceivingExcel.Value(cells, "Currency")
                });
                SilaMasterImportRowDto row = new SilaMasterImportRowDto
                {
                    RowNumber = SilaReceivingExcel.RowNumber(cells),
                    Key = input.Code,
                    Errors = SilaMasterDataRules.CompanyCodeErrors(input)
                };
                if (input.Code.Length > 0 && !seen.Add(input.Code))
                {
                    row.Errors.Add($"Company code {input.Code} appears more than once.");
                }

                CompanyCodeMaster? current = existing.TryGetValue(input.Code, out CompanyCodeMaster? found) ? found : null;
                if (row.Errors.Count > 0)
                {
                    row.Action = SilaReceivingExcel.ACTION_INVALID;
                }
                else if (current == null || !current.IsActive)
                {
                    row.Action = SilaReceivingExcel.ACTION_NEW;
                    changes.Add((input, current));
                }
                else
                {
                    bool changed = current.Name != input.Name || current.Country != input.Country || current.Currency != input.Currency;
                    row.Action = changed ? SilaReceivingExcel.ACTION_UPDATE : SilaReceivingExcel.ACTION_UNCHANGED;
                    if (changed)
                    {
                        changes.Add((input, current));
                    }
                }

                rows.Add(row);
            }

            SilaMasterImportResultDto result = SilaReceivingExcel.Summarize(request.FileName, rows);
            if (request.Commit)
            {
                if (result.InvalidRows > 0)
                {
                    _logger.LogError($"Company code import refused. InvalidRows: {result.InvalidRows}, FileName: {request.FileName}");
                    throw new BadRequestCustomException("Import refused: the file has invalid rows.", SilaReceivingExcel.RefusalMessage(rows));
                }

                foreach ((SilaCompanyCodeWriteDto input, CompanyCodeMaster? current) in changes)
                {
                    CompanyCodeMaster target = current ?? new CompanyCodeMaster { Id = Guid.NewGuid(), BuyerId = buyer.Id };
                    SilaMasterDataRules.Apply(target, input);
                    if (current == null)
                    {
                        _repository.CompanyCodeMaster.Create(target);
                    }
                    else
                    {
                        _repository.CompanyCodeMaster.Update(target);
                    }
                }

                await _repository.SaveAsync();
                result.Committed = true;
            }

            _logger.LogInfo($"Company code import {(result.Committed ? "done" : "checked")}. Rows: {result.TotalRows}, New: {result.NewRows}, Updated: {result.UpdateRows}, Invalid: {result.InvalidRows}");
            return result;
        }
    }
}

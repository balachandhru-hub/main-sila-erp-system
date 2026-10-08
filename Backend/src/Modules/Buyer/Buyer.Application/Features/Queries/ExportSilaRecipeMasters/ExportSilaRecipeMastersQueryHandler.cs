using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.ExportSilaRecipeMasters
{
    /// <summary>One sheet with the columns Code, Name, Description: empty for the template, the active records for the export.</summary>
    public class ExportSilaRecipeMastersQueryHandler : IRequestHandler<ExportSilaRecipeMastersQuery, SilaRecipeFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ExportSilaRecipeMastersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeFileDto> Handle(ExportSilaRecipeMastersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Exporting recipe masters. Kind: {request.Kind}, Template: {request.Template}, OrganizationId: {request.OrganizationId}");

            string kind = SilaRecipeMasterRules.ParseKind(_logger, request.Kind);
            SilaRecipeExcel.Sheet sheet = new SilaRecipeExcel.Sheet
            {
                Name = kind == SilaRecipeMasterRules.KIND_FAMILIES ? "Families" : "Categories",
                Headers = SilaRecipeMasterRules.Columns
            };

            if (!request.Template)
            {
                BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
                List<(SilaRecipeMasterDto Record, bool IsActive)> all = await SilaRecipeMasterRules.LoadAllAsync(_repository, buyer.Id, kind, cancellationToken);
                sheet.Rows = all
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Record.Code)
                    .Select(x => new object?[] { x.Record.Code, x.Record.Name, x.Record.Description })
                    .ToList();
            }

            string fileName = $"recipe-{kind}{(request.Template ? "-template" : string.Empty)}.xlsx";
            SilaRecipeFileDto file = SilaRecipeExcel.Build(fileName, sheet);

            _logger.LogInfo($"Recipe masters exported. Kind: {kind}, Rows: {sheet.Rows.Count}");
            return file;
        }
    }
}

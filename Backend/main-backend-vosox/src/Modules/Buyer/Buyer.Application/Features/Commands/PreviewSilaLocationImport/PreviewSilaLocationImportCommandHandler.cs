using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PreviewSilaLocationImport
{
    /// <summary>Checks a location Excel file and reports what the import would do. Nothing is saved.</summary>
    public class PreviewSilaLocationImportCommandHandler : IRequestHandler<PreviewSilaLocationImportCommand, SilaLocationImportPreviewDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public PreviewSilaLocationImportCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaLocationImportPreviewDto> Handle(PreviewSilaLocationImportCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Previewing location import. OrganizationId: {request.OrganizationId}, FileName: {request.FileName}, Bytes: {request.Content.Length}");

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

            _logger.LogInfo($"Location import previewed. Rows: {result.TotalRows}, New: {created.Count}, Update: {updated.Count}, Invalid: {result.InvalidRows}");
            return result;
        }
    }
}

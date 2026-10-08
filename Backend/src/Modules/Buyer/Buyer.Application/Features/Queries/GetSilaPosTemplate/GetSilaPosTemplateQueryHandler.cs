using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosTemplate
{
    /// <summary>Excel templates: the sales upload (SALES) and the outlet (OUTLETS) and item (ITEMS) mapping imports.</summary>
    public class GetSilaPosTemplateQueryHandler : IRequestHandler<GetSilaPosTemplateQuery, SilaPosFileDto>
    {
        public const string KIND_SALES = "SALES";
        public const string KIND_OUTLETS = "OUTLETS";
        public const string KIND_ITEMS = "ITEMS";

        private readonly ILoggerManager _logger;

        public GetSilaPosTemplateQueryHandler(ILoggerManager logger)
        {
            _logger = logger;
        }

        public Task<SilaPosFileDto> Handle(GetSilaPosTemplateQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Building POS template. OrganizationId: {request.OrganizationId}, Kind: {request.Kind}");

            string kind = (request.Kind ?? string.Empty).Trim().ToUpperInvariant();
            SilaPosFileDto file;
            if (kind == KIND_SALES)
            {
                file = SilaPosFiles.BuildTemplate(
                    "pos-sales-template.xlsx",
                    "SalesData",
                    new[] { "BusinessDate", "TransactionId", "LineId", "PosCode", "Qty", "UOM", "OutletCode", "Currency", "Amount" },
                    new List<string[]> { new[] { DateTime.UtcNow.ToString("yyyy-MM-dd"), "100045", "1", "COF-LATTE", "2", "EA", "LOBBY", "AED", "36.00" } });
            }
            else if (kind == KIND_OUTLETS)
            {
                file = SilaPosFiles.BuildTemplate(
                    "pos-outlet-mapping-template.xlsx",
                    "OutletMapping",
                    new[] { "PosOutletCode", "PosOutletName", "LocationCode" },
                    new List<string[]> { new[] { "101", "Lobby Lounge", "LOBBY" } });
            }
            else if (kind == KIND_ITEMS)
            {
                file = SilaPosFiles.BuildTemplate(
                    "pos-item-mapping-template.xlsx",
                    "ItemMapping",
                    new[] { "PosItemCode", "PosItemDescription", "RecipeCode" },
                    new List<string[]> { new[] { "COF-LATTE", "Caffe Latte", "RI00001" } });
            }
            else
            {
                _logger.LogError($"POS template kind not supported. Kind: {request.Kind}");
                throw new BadRequestCustomException("Unknown template.", "Ask for the SALES, OUTLETS or ITEMS template.");
            }

            _logger.LogInfo($"POS template built. Kind: {kind}, Bytes: {file.Content.Length}");
            return Task.FromResult(file);
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPoImportTemplate
{
    public class GetSilaPoImportTemplateQueryHandler : IRequestHandler<GetSilaPoImportTemplateQuery, SilaReceivingFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPoImportTemplateQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingFileDto> Handle(GetSilaPoImportTemplateQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Building purchase order import template. OrganizationId: {request.OrganizationId}");
            await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaReceivingFileDto file = SilaReceivingExcel.Build("PurchaseOrders", "purchase-order-import-template.xlsx", SilaPurchaseOrderRows.Columns, SilaPurchaseOrderRows.TemplateRows);
            _logger.LogInfo($"Purchase order import template built. Bytes: {file.Content.Length}");
            return file;
        }
    }
}

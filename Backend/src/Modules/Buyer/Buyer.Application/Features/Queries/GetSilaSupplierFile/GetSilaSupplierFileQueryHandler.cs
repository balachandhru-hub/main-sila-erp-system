using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaSupplierFile
{
    public class GetSilaSupplierFileQueryHandler : IRequestHandler<GetSilaSupplierFileQuery, SilaReceivingFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaSupplierFileQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingFileDto> Handle(GetSilaSupplierFileQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Building supplier workbook. OrganizationId: {request.OrganizationId}, Template: {request.Template}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<IReadOnlyList<object?>> rows = new List<IReadOnlyList<object?>>();
            if (request.Template)
            {
                rows.Add(new object?[] { "SUP-1001", "Gulf Foods LLC", "100234567800003", "Gulf Foods, GF Trading", "AE", SilaMasterDataRules.STATUS_ACTIVE, "Gulf Foods Trading LLC", "Dubai", "Al Quoz Industrial Area 3", "AED" });
            }
            else
            {
                List<SilaSupplier> suppliers = await _repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                    .OrderBy(x => x.SupplierCode)
                    .Take(SilaReceivingExcel.MAX_ROWS)
                    .ToListAsync(cancellationToken);
                rows.AddRange(suppliers.Select(x => (IReadOnlyList<object?>)new object?[] { x.SupplierCode, x.Name, x.TaxNumber, x.Aliases, x.Country, x.Status, x.LegalName, x.City, x.Address, x.Currency }));
            }

            SilaReceivingFileDto file = SilaReceivingExcel.Build("Suppliers", request.Template ? "supplier-master-template.xlsx" : "supplier-master.xlsx", SilaMasterDataRules.SupplierColumns, rows);
            _logger.LogInfo($"Supplier workbook built. Rows: {rows.Count}, Bytes: {file.Content.Length}");
            return file;
        }
    }
}

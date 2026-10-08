using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCompanyCodeFile
{
    public class GetSilaCompanyCodeFileQueryHandler : IRequestHandler<GetSilaCompanyCodeFileQuery, SilaReceivingFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCompanyCodeFileQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingFileDto> Handle(GetSilaCompanyCodeFileQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Building company code workbook. OrganizationId: {request.OrganizationId}, Template: {request.Template}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<IReadOnlyList<object?>> rows = new List<IReadOnlyList<object?>>();
            if (request.Template)
            {
                rows.Add(new object?[] { "1000", "Example Hotels LLC", "AE", "AED" });
            }
            else
            {
                List<CompanyCodeMaster> companyCodes = await _repository.CompanyCodeMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                    .OrderBy(x => x.Code)
                    .Take(SilaReceivingExcel.MAX_ROWS)
                    .ToListAsync(cancellationToken);
                rows.AddRange(companyCodes.Select(x => (IReadOnlyList<object?>)new object?[] { x.Code, x.Name, x.Country, x.Currency }));
            }

            SilaReceivingFileDto file = SilaReceivingExcel.Build(
                "CompanyCodes", request.Template ? "company-code-template.xlsx" : "company-codes.xlsx", SilaMasterDataRules.CompanyCodeColumns, rows);
            _logger.LogInfo($"Company code workbook built. Rows: {rows.Count}, Bytes: {file.Content.Length}");
            return file;
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.ExportSilaShortageReport
{
    /// <summary>The shortage report with every line, as an Excel workbook.</summary>
    public class ExportSilaShortageReportQueryHandler : IRequestHandler<ExportSilaShortageReportQuery, SilaExcelFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ExportSilaShortageReportQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaExcelFileDto> Handle(ExportSilaShortageReportQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Exporting shortage report. OrganizationId: {request.OrganizationId}, From: {request.Filter.From:yyyy-MM-dd}, To: {request.Filter.To:yyyy-MM-dd}, LocationId: {request.Filter.LocationId}");

            (DateTime from, DateTime to) = SilaShortageReportRules.Period(_logger, request.Filter);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<SilaShortageLineDto> lines = await SilaShortageReportRules.LoadLinesAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.Filter, from, to, cancellationToken);
            SilaShortageReportDto report = new SilaShortageReportDto
            {
                From = from,
                To = to,
                Totals = SilaShortageSummary.Totals(lines),
                ByLocation = SilaShortageSummary.ByLocation(lines),
                ByReason = SilaShortageSummary.ByReason(lines),
                TotalLines = lines.Count,
                Lines = lines
            };

            string? locationName = null;
            if (request.Filter.LocationId != null)
            {
                InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.Filter.LocationId.Value);
                locationName = location.LocationName;
            }

            byte[] content = SilaShortageWorkbook.Build(
                report,
                locationName,
                string.IsNullOrWhiteSpace(request.Filter.Category) ? null : request.Filter.Category.Trim().ToUpperInvariant(),
                string.IsNullOrWhiteSpace(request.Filter.EnquiryStatus) ? null : request.Filter.EnquiryStatus.Trim().ToUpperInvariant());

            _logger.LogInfo($"Shortage report exported. BuyerId: {buyer.Id}, Lines: {lines.Count}, Bytes: {content.Length}");
            return new SilaExcelFileDto
            {
                FileName = $"shortage-report-{from:yyyyMMdd}-{to:yyyyMMdd}.xlsx",
                Content = content
            };
        }
    }
}

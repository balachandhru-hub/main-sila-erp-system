using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PullSilaSuppliers
{
    /// <summary>
    /// Every active GET_SUPPLIER API is read (one per company code, or the organization-wide one); the suppliers of all of
    /// them are merged by code and written in one save. Records without code or name are counted as invalid and skipped.
    /// </summary>
    public class PullSilaSuppliersCommandHandler : IRequestHandler<PullSilaSuppliersCommand, SilaMasterPullResultDto>
    {
        private const int ERROR_LIMIT = 50;

        private readonly IRepositoryWrapper _repository;
        private readonly IIntegrationHttpExecutor _executor;
        private readonly ILoggerManager _logger;

        public PullSilaSuppliersCommandHandler(IRepositoryWrapper repository, IIntegrationHttpExecutor executor, ILoggerManager logger)
        {
            _repository = repository;
            _executor = executor;
            _logger = logger;
        }

        public async Task<SilaMasterPullResultDto> Handle(PullSilaSuppliersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Pulling suppliers from the ERP. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<ApiIntegrationConfiguration> configurations = await SilaErpPull.ActiveConfigurationsAsync(
                _repository, request.OrganizationId, IntegrationProcessType.GET_SUPPLIER, cancellationToken);
            if (configurations.Count == 0)
            {
                _logger.LogError($"No active supplier API. OrganizationId: {request.OrganizationId}");
                throw new BadRequestCustomException("Supplier API is not configured.", "Configure and activate a GET_SUPPLIER API under Integration first.");
            }

            SilaMasterPullResultDto result = new SilaMasterPullResultDto { Apis = configurations.Count };
            Dictionary<string, (int RowNumber, SilaSupplierWriteDto Supplier)> byCode = new Dictionary<string, (int, SilaSupplierWriteDto)>(StringComparer.OrdinalIgnoreCase);
            List<(int RowNumber, SilaSupplierWriteDto Supplier)> invalid = new List<(int, SilaSupplierWriteDto)>();
            foreach (ApiIntegrationConfiguration configuration in configurations)
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id && x.IsActive)
                    .ToListAsync(cancellationToken);
                List<JsonElement> records = await SilaErpPull.ReadAsync(_executor, _logger, configuration, "supplier", cancellationToken);
                foreach (JsonElement record in records)
                {
                    result.Read++;
                    SilaSupplierWriteDto supplier = SilaSupplierSync.FromRecord(mappings, record);
                    string code = supplier.SupplierCode.Trim();
                    if (code.Length == 0)
                    {
                        invalid.Add((result.Read, supplier));
                        continue;
                    }

                    byCode[code] = (result.Read, supplier);
                }
            }

            List<(int RowNumber, SilaSupplierWriteDto Supplier)> rows = byCode.Values.Concat(invalid).ToList();
            await SilaSupplierSync.KeepLocalFieldsAsync(_repository, buyer.Id, rows, cancellationToken);
            List<SilaMasterImportRowDto> outcome = await SilaSupplierSync.UpsertAsync(_repository, buyer.Id, rows, true, cancellationToken);
            await _repository.SaveAsync();

            SilaErpPull.Count(result, outcome, ERROR_LIMIT);
            _logger.LogInfo($"Suppliers pulled. Apis: {result.Apis}, Read: {result.Read}, Created: {result.Created}, Updated: {result.Updated}, Invalid: {result.Invalid}");
            return result;
        }
    }
}

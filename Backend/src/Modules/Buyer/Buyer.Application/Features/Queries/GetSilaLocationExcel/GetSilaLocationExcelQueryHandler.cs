using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLocationExcel
{
    public class GetSilaLocationExcelQueryHandler : IRequestHandler<GetSilaLocationExcelQuery, byte[]>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaLocationExcelQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<byte[]> Handle(GetSilaLocationExcelQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Building location Excel. OrganizationId: {request.OrganizationId}, Template: {request.Template}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaLocationContext context = await SilaLocationRules.LoadContextAsync(_repository, buyer.Id, cancellationToken);
            List<InventoryLocation> locations = request.Template ? new List<InventoryLocation>() : context.Locations.Where(x => x.IsActive).ToList();
            byte[] file = SilaLocationExcel.Build(locations, context);

            _logger.LogInfo($"Location Excel built. BuyerId: {buyer.Id}, Locations: {locations.Count}, Bytes: {file.Length}");
            return file;
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaEnquiries
{
    public class GetSilaEnquiriesQueryHandler : IRequestHandler<GetSilaEnquiriesQuery, List<SilaEnquiryDto>>
    {
        private static readonly string[] STATUSES =
        {
            Common.SILA_ENQUIRY_SENT, Common.SILA_ENQUIRY_RESPONDED, Common.SILA_ENQUIRY_MORE_INFORMATION,
            Common.SILA_ENQUIRY_ACCEPTED, Common.SILA_ENQUIRY_REJECTED
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaEnquiriesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaEnquiryDto>> Handle(GetSilaEnquiriesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching shortage enquiries. Status: {request.Status}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            IQueryable<StockShortageEnquiry> query = _repository.StockShortageEnquiry
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId));
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, STATUSES, "enquiry status");
                query = query.Where(x => x.Status == status);
            }

            List<StockShortageEnquiry> enquiries = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit))
                .ToListAsync(cancellationToken);
            List<SilaEnquiryDto> result = await SilaEnquiryRules.MapAsync(_repository, buyer.Id, enquiries, cancellationToken);

            _logger.LogInfo($"Shortage enquiries fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}

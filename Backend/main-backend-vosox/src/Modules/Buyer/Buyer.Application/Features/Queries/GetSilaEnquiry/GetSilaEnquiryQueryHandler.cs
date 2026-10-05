using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaEnquiry
{
    public class GetSilaEnquiryQueryHandler : IRequestHandler<GetSilaEnquiryQuery, SilaEnquiryDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaEnquiryQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaEnquiryDto> Handle(GetSilaEnquiryQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching shortage enquiry. EnquiryId: {request.EnquiryId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockShortageEnquiry enquiry = await SilaEnquiryRules.GetEnquiryAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.EnquiryId, cancellationToken);
            List<SilaEnquiryDto> mapped = await SilaEnquiryRules.MapAsync(_repository, buyer.Id, new List<StockShortageEnquiry> { enquiry }, cancellationToken);
            SilaEnquiryDto result = mapped[0];
            result.Events = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_ENQUIRY && x.ReferenceId == enquiry.Id && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .Select(x => new SilaEnquiryEventDto
                {
                    Action = x.Action,
                    Comment = x.Comment,
                    ActorUserId = x.ActorUserId,
                    DateCreated = x.DateCreated
                })
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Shortage enquiry fetched. EnquiryId: {enquiry.Id}, Events: {result.Events.Count}");
            return result;
        }
    }
}

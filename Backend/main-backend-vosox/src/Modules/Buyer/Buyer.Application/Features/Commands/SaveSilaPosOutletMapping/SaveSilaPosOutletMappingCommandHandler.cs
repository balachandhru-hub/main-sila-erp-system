using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaPosOutletMapping
{
    /// <summary>Maps a POS outlet code of a source to an active SILA outlet location (one mapping per code and source).</summary>
    public class SaveSilaPosOutletMappingCommandHandler : IRequestHandler<SaveSilaPosOutletMappingCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaPosOutletMappingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(SaveSilaPosOutletMappingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving POS outlet mapping. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, MappingId: {request.MappingId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            List<string> problems = new List<string>();
            string? codeProblem = SilaPosSources.CheckCode(request.Request?.PosOutletCode, "POS outlet code", out string code);
            string? nameProblem = SilaPosSources.CheckName(request.Request?.PosOutletName, "POS outlet name", out string? name);
            if (codeProblem != null) problems.Add(codeProblem);
            if (nameProblem != null) problems.Add(nameProblem);
            if (request.Request == null || request.Request.OutletLocationId == Guid.Empty) problems.Add("Select the SILA outlet location");
            if (problems.Count > 0)
            {
                _logger.LogError($"POS outlet mapping invalid. Problems: {string.Join("; ", problems)}");
                throw new BadRequestCustomException("The outlet mapping is not valid.", string.Join("; ", problems) + ".");
            }

            Guid locationId = request.Request!.OutletLocationId;
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, locationId);
            if (location.LocationType != Common.SILA_LOCATION_OUTLET)
            {
                _logger.LogError($"POS outlet mapping to a non-outlet location. LocationId: {location.Id}, Type: {location.LocationType}");
                throw new BadRequestCustomException("The location is not an outlet.", "Map the POS outlet to an OUTLET location; sales are consumed at outlets.");
            }

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);
            bool taken = await _repository.PosOutletMapping
                .FindByCondition(x => x.PosSourceId == source.Id && x.PosOutletCode == code && x.Id != request.MappingId)
                .AnyAsync(cancellationToken);
            if (taken)
            {
                _logger.LogError($"POS outlet code already mapped. SourceId: {source.Id}, Code: {code}");
                throw new ConflictCustomException("This POS outlet code is already mapped.", "Edit the existing mapping of this POS outlet code instead.");
            }

            PosOutletMapping mapping;
            if (request.MappingId == null)
            {
                mapping = new PosOutletMapping { Id = Guid.NewGuid(), PosSourceId = source.Id, IsActive = true };
                _repository.PosOutletMapping.Create(mapping);
            }
            else
            {
                Guid mappingId = request.MappingId.Value;
                PosOutletMapping? existing = await _repository.PosOutletMapping.FindFirstByConditionAsync(
                    x => x.Id == mappingId && x.PosSourceId == source.Id && x.IsActive);
                if (existing == null)
                {
                    _logger.LogError($"POS outlet mapping not found. MappingId: {mappingId}, SourceId: {source.Id}");
                    throw new NotFoundCustomException("Outlet mapping not found.", "Select an outlet mapping of this POS source.");
                }

                mapping = existing;
            }

            mapping.PosOutletCode = code;
            mapping.PosOutletName = name;
            mapping.OutletLocationId = location.Id;
            await _repository.SaveAsync();

            _logger.LogInfo($"POS outlet mapping saved. MappingId: {mapping.Id}, Code: {code}, LocationId: {location.Id}");
            return mapping.Id;
        }
    }
}

using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.MasterApprovalFlows
{
    public class CreateMasterApprovalFlowCommandHandler
        : IRequestHandler<CreateMasterApprovalFlowCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateMasterApprovalFlowCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(
            CreateMasterApprovalFlowCommand request,
            CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Creating Master Approval Flow. " +
                $"OrganizationId: {request.OrganizationId}");

            var dto = request.ApprovalFlow;

            // Get Buyer only through OrganizationId
            var buyer =
                await _repository.BuyerBusinessProfile
                    .FindFirstByConditionAsync(x =>
                        x.OrganizationId == request.OrganizationId &&
                        x.IsActive);

            if (buyer == null)
            {
                throw new NotFoundCustomException(
                    "Buyer not found.",
                    "Buyer profile not found for the organization.");
            }

            // At least one approval user is required
            if (dto.Users == null || !dto.Users.Any())
            {
                throw new PreConditionFailedCustomException(
                    "Approval flow users required.",
                    "At least one approval flow user is required.");
            }

            // Check duplicate approval code for this buyer
            var existingApprovalFlow =
                await _repository.MasterApprovalFlow
                    .FindFirstByConditionAsync(x =>
                        x.ApprovalCode == dto.ApprovalCode &&
                        x.BuyerId == buyer.Id &&
                        x.IsActive);

            if (existingApprovalFlow != null)
            {
                throw new PreConditionFailedCustomException(
                    "Approval code already exists.",
                    $"Approval code '{dto.ApprovalCode}' already exists for this buyer.");
            }

            // Optional scope (SILA ME approval types): the most specific flow of a type wins at runtime.
            (string scopeKind, Guid? scopeId, string? scopeCode) = await ResolveScopeAsync(dto.ScopeKind, dto.ScopeId, dto.ScopeCode, buyer.Id, cancellationToken);

            // Create Master Approval Flow
            var approvalFlow = new MasterApprovalFlow
            {
                Id = Guid.NewGuid(),
                ApprovalCode = dto.ApprovalCode,
                ApprovalName = dto.ApprovalName,
                BuyerId = buyer.Id,
                Type = dto.Type,
                TotalAmount = dto.TotalAmount,
                Currency = dto.Currency,
                ScopeKind = scopeKind,
                ScopeId = scopeId,
                ScopeCode = scopeCode
            };

            await _repository.MasterApprovalFlow
                .CreateAsync(approvalFlow);

            // Create Approval Flow User Mappings
            var approvalFlowUserMappings =
                dto.Users
                    .Select(user =>
                        new ApprovalFlowUserMapping
                        {
                            Id = Guid.NewGuid(),
                            ApprovalFlowId = approvalFlow.Id,
                            UserId = user.UserId,
                            Order = user.Order
                        })
                    .ToList();

            if (approvalFlowUserMappings.Any())
            {
                await _repository.ApprovalFlowUserMapping
                    .CreateRangeAsync(approvalFlowUserMappings);
            }

            // Save everything
            await _repository.SaveAsync();

            _logger.LogInfo(
                $"Master Approval Flow created successfully. " +
                $"ApprovalFlowId: {approvalFlow.Id}, " +
                $"BuyerId: {buyer.Id}");

            return approvalFlow.Id;
        }

        /// <summary>Validates the scope: the property or SILA location must belong to the buyer, the kind must match the location type.</summary>
        private async Task<(string ScopeKind, Guid? ScopeId, string? ScopeCode)> ResolveScopeAsync(
            string? requestedKind, Guid? requestedId, string? requestedCode, Guid buyerId, CancellationToken cancellationToken)
        {
            string kind = string.IsNullOrWhiteSpace(requestedKind) ? Common.SILA_SCOPE_ALL : requestedKind.Trim().ToUpperInvariant();
            if (kind == Common.SILA_SCOPE_ALL)
            {
                return (kind, null, null);
            }

            if (kind == Common.SILA_SCOPE_COMPANY_CODE)
            {
                string code = requestedCode?.Trim().ToUpperInvariant() ?? string.Empty;
                if (code.Length == 0 || code.Length > 20)
                {
                    _logger.LogError($"Approval flow company code scope without a valid code. BuyerId: {buyerId}");
                    throw new BadRequestCustomException("Company code is required.", "Enter the company code (at most 20 characters) the approval flow applies to.");
                }

                return (kind, null, code);
            }

            if (requestedId == null || requestedId == Guid.Empty)
            {
                _logger.LogError($"Approval flow scope without an id. ScopeKind: {kind}, BuyerId: {buyerId}");
                throw new BadRequestCustomException("Scope is required.", $"Select the {kind.ToLowerInvariant()} the approval flow applies to.");
            }

            if (kind == Common.SILA_SCOPE_PROPERTY)
            {
                bool propertyExists = await _repository.BuyerProperty
                    .FindByCondition(x => x.Id == requestedId.Value && x.BuyerId == buyerId && x.IsActive)
                    .AnyAsync(cancellationToken);
                if (!propertyExists)
                {
                    _logger.LogError($"Approval flow scope property not found. PropertyId: {requestedId}, BuyerId: {buyerId}");
                    throw new NotFoundCustomException("Property not found.", "Select an active property of this organization.");
                }

                return (kind, requestedId, null);
            }

            if (kind == Common.SILA_SCOPE_OUTLET || kind == Common.SILA_SCOPE_STORE)
            {
                string? locationType = await _repository.InventoryLocation
                    .FindByCondition(x => x.Id == requestedId.Value && x.BuyerId == buyerId && x.IsActive)
                    .Select(x => x.LocationType)
                    .FirstOrDefaultAsync(cancellationToken);
                if (locationType == null)
                {
                    _logger.LogError($"Approval flow scope location not found. LocationId: {requestedId}, BuyerId: {buyerId}");
                    throw new NotFoundCustomException("Location not found.", "Select an active inventory location of this organization.");
                }

                if (!string.Equals(locationType, kind, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogError($"Approval flow scope location type mismatch. LocationId: {requestedId}, LocationType: {locationType}, ScopeKind: {kind}");
                    throw new BadRequestCustomException("Location type does not match.", $"Select a location of type {kind}.");
                }

                return (kind, requestedId, null);
            }

            _logger.LogError($"Unknown approval flow scope. ScopeKind: {kind}, BuyerId: {buyerId}");
            throw new BadRequestCustomException("Unknown scope.", "Use ALL, PROPERTY, OUTLET, STORE or COMPANY_CODE.");
        }
    }
}
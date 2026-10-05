namespace Buyer.Infrastructure.Contracts.IRepository
{
    /// <summary>
    /// Repository Wrapper class holding every instance of repository.
    /// </summary>
    public interface IRepositoryWrapper
    {
        IBuyerBusinessProfileRepository BuyerBusinessProfile { get; }
        IBuyerBankAccountRepository BuyerBankAccount { get; }
        IBuyerDeliveryLocationRepository BuyerDeliveryLocation { get; }
        IBuyerRegistrationRepository BuyerRegistration { get; }
        IBuyerCategoryRepository BuyerCategory { get; }
        IItemBuyerMasterRepository ItemBuyerMaster { get; }
        IBulkInsertHelper BulkInsertHelper { get; }
        
        IAssetRepository Asset { get; }
        IBuyerDepartmentRepository BuyerDepartment{get;}
        IBuyerCostCenterRepository BuyerCostCenter{get;}

        IRFQRepository RFQ { get; }
        IRFQAttachmentMappingRepository RFQAttachmentMapping { get; }
        IRFQQuestionRepository RFQQuestion { get; }

        IRFQQuestionOptionRepository RFQQuestionOption { get; }
        IRFQItemRepository RFQItem { get; }

        IRFQItemAttachmentMappingRepository RFQItemAttachmentMapping { get; }
        IRFQSupplierMappingRepository RFQSupplierMapping { get; }
        IRFQOrganizationUserMappingRepository RFQOrganizationUserMapping { get; }

        ISupplierVerificationRequestRepository SupplierVerificationRequest { get; }
        IBuyerSupplierMappingRepository BuyerSupplierMapping { get; }
        IVerificationTemplateRepository VerificationTemplate{get;}
        IVerificationTemplateQuestionRepository VerificationTemplateQuestion {get;}
        IVerificationTemplateQuestionOptionRepository VerificationTemplateQuestionOptionRepository{get;}
        IDefaultVerificationTemplateQuestionRepository DefaultVerificationTemplateQuestionRepository{get;}
        IDefaultVerificationTemplateRepository DefaultVerificationTemplateRepository {get;}
        IRFQQuestionAttachmentMappingRepository RFQQuestionAttachmentMapping {get;}
        IRFQBlockchainRecordRepository RFQBlockchainRecord {get;}
        IExternalSupplierRepository ExternalSupplier {get;}
        IRFQExternalSupplierRepository RFQExternalSupplier {get;}
        IMessageThreadRepository MessageThread {get;}
        IMessageRepository Message {get;}
        IMessageAttachmentRepository MessageAttachment {get;}
        IPredefinedMaterialRepository PredefinedMaterial {get;}
        IApprovalFlowUserMappingRepository ApprovalFlowUserMapping {get;}
        IApprovalFlowPredefinedMaterialMappingRepository ApprovalFlowPredefinedMaterialMapping {get;}
        IPredefinedMaterialApprovalFlowUserMappingRepository PredefinedMaterialApprovalFlowUserMapping {get;}
        IMasterApprovalFlowRepository MasterApprovalFlow {get;}
        IExcelMaterialMasterRepository ExcelMaterialMaster {get;}
        IRFQAwardRepository RFQAward { get; }
        IRFQAwardItemRepository RFQAwardItem { get; }
        IPredefinedContractRepository PredefinedContract { get; }
        IPredefinedContractAttachmentRepository PredefinedContractAttachment { get; }
        IPredefinedContractApprovalFlowRepository PredefinedContractApprovalFlow { get; }
        IPredefinedContractApprovalUserMappingRepository PredefinedContractApprovalUserMapping { get; }
        IContractTemplateRepository ContractTemplate { get; }
        IContractDetailsRepository ContractDetails { get; }
        IContractAttachmentRepository ContractAttachment { get; }
        IWeeklyBucketRepository WeeklyBucket { get; }
        IWeeklyBucketItemRepository WeeklyBucketItem { get; }
        IWeeklyBucketRecommendationRepository WeeklyBucketRecommendation { get; }
        IWeeklyBucketApprovalFlowRepository WeeklyBucketApprovalFlow { get; }
        IWeeklyBucketApprovalUserMappingRepository WeeklyBucketApprovalUserMapping { get; }
        IWeeklyBucketAuditRepository WeeklyBucketAudit { get; }
        IBuyerPropertyRepository BuyerProperty { get; }
        ICatalogMaterialMappingRepository CatalogMaterialMapping { get; }
        IPersonalWishlistRepository PersonalWishlist { get; }
        IPersonalWishlistItemRepository PersonalWishlistItem { get; }
        IBuyerOutletRepository BuyerOutlet { get; }
        IBuyerOutletUserMappingRepository BuyerOutletUserMapping { get; }
        IErpIntegrationRepository ErpIntegration { get; }
        IPurchaseDocumentIntegrationRepository PurchaseDocumentIntegration { get; }
        IPurchaseOrderRepository PurchaseOrder { get; }
        IPurchaseOrderItemRepository PurchaseOrderItem { get; }
        IApiIntegrationConfigurationRepository ApiIntegrationConfiguration { get; }
        IApiFieldMappingRepository ApiFieldMapping { get; }
        IApiIntegrationExecutionRepository ApiIntegrationExecution { get; }
        IIntegrationSchemaSnapshotRepository IntegrationSchemaSnapshot { get; }
        IMaterialUomConversionRepository MaterialUomConversion { get; }
        IInventoryLocationRepository InventoryLocation { get; }
        IInventoryLocationUserMappingRepository InventoryLocationUserMapping { get; }
        IInventoryLocationMaterialRepository InventoryLocationMaterial { get; }
        IInventoryBalanceRepository InventoryBalance { get; }
        IInventoryTransactionRepository InventoryTransaction { get; }
        IInventoryErpPostingRepository InventoryErpPosting { get; }
        IInternalTransferOrderRepository InternalTransferOrder { get; }
        IInternalTransferOrderItemRepository InternalTransferOrderItem { get; }
        IInventoryWorkflowEventRepository InventoryWorkflowEvent { get; }
        IGoodsIssueRepository GoodsIssue { get; }
        IGoodsIssueItemRepository GoodsIssueItem { get; }
        IStockAdjustmentRepository StockAdjustment { get; }
        IStockAdjustmentItemRepository StockAdjustmentItem { get; }
        IStockCountRepository StockCount { get; }
        IStockCountItemRepository StockCountItem { get; }
        IStockShortageEnquiryRepository StockShortageEnquiry { get; }
        IInventoryAlertRepository InventoryAlert { get; }
        IRecipeRepository Recipe { get; }
        IRecipeIngredientRepository RecipeIngredient { get; }
        IRecipeOutletPriceRepository RecipeOutletPrice { get; }
        IPosSalesBatchRepository PosSalesBatch { get; }
        IPosSalesTransactionRepository PosSalesTransaction { get; }
        IGoodsReceiptRepository GoodsReceipt { get; }
        IGoodsReceiptItemRepository GoodsReceiptItem { get; }
        IInvoiceRepository Invoice { get; }
        IRecipeFamilyRepository RecipeFamily { get; }
        IRecipeCategoryRepository RecipeCategory { get; }
        ISilaApprovalStepRepository SilaApprovalStep { get; }
        IPosSourceRepository PosSource { get; }
        IPosOutletMappingRepository PosOutletMapping { get; }
        IPosItemMappingRepository PosItemMapping { get; }
        IMaterialPriceChangeRepository MaterialPriceChange { get; }
        IInternalPurchaseRequestRepository InternalPurchaseRequest { get; }
        IQuickTransferPolicyRepository QuickTransferPolicy { get; }
        IPhysicalInventoryRequestRepository PhysicalInventoryRequest { get; }
        ILocationMaterialThresholdRepository LocationMaterialThreshold { get; }
        ISilaSupplierRepository SilaSupplier { get; }
        ICompanyCodeMasterRepository CompanyCodeMaster { get; }
        IInvoiceExtractionRepository InvoiceExtraction { get; }
        ISilaOcrConfigurationRepository SilaOcrConfiguration { get; }
        IRecipeSubstitutionProposalRepository RecipeSubstitutionProposal { get; }
        IStockCountPhotoRepository StockCountPhoto { get; }
        ISilaDocumentSequenceRepository SilaDocumentSequence { get; }
        IInvoiceItemRepository InvoiceItem { get; }
        bool Save();
        Task<bool> SaveAsync();
    }
}
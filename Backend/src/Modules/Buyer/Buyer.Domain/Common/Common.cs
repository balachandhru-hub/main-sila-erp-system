
namespace Buyer.Domain.Common
{
        /// <summary>
        ///
        /// </summary>
        public static class Common
        {
                public static readonly string APPLICATION_SCHEMA = "ConnectionStrings:Schema";
                public static readonly string DEFAULT_FRONT_END_ORIGIN_LOCAL = "Origin:HostOriginLocal";
                public static readonly string MAX_REQUEST_SIZE = "MaxRequestBodySize";
                public static readonly string UAT_ENVIRONMENT = "UAT";
                public static readonly string TOKEN_EXPIRY = "Tokens:TokenExpirationTimeInSeconds";
                public static int TOKEN_EXPIRY_TIME_DEFAULT = 3600;
                public static readonly string BASE_FOLDER_PATH = "FolderPath:BasePath";
                public static readonly string SCHEDULER_INTEGRATION_CRON = "Scheduler:IntegrationCron";
                public static readonly string MASTER_DATA_URL = "InterCallService:MasterDataUrl";
                public static readonly string ASSET_TYPE = "ASSET_TYPE";
                public static readonly string ENTITY_TYPE = "ENTITY_TYPE";
                public static readonly string FILE_TYPE = "FILE_TYPE";
                public static readonly string PENDING_STATUS = "PENDING_VERIFICATION";
                public static readonly string METADATA_STATUS_TYPE = "STATUS";
                public static readonly string VERIFIED_STATUS = "VERIFIED";
                public static readonly string REJECTED_STATUS = "REJECTED";
                public static readonly string REVERIFICATION_STATUS = "RE_VERIFICATION";
                public static readonly string IDENTITY_SERVICE_BASE_URL = "InterCallService:IdentityUrl";
                public static readonly string SUPPLIER_SERVICE_BASE_URL = "InterCallService:SupplierUrl";
                // API integrations (configured under Integrations): side of the API types this service owns and
                // the data protection key ring of their encrypted credentials, under FolderPath:BasePath.
                public const string INTEGRATION_SIDE = "Buyer";
                public const string DATA_PROTECTION_SUBFOLDER = "buyer/dataprotection-keys";
                public static readonly string ACCESS_TOKEN = "access_token";
                public static readonly string METADATA_DOCUMENT_TYPE = "DOCUMENT_TYPE";
                public static readonly string RFQ_OPEN_STATUS = "Open";
                public static readonly string RFQ_LIVE_STATUS = "LIVE";
                public static readonly string TERMS_CONDITION = "TERMS_CONDITION";
                public const string ESIGN = "ESIGN";
                public static readonly string TECHNICAL_SPECIFICATION = "TECHNICAL_SPECIFICATION";
                public static int DISPLAY_ORDER = 1;
                public const string PENDING = "PENDING";
                public static readonly string RFQ_ITEM_ATTACHMENT = "RFQ_ITEM_ATTACHMENT";
                public const string DEFAULT = "DEFAULT";
                public const string SUBMITTED = "SUBMITTED";
                public const string DRAFT = "DRAFT";
                public static Guid SUPPLIER_ADMIN_ROLE_ID = new Guid("735bb267-fec0-489f-8249-d3d65b3857ea");
                public static Guid BUYER_ADMIN_ROLE_ID = new Guid("c95f5a1b-4aec-4647-9328-895a58193ec4");
                public static Guid STORE_MANAGER_ROLE_ID = new Guid("b054de41-7da1-4b96-a2aa-d8387bfb0ef0");
                public static Guid COST_CONTROLLER_ROLE_ID = new Guid("3f9d6c2e-5b1a-4e8f-9c7d-2a6b8e4f1c03");
                public const string DEFAULT_TEMPLATE = "DEFAULT_TEMPLATE";
                public const string BUYER = "BUYER";
                public const string RADIO_BUTTON = "Radio";
                public const string CHECKBOX = "Checkbox";
                public const string ACCEPT = "Accept";
                public const string DECLINE = "Decline";
                public static Guid DEFAULT_VERIFICATION_TEMPLATE_ID = new Guid("DD5A50B8-F087-4F0A-A004-CE43E92CE2B9");
                public const string SUPPLIER_QUOTATION="UPPLIER_QUOTATION";
                public const string QUOTATION_SUBMITTED="QUOTATION_SUBMITTED";
                public const string HYPERLEDGER_FABRIC="HYPERLEDGER_FABRIC";
                public const string BLOCKCHAIN_KEY="Encryption:AesKey";
                public const string EXTERNAL_SUPPLIER_INVITED_STATUS = "INVITED";
                public const string EXTERNAL_SUPPLIER_EMAIL_KEY = "EXTERNAL_SUPPLIER_QUOTATION_SUBMITTED";
                public const string EXTERNAL_SUPPLIER_REGISTRATION_EMAIL_KEY = "EXTERNAL_SUPPLIER_REGISTER_INVITE";
                public const string EXTERNAL_SUPPLIER_AWARD_EMAIL_KEY = "EXTERNAL_SUPPLIER_AWARD_CONGRATULATIONS";
                public const string SUPPLIER_AWARD_EMAIL_KEY = "SUPPLIER_AWARD_CONGRATULATIONS";
                public const string EXTERNAL_SUPPLIER_ENTITY_TYPE = "RFQ";
                public static readonly string EXTERNAL_SUPPLIER_REGISTRATION_LINK = "ExternalSupplier:RegistrationLink";
                public static readonly string EXTERNAL_SUPPLIER_BID_LINK = "ExternalSupplier:BidLink";

                public const string RFQ_AWARDED_STATUS = "AWARDED";
                public const string AWARD_SELECTION_MODE = "AWARD_SELECTION";
                public const string BID_COMPARISON_MODE = "BID_COMPARISON";
                public const string BY_SUPPLIER_MODE = "BY_SUPPLIER";
                public const string SUPPLIER = "SUPPLIER";
                public const string EXTERNAL_SUPPLIER = "EXTERNAL_SUPPLIER";
                public const string UNVERIFIED_STATUS = "UNVERIFIED";
                public const string MESSAGE_ATTACHMENT_SUBFOLDER = "messages";
                public const string SEND_MESSAGE_PERMISSION = "SEND_MESSAGE";
                public const string GET_MESSAGE_THREADS_PERMISSION = "GET_MESSAGE_THREADS";
                public const string GET_MESSAGE_HISTORY_PERMISSION = "GET_MESSAGE_HISTORY";
                public const string MARK_MESSAGE_READ_PERMISSION = "MARK_MESSAGE_READ";
                public const string DOWNLOAD_MESSAGE_ATTACHMENT_PERMISSION = "DOWNLOAD_MESSAGE_ATTACHMENT";
                public const string ITEM_MASTER_STATUS = "OPEN";
                public const string APPROVED = "APPROVE";
                public const string REJECTED = "REJECT";
                public const string ACCEPTED_STATUS = "ACCEPTED";
                public const string COMPLETE = "COMPLETE";
                public const string PROCESSING = "PROCESSING";

                // ---- ApprovalFlowPredefinedMaterialMapping.UploadType: which
                // table PredefinedMaterialId points to for this approval mapping.
                public const string UPLOAD_TYPE_MANUAL = "MANUAL";
                public const string UPLOAD_TYPE_EXCEL = "EXCEL";

                public const string CONTRACT_DRAFT_STATUS = "DRAFT";
                public const string CONTRACT_OPEN_STATUS = "OPEN";
                public const string CONTRACT_IN_PROCESS_STATUS = "IN_PROCESS";
                public const string CONTRACT_COMPLETED_STATUS = "COMPLETED";
                public const string CONTRACT_REJECTED_STATUS = "REJECTED";
                public const string CONTRACT_CREATED_STATUS = "CONTRACT_CREATED";

                public const string CONTRACT_ASSET_BUYER_TERMS = "BUYER_TERMS";
                public const string CONTRACT_ASSET_SUPPLIER_TERMS = "SUPPLIER_TERMS";
                public const string CONTRACT_ASSET_BUYER_ESIGN = "BUYER_ESIGN";
                public const string CONTRACT_ASSET_SUPPLIER_ESIGN = "SUPPLIER_ESIGN";
                public const string CONTRACT_ASSET_SIGNED_CONTRACT = "SIGNED_CONTRACT";

                public const string PREDEFINED_CONTRACT_NUMBER_SEQUENCE = "PredefinedContractSNSequence";
                public static readonly string CONTRACT_ATTACHMENT = "CONTRACT_ATTACHMENT";

                // ---- RFQ status written by the Freeze Bid action (PUT api/v1/buyer/rfq-status).
                // UpdateRFQStatusCommandHandler stores the posted value as-is; the buyer UI posts "Freezing".
                public const string RFQ_FREEZING_STATUS = "Freezing";

                // ---- Dashboard analytics (GET api/v1/buyer/dashboard-analytics)
                public const int DASHBOARD_TREND_MONTHS = 12;
                /// <summary>Rows returned per ranked breakdown (departments, suppliers, buyers).</summary>
                public const int DASHBOARD_MAX_BREAKDOWN_ROWS = 8;
                public const int DASHBOARD_UPCOMING_DEADLINES = 6;
                public const int DASHBOARD_CLOSING_SOON_DAYS = 7;
                public const string DASHBOARD_MONTH_FORMAT = "yyyy-MM";
                public const string DASHBOARD_STAGE_UPCOMING = "Upcoming";
                public const string DASHBOARD_STAGE_LIVE = "Live";
                public const string DASHBOARD_STAGE_FROZEN = "Frozen";
                public const string DASHBOARD_STAGE_BIDDING_CLOSED = "Bidding closed";
                public const string DASHBOARD_STAGE_AWARDED = "Awarded";
                public static readonly string[] DASHBOARD_STAGE_ORDER =
                {
                        DASHBOARD_STAGE_UPCOMING, DASHBOARD_STAGE_LIVE, DASHBOARD_STAGE_FROZEN,
                        DASHBOARD_STAGE_BIDDING_CLOSED, DASHBOARD_STAGE_AWARDED
                };
                public const string DASHBOARD_UNASSIGNED_DEPARTMENT = "Unassigned";
                /// <summary>Label for an RFQ whose department id no longer exists.</summary>
                public const string DASHBOARD_UNKNOWN_DEPARTMENT = "Deleted department";
                public const string DASHBOARD_UNKNOWN_SUPPLIER_PREFIX = "Supplier";
                /// <summary>Days-until-close buckets for the closing schedule (inclusive bounds).</summary>
                public static readonly (string Key, string Label, int FromDay, int ToDay)[] DASHBOARD_CLOSING_WINDOWS =
                {
                        ("THIS_WEEK", "0–7 days", 0, 7),
                        ("NEXT_WEEK", "8–14 days", 8, 14),
                        ("TWO_TO_FOUR_WEEKS", "15–30 days", 15, 30),
                        ("LATER", "30+ days", 31, int.MaxValue),
                };

                // ---- Weekly bucket
                /// <summary>MasterApprovalFlow.Type of the flow a property uses for its weekly bucket.</summary>
                public const string WEEKLY_BUCKET_APPROVAL_TYPE = "WEEKLY_BUCKET";

                // ---- SILA ME (hospitality add-on)
                public const string SILA_LOCATION_STORE = "STORE";
                public const string SILA_LOCATION_OUTLET = "OUTLET";
                public const string SILA_DIRECTION_IN = "IN";
                public const string SILA_DIRECTION_OUT = "OUT";
                public const string SILA_TXN_OPENING_STOCK = "OPENING_STOCK";
                public const string SILA_TXN_GOODS_RECEIPT = "GOODS_RECEIPT";
                public const string SILA_TXN_TRANSFER_OUT = "TRANSFER_OUT";
                public const string SILA_TXN_TRANSFER_IN = "TRANSFER_IN";
                public const string SILA_TXN_GOODS_ISSUE_OUT = "GOODS_ISSUE_OUT";
                public const string SILA_TXN_GOODS_ISSUE_IN = "GOODS_ISSUE_IN";
                public const string SILA_TXN_RECIPE_CONSUMPTION = "RECIPE_CONSUMPTION";
                public const string SILA_TXN_STOCK_COUNT_ADJUSTMENT = "STOCK_COUNT_ADJUSTMENT";
                public const string SILA_TXN_MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT";
                public const string SILA_REF_ITO = "ITO";
                public const string SILA_REF_GOODS_ISSUE = "GOODS_ISSUE";
                public const string SILA_REF_ADJUSTMENT = "ADJUSTMENT";
                public const string SILA_REF_STOCK_COUNT = "STOCK_COUNT";
                public const string SILA_REF_ENQUIRY = "ENQUIRY";
                public const string SILA_REF_POS_SALE = "POS_SALE";
                public const string SILA_REF_GRN = "GRN";
                public const string SILA_REF_RECIPE = "RECIPE";
                public const string SILA_POSTING_PENDING = "PENDING";
                public const string SILA_POSTING_POSTED = "POSTED";
                public const string SILA_POSTING_FAILED = "FAILED";
                public const string SILA_POSTING_SKIPPED = "SKIPPED";
                public const string SILA_MOVEMENT_TRANSFER = "TRANSFER";
                public const string SILA_MOVEMENT_GOODS_ISSUE = "GOODS_ISSUE";
                public const string SILA_MOVEMENT_ADJUSTMENT = "ADJUSTMENT";
                public const string SILA_MOVEMENT_STOCK_COUNT = "STOCK_COUNT";
                public const string SILA_MOVEMENT_CONSUMPTION = "CONSUMPTION";
                public const string SILA_MOVEMENT_GRN = "GRN";
                public const string SILA_ITO_STANDARD = "STANDARD";
                public const string SILA_ITO_QUICK = "QUICK";
                public const string SILA_ITO_PENDING_APPROVAL = "PENDING_APPROVAL";
                public const string SILA_ITO_APPROVED = "APPROVED";
                public const string SILA_ITO_DISPATCHED = "DISPATCHED";
                public const string SILA_ITO_RECEIVED = "RECEIVED";
                public const string SILA_ITO_DISCREPANCY = "DISCREPANCY";
                public const string SILA_ITO_REJECTED = "REJECTED";
                public const string SILA_ITO_CANCELLED = "CANCELLED";
                public const string SILA_COUNT_IN_PROGRESS = "IN_PROGRESS";
                public const string SILA_COUNT_SUBMITTED = "SUBMITTED";
                public const string SILA_COUNT_ENQUIRY_PENDING = "ENQUIRY_PENDING";
                public const string SILA_COUNT_POSTED = "POSTED";
                public const string SILA_COUNT_CANCELLED = "CANCELLED";
                public const string SILA_COUNT_SURPRISE = "SURPRISE";
                public const string SILA_COUNT_LINE_NOT_COUNTED = "NOT_COUNTED";
                public const string SILA_COUNT_LINE_MATCHED = "MATCHED";
                public const string SILA_COUNT_LINE_SHORTAGE = "SHORTAGE";
                public const string SILA_COUNT_LINE_SURPLUS = "SURPLUS";
                public const string SILA_ENQUIRY_SENT = "SENT";
                public const string SILA_ENQUIRY_RESPONDED = "RESPONDED";
                public const string SILA_ENQUIRY_ACCEPTED = "ACCEPTED";
                public const string SILA_ENQUIRY_REJECTED = "REJECTED";
                public const string SILA_ALERT_LOW_STOCK = "LOW_STOCK";
                public const string SILA_ALERT_NEGATIVE_STOCK = "NEGATIVE_STOCK";
                public const string SILA_ALERT_INVENTORY_VARIANCE = "INVENTORY_VARIANCE";
                public const string SILA_ALERT_TRANSFER_DISCREPANCY = "TRANSFER_DISCREPANCY";
                public const string SILA_ALERT_POS_POSTING_FAILED = "POS_POSTING_FAILED";
                public const string SILA_ALERT_NEW = "NEW";
                public const string SILA_ALERT_ACKNOWLEDGED = "ACKNOWLEDGED";
                public const string SILA_ALERT_RESOLVED = "RESOLVED";
                public const string SILA_ALERT_DISMISSED = "DISMISSED";
                public const string SILA_SEVERITY_CRITICAL = "CRITICAL";
                public const string SILA_SEVERITY_HIGH = "HIGH";
                public const string SILA_SEVERITY_MEDIUM = "MEDIUM";
                public const string SILA_ACTION_REQUEST_TRANSFER = "REQUEST_TRANSFER";
                public const string SILA_ACTION_REQUEST_PHYSICAL_INVENTORY = "REQUEST_PHYSICAL_INVENTORY";
                public const string SILA_ACTION_INVESTIGATE = "INVESTIGATE";
                public const string SILA_ACTION_REVIEW_TRANSFER = "REVIEW_TRANSFER";
                public const string SILA_RECIPE_DIRECT = "DIRECT";
                public const string SILA_RECIPE_RECIPE = "RECIPE";
                public const string SILA_RECIPE_BATCH = "BATCH";
                public const string SILA_RECIPE_DRAFT = "DRAFT";
                public const string SILA_RECIPE_PENDING_APPROVAL = "PENDING_APPROVAL";
                public const string SILA_RECIPE_APPROVED = "APPROVED";
                public const string SILA_RECIPE_REJECTED = "REJECTED";
                public const string SILA_RECIPE_INACTIVE = "INACTIVE";
                public const string SILA_APPROVAL_PENDING = "PENDING";
                public const string SILA_APPROVAL_APPROVED = "APPROVED";
                public const string SILA_APPROVAL_REJECTED = "REJECTED";
                public const string RECIPE_APPROVAL_TYPE = "RECIPE";
                public const string SILA_POS_RECEIVED = "RECEIVED";
                public const string SILA_POS_INVENTORY_DEDUCTED = "INVENTORY_DEDUCTED";
                public const string SILA_POS_POSTED = "POSTED";
                public const string SILA_POS_FAILED = "FAILED";
                public const string SILA_POS_STEP_MATCH = "MATCH";
                public const string SILA_POS_STEP_DEDUCT = "DEDUCT";
                public const string SILA_POS_STEP_POST = "POST";
                public const string SILA_POS_SOURCE_FILE = "FILE";
                public const string SILA_POS_SOURCE_API = "API";
                public const string SILA_GRN_POSTED = "POSTED";
                public const string SILA_PO_PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED";
                public const string SILA_PO_RECEIVED = "RECEIVED";
                public const string SILA_INVOICE_UPLOADED = "UPLOADED";
                public const string SILA_INVOICE_EXTRACTED = "EXTRACTED";
                public const string SILA_INVOICE_OCR_FAILED = "OCR_FAILED";
                public const string SILA_INVOICE_REVIEWED = "REVIEWED";
                public const string SILA_INVOICE_GRN_POSTED = "GRN_POSTED";
                public const string INTEGRATION_PROCESS_POST_GOODS_MOVEMENT = "POST_GOODS_MOVEMENT";
                public const string INTEGRATION_PROCESS_POST_GRN = "POST_GRN";
                public const string INTEGRATION_PROCESS_GET_POS_SALE = "GET_POS_SALE";
                // ---- SILA ME release 2
                public const string SILA_APPROVAL_TYPE_RECIPE = "RECIPE";
                public const string SILA_APPROVAL_TYPE_MATERIAL_PRICE = "MATERIAL_PRICE";
                public const string SILA_SCOPE_ALL = "ALL";
                public const string SILA_SCOPE_PROPERTY = "PROPERTY";
                public const string SILA_SCOPE_OUTLET = "OUTLET";
                public const string SILA_SCOPE_STORE = "STORE";
                public const string SILA_SCOPE_COMPANY_CODE = "COMPANY_CODE";
                public const string SILA_LOCATION_VENUE = "VENUE";
                public const string SILA_PRICE_PENDING_APPROVAL = "PENDING_APPROVAL";
                public const string SILA_PRICE_APPROVED = "APPROVED";
                public const string SILA_PRICE_REJECTED = "REJECTED";
                public const string SILA_PR_SUBMITTED = "SUBMITTED";
                public const string SILA_PR_ADDED_TO_BUCKET = "ADDED_TO_BUCKET";
                public const string SILA_PR_CANCELLED = "CANCELLED";
                public const string SILA_PI_SCHEDULED = "SCHEDULED";
                public const string SILA_PI_IN_PROGRESS = "IN_PROGRESS";
                public const string SILA_PI_COMPLETED = "COMPLETED";
                public const string SILA_PI_CANCELLED = "CANCELLED";
                public const string SILA_ENQUIRY_MORE_INFORMATION = "MORE_INFORMATION_REQUIRED";
                public const string SILA_POSTING_UNKNOWN = "UNKNOWN";
                public const string SILA_POS_BATCH_PREVIEW = "PREVIEW";
                public const string SILA_POS_BATCH_PROCESSED = "PROCESSED";
                public const string SILA_PROPOSAL_PROPOSED = "PROPOSED";
                public const string SILA_PROPOSAL_ACCEPTED = "ACCEPTED";
                public const string SILA_PROPOSAL_DISMISSED = "DISMISSED";
                public const string SILA_REF_INVOICE = "INVOICE";
                public const string SILA_REF_MATERIAL_PRICE = "MATERIAL_PRICE";
                public const string SILA_REF_PURCHASE_REQUEST = "PURCHASE_REQUEST";
                public const string SILA_REF_PHYSICAL_INVENTORY = "PHYSICAL_INVENTORY";
                public const string SILA_REF_SUBSTITUTION = "SUBSTITUTION";
                public const string SILA_REF_MASTER_DATA = "MASTER_DATA";
                public const string SILA_MOVEMENT_INVOICE = "INVOICE";
                public const string INTEGRATION_PROCESS_POST_INVOICE = "POST_INVOICE";
                public const string INTEGRATION_PROCESS_GET_SUPPLIER = "GET_SUPPLIER";
                public const string INTEGRATION_PROCESS_EXTRACT_INVOICE = "EXTRACT_INVOICE";
                public const string INTEGRATION_PROCESS_GET_PO = "GET_PO";
                public static readonly string SCHEDULER_SUBSTITUTION_CRON = "Scheduler:RecipeSubstitutionCron";
                public static readonly string SCHEDULER_PHYSICAL_INVENTORY_CRON = "Scheduler:PhysicalInventoryCron";
                public const string HTTP_CLIENT_OCR = "ocr";
                public const string SILA_INVOICE_FOLDER = "sila/invoices";
                public static readonly string OCR_SERVICE_URL = "InterCallService:OcrUrl";
                public static readonly string SCHEDULER_ERP_POSTING_CRON = "Scheduler:InventoryErpPostingCron";
                public static readonly string SCHEDULER_ALERT_CRON = "Scheduler:InventoryAlertCron";
                public static readonly string SCHEDULER_POS_PULL_CRON = "Scheduler:PosSalesPullCron";
                /// <summary>Creates the purchase orders of approved weekly buckets once their weekend has started.</summary>
                public static readonly string SCHEDULER_WEEKLY_BUCKET_CRON = "Scheduler:WeeklyBucketCron";
                /// <summary>Emails the store managers to freeze weekly buckets that are still open.</summary>
                public static readonly string SCHEDULER_WEEKLY_BUCKET_REMINDER_CRON = "Scheduler:WeeklyBucketReminderCron";
                /// <summary>Day of the ISO week on which the weekend starts, and the purchase orders of approved buckets are created. Default Saturday.</summary>
                public static readonly string WEEKLY_BUCKET_WEEKEND_START_DAY = "WeeklyBucket:WeekendStartDay";
                /// <summary>Day of the ISO week from which the store manager is reminded to freeze a bucket that is still open. Default Friday.</summary>
                public static readonly string WEEKLY_BUCKET_REMINDER_START_DAY = "WeeklyBucket:ReminderStartDay";
                public const string WEEKLY_BUCKET_STORE_MANAGER_ROLE = "STORE_MANAGER";
                public const string WEEKLY_BUCKET_REMINDER_EMAIL_KEY = "WEEKLY_BUCKET_FREEZE_REMINDER";
                public const string WEEKLY_BUCKET_REF = "WEEKLY_BUCKET";
                public const string AUDIT_REMINDER_SENT = "REMINDER_SENT";
                public const string AUDIT_QUICK_CREATE = "QUICK_CREATE";
                public const string AUDIT_AUTO_CREATE = "AUTO_CREATE";
                /// <summary>Whole weeks added to the ISO week of today (UTC) to get the business week.</summary>
                public static readonly string WEEKLY_BUCKET_WEEK_NUMBER_OFFSET = "WeeklyBucket:WeekNumberOffset";
                public const string WEEKLY_BUCKET_OPEN = "OPEN";
                public const string WEEKLY_BUCKET_PENDING_APPROVAL = "PENDING_APPROVAL";
                public const string WEEKLY_BUCKET_APPROVED = "APPROVED";
                public const string WEEKLY_BUCKET_PO_CREATED = "PO_CREATED";
                public const string WEEKLY_BUCKET_PO_FAILED = "PO_FAILED";
                public const string WEEKLY_BUCKET_REJECTED = "REJECTED";

                public const string AVAILABILITY_AVAILABLE = "AVAILABLE";
                public const string AVAILABILITY_PARTIAL = "PARTIAL";
                public const string AVAILABILITY_UNAVAILABLE = "UNAVAILABLE";
                public const string AVAILABILITY_UNKNOWN = "UNKNOWN";

                public const string LINE_REQUESTED = "REQUESTED";
                public const string LINE_RECOMMENDATION_PENDING = "RECOMMENDATION_PENDING";
                public const string LINE_RECOMMENDATION_APPROVED = "RECOMMENDATION_APPROVED";
                public const string LINE_EXCLUDED = "EXCLUDED";

                public const string RECOMMENDATION_PENDING = "PENDING";
                public const string RECOMMENDATION_APPROVED = "APPROVED";
                public const string RECOMMENDATION_REJECTED = "REJECTED";
                /// <summary>Recommendation numbers are R1, R2, ... running per bucket.</summary>
                public const string RECOMMENDATION_NUMBER_PREFIX = "R";

                public const string INTEGRATION_BUYER_ERP = "BUYER_ERP";
                public const string INTEGRATION_SUPPLIER_ERP = "SUPPLIER_ERP";
                public const string INTEGRATION_PENDING = "PENDING";
                public const string INTEGRATION_PROCESSING = "PROCESSING";
                public const string INTEGRATION_SUCCEEDED = "SUCCEEDED";
                public const string INTEGRATION_FAILED = "FAILED";
                public const string INTEGRATION_UNKNOWN = "UNKNOWN";

                public const string ERP_OPERATION_PO_CREATE = "PO_CREATE";
                public const string PURCHASE_ORDER_CREATED = "CREATED";
                public const string PURCHASE_ORDER_SOURCE_WEEKLY_BUCKET = "WEEKLY_BUCKET";
                public const string PURCHASE_ORDER_SOURCE_CONTRACT = "CONTRACT";
                /// <summary>An order created by a user of this system with the create purchase order request.</summary>
                public const string PURCHASE_ORDER_SOURCE_MANUAL = "MANUAL";
                /// <summary>The hand-off of an order to the supplier's own ERP (sales order).</summary>
                public const string ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE = "SUPPLIER_SALES_ORDER_CREATE";
                /// <summary>Status of a hand-off row when the party has no active API for it.</summary>
                public const string INTEGRATION_NOT_CONFIGURED = "NOT_CONFIGURED";
                public const string PURCHASE_ORDER_ERP_NOT_CONFIGURED = "NOT_CONFIGURED";
                public const string PURCHASE_ORDER_ERP_PENDING = "PENDING";
                public const string PURCHASE_ORDER_ERP_SYNCED = "SYNCED";
                public const string PURCHASE_ORDER_ERP_FAILED = "FAILED";
                public const string PURCHASE_ORDER_ERP_UNKNOWN = "UNKNOWN";
                public const string ERP_DOCUMENT_PO = "PO";
                public const string ERP_OPERATION_CONTRACT_CREATE = "CONTRACT_CREATE";
                public const string ERP_DOCUMENT_CONTRACT = "CONTRACT";
                public const string ERP_DOCUMENT_PR = "PR";
                public const string PAYLOAD_JSON = "JSON";
                public const string PAYLOAD_SOAP = "SOAP";
                public const string PAYLOAD_CXML = "CXML";

                public const string AUTH_NONE = "NONE";
                public const string AUTH_BASIC = "BASIC";
                public const string AUTH_API_KEY = "API_KEY";
                public const string AUTH_BEARER = "BEARER";
                public const string AUTH_OAUTH2_CLIENT_CREDENTIALS = "OAUTH2_CLIENT_CREDENTIALS";

                public const string AUDIT_CREATED = "CREATED";
                public const string AUDIT_MODIFIED = "MODIFIED";
                public const string AUDIT_SUBMITTED = "SUBMITTED";
                public const string AUDIT_APPROVAL_STARTED = "APPROVAL_STARTED";
                public const string AUDIT_APPROVED = "APPROVED";
                public const string AUDIT_REJECTED = "REJECTED";
                public const string AUDIT_ERP_STARTED = "ERP_INTEGRATION_STARTED";
                public const string AUDIT_ERP_SUCCEEDED = "ERP_INTEGRATION_SUCCEEDED";
                public const string AUDIT_ERP_FAILED = "ERP_INTEGRATION_FAILED";
                public const string AUDIT_SUPPLIER_STARTED = "SUPPLIER_INTEGRATION_STARTED";
                public const string AUDIT_SUPPLIER_SUCCEEDED = "SUPPLIER_INTEGRATION_SUCCEEDED";
                public const string AUDIT_SUPPLIER_FAILED = "SUPPLIER_INTEGRATION_FAILED";
                public const string AUDIT_RETRY = "RETRY";
                public const string AUDIT_CANCELLED = "CANCELLED";
                public const string AUDIT_FROZEN = "FROZEN";
                public const string AUDIT_ITEM_ADDED = "ITEM_ADDED";
                public const string AUDIT_QUANTITY_CHANGED = "QUANTITY_CHANGED";
                public const string AUDIT_ITEM_REMOVED = "ITEM_REMOVED";
                public const string AUDIT_INVENTORY_REFRESHED = "INVENTORY_REFRESHED";
                public const string AUDIT_RECOMMENDATION_CREATED = "RECOMMENDATION_CREATED";
                public const string AUDIT_RECOMMENDATION_APPROVED = "RECOMMENDATION_APPROVED";
                public const string AUDIT_RECOMMENDATION_REJECTED = "RECOMMENDATION_REJECTED";
                public const string IDEMPOTENCY_HEADER = "Idempotency-Key";
        }
}

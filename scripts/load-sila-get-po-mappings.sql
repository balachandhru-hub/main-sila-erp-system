-- SILA ME field mappings for FIVE S4 - GET PO (API_PURCHASEORDER_PROCESS_SRV).
-- Idempotent: existing target fields for this configuration are left as they are.
-- Also ensures $expand=to_PurchaseOrderItem on the resource path so items are returned with the header.

DECLARE @Config uniqueidentifier = '21f72653-7a88-470a-b4d5-c396178de92b';
DECLARE @Actor uniqueidentifier = '5c4474fc-5eac-410b-bff4-c04f51195ff6';
DECLARE @Now datetime2 = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM buyersystem.api_integration_configuration
    WHERE id = @Config AND is_active = 1 AND process_type = N'GET_PO'
)
BEGIN
    THROW 50001, 'FIVE S4 - GET PO configuration 21f72653-7a88-470a-b4d5-c396178de92b not found.', 1;
END;

-- Expand items with the header (V2 nav property). Keep any existing query string except duplicate expand.
UPDATE buyersystem.api_integration_configuration
SET resource_path = N'sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder?$expand=to_PurchaseOrderItem',
    date_updated = @Now,
    updated_by = @Actor
WHERE id = @Config
  AND (resource_path IS NULL
       OR resource_path NOT LIKE N'%$expand=to_PurchaseOrderItem%');

;WITH maps AS (
    SELECT * FROM (VALUES
        (N'PurchaseOrder', N'Po.Number', N'TRIM'),
        (N'Supplier', N'Po.SupplierCode', N'UPPER'),
        (N'CompanyCode', N'Po.CompanyCode', N'UPPER'),
        (N'DocumentCurrency', N'Po.Currency', N'UPPER'),
        (N'PurchaseOrderDate', N'Po.OrderDate', CAST(NULL AS nvarchar(50))),
        (N'to_PurchaseOrderItem/results', N'Po.Items', CAST(NULL AS nvarchar(50))),
        (N'PurchaseOrderItem', N'Po.Items.LineNumber', CAST(NULL AS nvarchar(50))),
        (N'Material', N'Po.Items.MaterialCode', N'UPPER'),
        (N'PurchaseOrderItemText', N'Po.Items.Description', N'TRIM'),
        (N'OrderQuantity', N'Po.Items.Quantity', CAST(NULL AS nvarchar(50))),
        (N'PurchaseOrderQuantityUnit', N'Po.Items.Uom', N'UPPER'),
        (N'NetPriceAmount', N'Po.Items.UnitPrice', CAST(NULL AS nvarchar(50)))
    ) AS v(source_field, target_field, transformation)
)
INSERT INTO buyersystem.api_field_mapping
(
    id, configuration_id, source_field, target_field, transformation, null_policy, default_value,
    is_validated, date_created, date_updated, created_by, updated_by, is_active
)
SELECT
    NEWID(), @Config, m.source_field, m.target_field, m.transformation, N'IGNORE_NULL', NULL,
    1, @Now, @Now, @Actor, @Actor, 1
FROM maps m
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.api_field_mapping have
    WHERE have.configuration_id = @Config
      AND have.target_field = m.target_field
      AND have.is_active = 1
);

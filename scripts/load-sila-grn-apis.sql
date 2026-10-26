-- SILA ME POST_GRN API configs for SILA Test Buyer.
-- Source: balachandhru-hub/main-backend-sila@cursor/silame-backup-47c8
--   PostGrnConfigurationTests.cs, S4HanaPostGrnAdapter.cs, AribaPostGrnAdapter.cs
-- S4 credentials: same BASIC user + protected password as existing EG Tech POST_PO
--   on my419951-api.s4hana.cloud.sap (no new secrets invented).
-- Ariba auth in previous tests was NONE; realm defaults vrealm_200086 / prealm_200086.
-- Idempotent: rows already present for this buyer + name are left as they are.
--
-- ResolveIntegration: one ACTIVE POST_GRN per entity code.
--   S4  -> EntityCode ALL, ACTIVE (used for GRN ERP posting).
--   Ariba -> EntityCode 1020, DRAFT (loaded for API Settings; does not steal ALL traffic).

DECLARE @Buyer uniqueidentifier = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @Actor uniqueidentifier = '5c4474fc-5eac-410b-bff4-c04f51195ff6';
DECLARE @S4Id uniqueidentifier = 'a8c3e1f0-4b2d-4e9a-9c7f-1d5e6a8b0c2d';
DECLARE @AribaId uniqueidentifier = 'b9d4f2e1-5c3e-4f0b-8d8a-2e6f7b9c1d3e';
DECLARE @Now datetime2 = SYSUTCDATETIME();

DECLARE @S4User nvarchar(250);
DECLARE @S4Password nvarchar(max);

SELECT @S4User = username, @S4Password = protected_password
FROM buyersystem.api_integration_configuration
WHERE id = 'c1f5e79c-1eb4-4d3d-9e6a-f07b7db57b12';

IF @S4User IS NULL
BEGIN
    THROW 50001, 'Source S4 POST_PO integration c1f5e79c-1eb4-4d3d-9e6a-f07b7db57b12 not found; cannot copy credentials.', 1;
END;

-- FIVE S4-GRN POSTING (ACTIVE, ALL). Also accepts legacy name FIVE S4 - POST GRN.
IF NOT EXISTS (
    SELECT 1 FROM buyersystem.api_integration_configuration
    WHERE buyer_id = @Buyer
      AND name IN (N'FIVE S4-GRN POSTING', N'FIVE S4 - POST GRN')
      AND is_active = 1
)
BEGIN
    INSERT INTO buyersystem.api_integration_configuration
    (
        id, buyer_id, entity_code, name, process_type, protocol, system_name,
        base_url, resource_path, authentication_type, username, protected_password,
        http_method, payload_format, request_body, headers_json,
        timeout_seconds, retry_count, page_size, is_running, status,
        date_created, date_updated, created_by, updated_by, is_active
    )
    VALUES
    (
        @S4Id, @Buyer, N'ALL', N'FIVE S4-GRN POSTING', N'POST_GRN', N'REST', N'SAP S/4',
        N'https://my419951-api.s4hana.cloud.sap',
        N'sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader',
        N'BASIC', @S4User, @S4Password,
        N'POST', N'JSON', NULL,
        N'{"Accept":"application/json","Content-Type":"application/json","x-csrf-token":"Fetch","DataServiceVersion":"2.0","MaxDataServiceVersion":"2.0"}',
        30, 2, 100, 0, N'ACTIVE',
        @Now, @Now, @Actor, @Actor, 1
    );
END;
ELSE
BEGIN
    UPDATE buyersystem.api_integration_configuration
    SET name = N'FIVE S4-GRN POSTING',
        date_updated = @Now,
        updated_by = @Actor
    WHERE buyer_id = @Buyer
      AND name = N'FIVE S4 - POST GRN'
      AND is_active = 1
      AND NOT EXISTS (
          SELECT 1 FROM buyersystem.api_integration_configuration
          WHERE buyer_id = @Buyer AND name = N'FIVE S4-GRN POSTING' AND is_active = 1
      );
END;

-- Strip invalid sample bodies (DocumentHeaderText / placeholder PO). Keep the
-- ApplyTemplate Material Document shape used until SapGrnBody is deployed on sila-api.
UPDATE buyersystem.api_integration_configuration
SET request_body = NULL,
    date_updated = @Now,
    updated_by = @Actor
WHERE name IN (N'FIVE S4-GRN POSTING', N'FIVE S4 - POST GRN')
  AND is_active = 1
  AND request_body IS NOT NULL
  AND (
        request_body LIKE N'%DocumentHeaderText%'
     OR request_body LIKE N'%4500001234%'
     OR request_body LIKE N'%MAT1001%'
  );

-- Durable S4 Material Document template (placeholders filled from the prepared GRN).
-- Required on hosts that still fall through to ToPayload (poNumber) when request_body is empty.
DECLARE @GrnTemplate nvarchar(max) = N'{
  "DocumentDate": "{{documentDate}}",
  "PostingDate": "{{oDataPostingDate}}",
  "GoodsMovementCode": "{{goodsMovementCode}}",
  "MaterialDocumentHeaderText": "{{grnNumber}}",
  "to_MaterialDocumentItem": {{items}}
}';
UPDATE buyersystem.api_integration_configuration
SET name = N'FIVE S4-GRN POSTING',
    request_body = @GrnTemplate,
    date_updated = @Now,
    updated_by = @Actor
WHERE name IN (N'FIVE S4-GRN POSTING', N'FIVE S4 - POST GRN')
  AND is_active = 1
  AND process_type = N'POST_GRN'
  AND (request_body IS NULL OR LTRIM(RTRIM(request_body)) = N'' OR request_body NOT LIKE N'%MaterialDocumentHeaderText%');

-- PascalCase item field mappings so ApplyTemplate {{items}} is not camelCase.
DECLARE @Cfg uniqueidentifier;
SELECT TOP 1 @Cfg = id FROM buyersystem.api_integration_configuration
WHERE name = N'FIVE S4-GRN POSTING' AND is_active = 1 AND process_type = N'POST_GRN';
IF @Cfg IS NOT NULL
BEGIN
    DELETE FROM buyersystem.api_field_mapping WHERE configuration_id = @Cfg;
    INSERT INTO buyersystem.api_field_mapping
        (id, configuration_id, source_field, target_field, transformation, null_policy, default_value,
         is_validated, date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (NEWID(), @Cfg, N'Material', N'Grn.Items.Material', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'Plant', N'Grn.Items.Plant', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'StorageLocation', N'Grn.Items.StorageLocation', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'GoodsMovementType', N'Grn.Items.GoodsMovementType', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'PurchaseOrder', N'Grn.Items.PurchaseOrder', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'PurchaseOrderItem', N'Grn.Items.PurchaseOrderItem', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'GoodsMovementRefDocType', N'Grn.Items.GoodsMovementRefDocType', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'EntryUnit', N'Grn.Items.EntryUnit', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1),
        (NEWID(), @Cfg, N'QuantityInEntryUnit', N'Grn.Items.QuantityInEntryUnit', NULL, N'IGNORE_NULL', NULL, 1, @Now, @Now, @Actor, @Actor, 1);
END;

-- FIVETEST-GRNPOSTING-ARIBA (DRAFT, company 1020 — previous SOAP URL + realm defaults)
IF NOT EXISTS (
    SELECT 1 FROM buyersystem.api_integration_configuration
    WHERE buyer_id = @Buyer AND name = N'FIVETEST-GRNPOSTING-ARIBA' AND is_active = 1
)
BEGIN
    INSERT INTO buyersystem.api_integration_configuration
    (
        id, buyer_id, entity_code, name, process_type, protocol, system_name,
        base_url, resource_path, authentication_type, username, protected_password,
        http_method, payload_format, request_body, headers_json,
        timeout_seconds, retry_count, page_size, is_running, status,
        date_created, date_updated, created_by, updated_by, is_active
    )
    VALUES
    (
        @AribaId, @Buyer, N'1020', N'FIVETEST-GRNPOSTING-ARIBA', N'POST_GRN', N'REST', N'Ariba',
        N'https://s1.mn1.ariba.com',
        N'Buyer/soap/fiveholdings-C1-T/ExternalReceiptImport',
        N'NONE', NULL, NULL,
        N'POST', N'SOAP',
        N'<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:Ariba:Buyer:vsap">
  <soapenv:Header>
    <urn:Headers>
      <urn:variant>vrealm_200086</urn:variant>
      <!--Optional:-->
      <urn:partition>prealm_200086</urn:partition>
    </urn:Headers>
  </soapenv:Header>
  <soapenv:Body>
    <urn:ExternalReceiptImportRequest partition="prealm_200086" variant="vrealm_200086">
      <urn:ExternalReceiptInputBean_Item>
        <urn:item>
          <urn:ERPReceiptNumber>{{grnNumber}}</urn:ERPReceiptNumber>
          <urn:ExternalReceiptItems>{{items}}</urn:ExternalReceiptItems>
          <urn:OriginatingSystem>ERP</urn:OriginatingSystem>
          <urn:ReceivableId>{{poNumber}}</urn:ReceivableId>
        </urn:item>
      </urn:ExternalReceiptInputBean_Item>
    </urn:ExternalReceiptImportRequest>
  </soapenv:Body>
</soapenv:Envelope>',
        N'{"SOAPAction":"ExternalReceiptImport","Content-Type":"text/xml"}',
        30, 2, 100, 0, N'DRAFT',
        @Now, @Now, @Actor, @Actor, 1
    );
END;

-- FIVE S4-GRN REVERSAL (ACTIVE, ALL) — dedicated 102 material-document POST.
-- Copies credentials/base URL from FIVE S4-GRN POSTING when present.
DECLARE @RevId uniqueidentifier = 'c0d5e3f2-6d4f-4a1c-9e9b-3f7a8c0d2e4f';

IF NOT EXISTS (
    SELECT 1 FROM buyersystem.api_integration_configuration
    WHERE buyer_id = @Buyer
      AND name = N'FIVE S4-GRN REVERSAL'
      AND is_active = 1
)
BEGIN
    DECLARE @RevUser nvarchar(250) = @S4User;
    DECLARE @RevPassword nvarchar(max) = @S4Password;
    DECLARE @RevBase nvarchar(500) = N'https://my419951-api.s4hana.cloud.sap';
    DECLARE @RevPath nvarchar(500) = N'sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader';
    DECLARE @RevHeaders nvarchar(max) = N'{"Accept":"application/json","Content-Type":"application/json","x-csrf-token":"Fetch","DataServiceVersion":"2.0","MaxDataServiceVersion":"2.0"}';

    SELECT TOP 1
        @RevUser = username,
        @RevPassword = protected_password,
        @RevBase = base_url,
        @RevPath = resource_path,
        @RevHeaders = COALESCE(headers_json, @RevHeaders)
    FROM buyersystem.api_integration_configuration
    WHERE buyer_id = @Buyer
      AND name IN (N'FIVE S4-GRN POSTING', N'FIVE S4 - POST GRN')
      AND is_active = 1
    ORDER BY CASE WHEN name = N'FIVE S4-GRN POSTING' THEN 0 ELSE 1 END;

    INSERT INTO buyersystem.api_integration_configuration
    (
        id, buyer_id, entity_code, name, process_type, protocol, system_name,
        base_url, resource_path, authentication_type, username, protected_password,
        http_method, payload_format, request_body, headers_json,
        timeout_seconds, retry_count, page_size, is_running, status,
        date_created, date_updated, created_by, updated_by, is_active
    )
    VALUES
    (
        @RevId, @Buyer, N'ALL', N'FIVE S4-GRN REVERSAL', N'POST_GRN_REVERSAL', N'ODATA_V2', N'SAP S/4',
        @RevBase, @RevPath, N'BASIC', @RevUser, @RevPassword,
        N'POST', N'JSON', NULL, @RevHeaders,
        30, 2, 100, 0, N'ACTIVE',
        @Now, @Now, @Actor, @Actor, 1
    );
END;
ELSE
BEGIN
    UPDATE buyersystem.api_integration_configuration
    SET process_type = N'POST_GRN_REVERSAL',
        status = N'ACTIVE',
        date_updated = @Now,
        updated_by = @Actor
    WHERE buyer_id = @Buyer
      AND name = N'FIVE S4-GRN REVERSAL'
      AND is_active = 1;
END;

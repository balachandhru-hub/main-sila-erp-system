-- SILA ME masters for SILA Test Buyer.
-- Sources: SilaTest_Operations (company codes, suppliers),
-- PRDashboardDB.Material_Stock (materials), PRDashboardDB.S4_Purchase_Order_Data (purchase orders).
-- Recipe tables on this server are empty, so this script does not insert recipes.
-- Idempotent: rows already present for this buyer are left as they are.
-- Already applied to BuyerSystemDB: 49 company codes, 49 properties, 5524 suppliers,
-- 13677 materials, 13487 purchase orders, 38771 lines.

DECLARE @Buyer uniqueidentifier = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @Org uniqueidentifier = '4fbe3656-4351-47f8-9849-908db9b51e44';
DECLARE @Actor uniqueidentifier = '5c4474fc-5eac-410b-bff4-c04f51195ff6';

INSERT INTO buyersystem.company_code_master
    (id, buyer_id, code, name, country, currency, status, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), @Buyer, u.code, u.name, NULL, 'AED', 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM SilaTest_Operations.operations.organization_unit u
WHERE u.is_active = 1
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.company_code_master c
      WHERE c.buyer_id = @Buyer AND c.code = u.code
  );

INSERT INTO buyersystem.buyer_property
    (id, buyer_id, company_code, plant_code, property_name, master_approval_flow_id,
     date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), @Buyer, u.code, u.code, u.name, NULL,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM SilaTest_Operations.operations.organization_unit u
WHERE u.is_active = 1
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.buyer_property p
      WHERE p.buyer_id = @Buyer AND p.plant_code = u.code
  );

INSERT INTO buyersystem.sila_supplier
    (id, buyer_id, supplier_code, name, tax_number, aliases, country, status, supplier_organization_id,
     legal_name, city, address, currency, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), @Buyer, s.supplier_code, s.name, s.tax_number, NULL, s.country,
       CASE WHEN s.status IS NULL OR s.status = '' THEN 'ACTIVE' ELSE s.status END,
       NULL, s.legal_name, s.city, s.address, s.currency,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM SilaTest_Operations.operations.supplier_master s
WHERE s.is_deleted = 0
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.sila_supplier x
      WHERE x.buyer_id = @Buyer AND x.supplier_code = s.supplier_code
  );

INSERT INTO buyersystem.sila_supplier
    (id, buyer_id, supplier_code, name, tax_number, aliases, country, status, supplier_organization_id,
     legal_name, city, address, currency, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), @Buyer, d.supplier_code, d.supplier_name, NULL, NULL, NULL, 'ACTIVE', NULL, NULL, NULL, NULL, NULL,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM (
    SELECT po.supplier AS supplier_code,
           COALESCE(NULLIF(MAX(su.supplier_name), ''), po.supplier) AS supplier_name
    FROM PRDashboardDB.dbo.S4_Purchase_Order_Data po
    INNER JOIN buyersystem.company_code_master cc
        ON cc.buyer_id = @Buyer AND cc.code = po.company_code AND cc.is_active = 1
    LEFT JOIN PRDashboardDB.dbo.S4_Suppliers su ON su.supplier_id = po.supplier
    WHERE po.supplier IS NOT NULL AND po.supplier <> ''
    GROUP BY po.supplier
) d
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.sila_supplier x
    WHERE x.buyer_id = @Buyer AND x.supplier_code = d.supplier_code
);

INSERT INTO buyersystem.item_buyer_master
    (id, buyer_id, description, material_code, material_group, product_type,
     base_unit_of_measure, order_unit_of_measure, alternate_unit_of_measure,
     valuation_class, unit_of_measure_mapping, sub_unit, micro_unit,
     date_created, date_updated, created_by, updated_by, is_active,
     unit_cost, currency, barcode, is_inventory_item, inventory_type,
     batch_managed, expiry_managed, shelf_life_days, serial_managed,
     standard_price, moving_average_price, source, company_code)
SELECT NEWID(), @Buyer,
       LEFT(COALESCE(NULLIF(m.description, ''), m.material_code), 500),
       m.material_code, '', 'ERP',
       COALESCE(NULLIF(m.uom, ''), 'EA'), COALESCE(NULLIF(m.uom, ''), 'EA'), COALESCE(NULLIF(m.uom, ''), 'EA'),
       '', COALESCE(NULLIF(m.uom, ''), 'EA'), NULL, NULL,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1,
       NULL, NULL, NULL, 1, 'STOCK',
       0, 0, NULL, 0,
       NULL, NULL, 'ERP', m.company_code
FROM (
    SELECT material AS material_code,
           MAX(material_description) AS description,
           MAX(base_unit) AS uom,
           CAST(MIN(plant) AS nvarchar(20)) AS company_code
    FROM PRDashboardDB.dbo.Material_Stock
    WHERE material IS NOT NULL AND material <> ''
    GROUP BY material
) m
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.item_buyer_master i
    WHERE i.buyer_id = @Buyer AND i.material_code = m.material_code AND i.is_active = 1
);

INSERT INTO buyersystem.item_buyer_master
    (id, buyer_id, description, material_code, material_group, product_type,
     base_unit_of_measure, order_unit_of_measure, alternate_unit_of_measure,
     valuation_class, unit_of_measure_mapping, sub_unit, micro_unit,
     date_created, date_updated, created_by, updated_by, is_active,
     unit_cost, currency, barcode, is_inventory_item, inventory_type,
     batch_managed, expiry_managed, shelf_life_days, serial_managed,
     standard_price, moving_average_price, source, company_code)
SELECT NEWID(), @Buyer,
       LEFT(m.material_code, 500), m.material_code, COALESCE(m.material_group, ''), 'ERP',
       COALESCE(NULLIF(m.uom, ''), 'EA'), COALESCE(NULLIF(m.uom, ''), 'EA'), COALESCE(NULLIF(m.uom, ''), 'EA'),
       '', COALESCE(NULLIF(m.uom, ''), 'EA'), NULL, NULL,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1,
       NULL, NULL, NULL, 0, 'STOCK',
       0, 0, NULL, 0,
       NULL, NULL, 'ERP', m.company_code
FROM (
    SELECT po.material AS material_code,
           MAX(po.base_unit) AS uom,
           MAX(po.material_group) AS material_group,
           MIN(po.company_code) AS company_code
    FROM PRDashboardDB.dbo.S4_Purchase_Order_Data po
    INNER JOIN buyersystem.company_code_master cc
        ON cc.buyer_id = @Buyer AND cc.code = po.company_code AND cc.is_active = 1
    WHERE po.material IS NOT NULL AND po.material <> ''
    GROUP BY po.material
) m
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.item_buyer_master i
    WHERE i.buyer_id = @Buyer AND i.material_code = m.material_code AND i.is_active = 1
);

IF OBJECT_ID('tempdb..#po') IS NOT NULL DROP TABLE #po;

CREATE TABLE #po (
    po_number nvarchar(100) NOT NULL PRIMARY KEY,
    id uniqueidentifier NOT NULL,
    supplier_id uniqueidentifier NOT NULL,
    supplier_name nvarchar(250) NULL,
    company_code nvarchar(50) NULL,
    plant_code nvarchar(50) NULL,
    currency nvarchar(10) NULL,
    order_date datetime2 NOT NULL,
    total_amount decimal(18, 4) NOT NULL
);

INSERT INTO #po (po_number, id, supplier_id, supplier_name, company_code, plant_code, currency, order_date, total_amount)
SELECT d.po_number, NEWID(), s.id, LEFT(s.name, 250),
       LEFT(d.company_code, 50), LEFT(d.plant_code, 50),
       CASE WHEN LEN(d.currency) = 3 THEN d.currency ELSE NULL END,
       d.order_date, d.total_amount
FROM (
    SELECT po.purchase_order AS po_number,
           MAX(po.supplier) AS supplier_code,
           MAX(po.company_code) AS company_code,
           MAX(po.plant) AS plant_code,
           MAX(po.document_currency) AS currency,
           COALESCE(MIN(TRY_CONVERT(datetime2, po.purchase_order_date)), SYSUTCDATETIME()) AS order_date,
           COALESCE(SUM(TRY_CONVERT(decimal(18, 4), po.net_amount)), 0) AS total_amount
    FROM PRDashboardDB.dbo.S4_Purchase_Order_Data po
    INNER JOIN buyersystem.company_code_master cc
        ON cc.buyer_id = @Buyer AND cc.code = po.company_code AND cc.is_active = 1
    WHERE po.purchase_order IS NOT NULL AND po.purchase_order <> ''
      AND po.supplier IS NOT NULL AND po.supplier <> ''
    GROUP BY po.purchase_order
) d
INNER JOIN buyersystem.sila_supplier s
    ON s.buyer_id = @Buyer AND s.supplier_code = d.supplier_code AND s.is_active = 1
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.purchase_order existing
    WHERE existing.buyer_id = @Buyer AND existing.po_number = d.po_number AND existing.is_active = 1
);

INSERT INTO buyersystem.purchase_order
    (id, buyer_id, buyer_organization_id, po_number, supplier_id, supplier_name, source_type,
     weekly_bucket_id, bucket_code, company_code, plant_code, currency, total_amount, status,
     order_date, source_system, delivery_date, date_created, date_updated, created_by, updated_by, is_active)
SELECT id, @Buyer, @Org, po_number, supplier_id, supplier_name, 'ERP',
       NULL, NULL, company_code, plant_code, currency, total_amount, 'OPEN',
       order_date, 'SAP_S4', NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM #po;

INSERT INTO buyersystem.purchase_order_item
    (id, purchase_order_id, line_number, catalog_id, sku, material_code, product_name,
     quantity, unit_of_measure, unit_price, discount_percent, line_amount, currency, outlet_id,
     storage_location, received_quantity, goods_receipt_expected,
     date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), h.id,
       COALESCE(TRY_CONVERT(int, po.purchase_order_item), 0),
       '00000000-0000-0000-0000-000000000000',
       LEFT(po.material, 100),
       LEFT(po.material, 100),
       LEFT(COALESCE(NULLIF(st.material_description, ''), NULLIF(po.material, ''), 'Material'), 500),
       COALESCE(TRY_CONVERT(decimal(18, 4), po.quantity), 0),
       LEFT(COALESCE(NULLIF(po.purchase_order_quantity_unit, ''), NULLIF(po.base_unit, ''), 'EA'), 20),
       TRY_CONVERT(decimal(18, 4), po.unit_price),
       NULL,
       COALESCE(TRY_CONVERT(decimal(18, 4), po.net_amount),
                COALESCE(TRY_CONVERT(decimal(18, 4), po.quantity), 0) * COALESCE(TRY_CONVERT(decimal(18, 4), po.unit_price), 0)),
       h.currency, NULL, NULL, 0, 1,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM PRDashboardDB.dbo.S4_Purchase_Order_Data po
INNER JOIN #po h ON h.po_number = po.purchase_order
OUTER APPLY (
    SELECT TOP 1 material_description
    FROM PRDashboardDB.dbo.Material_Stock st
    WHERE st.material = po.material
) st;

UPDATE c
SET c.currency = x.currency
FROM buyersystem.company_code_master c
INNER JOIN (
    SELECT company_code, currency
    FROM (
        SELECT company_code, currency,
               ROW_NUMBER() OVER (PARTITION BY company_code ORDER BY COUNT(*) DESC) rn
        FROM #po
        WHERE currency IS NOT NULL
        GROUP BY company_code, currency
    ) ranked
    WHERE rn = 1
) x ON x.company_code = c.code
WHERE c.buyer_id = @Buyer;

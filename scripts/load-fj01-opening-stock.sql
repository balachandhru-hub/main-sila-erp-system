-- On-hand of 300 at FJ01 for materials 1000000, 1000001 and 1007294.
-- Sets the balance to 300. Does not add 300, and does not post to SAP.
-- ponytail: a second run forces on-hand back to 300 and does not write a delta if a later movement changed it.

DECLARE @Buyer uniqueidentifier = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @Actor uniqueidentifier = '5c4474fc-5eac-410b-bff4-c04f51195ff6';
DECLARE @Qty decimal(18, 4) = 300;

DECLARE @Location uniqueidentifier;
DECLARE @Plant nvarchar(50);

SELECT @Location = l.id, @Plant = p.plant_code
FROM buyersystem.inventory_location l
LEFT JOIN buyersystem.buyer_property p ON p.id = l.property_id
WHERE l.buyer_id = @Buyer AND l.location_code = 'FJ01' AND l.is_active = 1;

IF @Location IS NULL
    THROW 50001, 'FJ01 is not an active location for SILA Test Buyer.', 1;

DECLARE @Want TABLE (material_code nvarchar(50) NOT NULL PRIMARY KEY);
INSERT INTO @Want (material_code) VALUES ('1000000'), ('1000001'), ('1007294');

IF EXISTS (
    SELECT 1
    FROM @Want w
    WHERE NOT EXISTS (
        SELECT 1
        FROM buyersystem.item_buyer_master m
        WHERE m.buyer_id = @Buyer AND m.material_code = w.material_code AND m.is_active = 1
    )
)
    THROW 50002, 'One of 1000000, 1000001, 1007294 is missing for SILA Test Buyer.', 1;

DECLARE @Pick TABLE (
    material_code nvarchar(50) NOT NULL PRIMARY KEY,
    material_id uniqueidentifier NOT NULL,
    base_uom nvarchar(20) NOT NULL,
    unit_cost decimal(18, 4) NULL
);

INSERT INTO @Pick (material_code, material_id, base_uom, unit_cost)
SELECT material_code, id, base_uom, unit_cost
FROM (
    SELECT
        w.material_code,
        m.id,
        UPPER(LTRIM(RTRIM(CASE
            WHEN m.base_unit_of_measure IS NULL OR LTRIM(RTRIM(m.base_unit_of_measure)) = '' THEN 'EA'
            ELSE m.base_unit_of_measure
        END))) AS base_uom,
        m.unit_cost,
        ROW_NUMBER() OVER (
            PARTITION BY w.material_code
            ORDER BY CASE WHEN m.company_code = @Plant THEN 0 ELSE 1 END, m.date_created
        ) AS rn
    FROM @Want w
    JOIN buyersystem.item_buyer_master m
        ON m.buyer_id = @Buyer AND m.material_code = w.material_code AND m.is_active = 1
) ranked
WHERE rn = 1;

MERGE buyersystem.inventory_balance AS target
USING @Pick AS source
ON target.location_id = @Location AND target.material_id = source.material_id
WHEN MATCHED THEN
    UPDATE SET
        on_hand_qty = @Qty,
        base_uom = source.base_uom,
        unit_cost = COALESCE(source.unit_cost, target.unit_cost),
        last_movement_on = SYSUTCDATETIME(),
        is_active = 1,
        date_updated = SYSUTCDATETIME(),
        updated_by = @Actor
WHEN NOT MATCHED THEN
    INSERT (
        id, buyer_id, location_id, material_id, on_hand_qty, in_transit_qty,
        base_uom, unit_cost, last_movement_on, date_created, date_updated,
        created_by, updated_by, is_active
    )
    VALUES (
        NEWID(), @Buyer, @Location, source.material_id, @Qty, 0,
        source.base_uom, source.unit_cost, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME(),
        @Actor, @Actor, 1
    );

DECLARE @Start int = (
    SELECT ISNULL(MAX(TRY_CONVERT(int, SUBSTRING(transaction_number, 3, 6))), 0)
    FROM buyersystem.inventory_transaction
    WHERE buyer_id = @Buyer
      AND transaction_number LIKE 'IT[0-9][0-9][0-9][0-9][0-9][0-9]'
);

INSERT INTO buyersystem.inventory_transaction (
    id, buyer_id, transaction_number, transaction_type, location_id, material_id,
    direction, quantity, base_uom, entered_quantity, entered_uom, unit_cost, value,
    reference_type, reference_id, reference_number, reason, business_date,
    date_created, date_updated, created_by, updated_by, is_active
)
SELECT
    NEWID(),
    @Buyer,
    'IT' + RIGHT('000000' + CAST(@Start + ROW_NUMBER() OVER (ORDER BY pick.material_code) AS varchar(6)), 6),
    'OPENING_STOCK',
    @Location,
    pick.material_id,
    'IN',
    @Qty,
    pick.base_uom,
    @Qty,
    pick.base_uom,
    pick.unit_cost,
    pick.unit_cost * @Qty,
    'ADJUSTMENT',
    balance.id,
    'FJ01-' + pick.material_code,
    'Opening stock set to 300 at FJ01',
    CAST(SYSUTCDATETIME() AS date),
    SYSUTCDATETIME(),
    SYSUTCDATETIME(),
    @Actor,
    @Actor,
    1
FROM @Pick pick
JOIN buyersystem.inventory_balance balance
    ON balance.location_id = @Location AND balance.material_id = pick.material_id
WHERE NOT EXISTS (
    SELECT 1
    FROM buyersystem.inventory_transaction existing
    WHERE existing.buyer_id = @Buyer
      AND existing.location_id = @Location
      AND existing.material_id = pick.material_id
      AND existing.transaction_type = 'OPENING_STOCK'
      AND existing.is_active = 1
);

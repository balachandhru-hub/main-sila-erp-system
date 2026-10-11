-- SILA ME locations for SILA Test Buyer, from the location sheet.
-- Venue is the plant. Company code is copied into plant on every property.
-- Placeholder one-store and one-outlet rows are removed, then the sheet rows are inserted.
-- Each plant gets a VENUE location named for its property. Stores and outlets sit under that venue.
-- Every material unit price is 200.
-- Idempotent: a location code already present for this buyer is not inserted again.

DECLARE @Buyer uniqueidentifier = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @Actor uniqueidentifier = '5c4474fc-5eac-410b-bff4-c04f51195ff6';

UPDATE buyersystem.buyer_property
SET plant_code = company_code,
    date_updated = SYSUTCDATETIME(),
    updated_by = @Actor
WHERE buyer_id = @Buyer
  AND plant_code <> company_code;

DECLARE @Sheet TABLE (
    venue nvarchar(20) NOT NULL,
    location_code nvarchar(50) NOT NULL,
    location_name nvarchar(200) NOT NULL,
    location_type nvarchar(20) NOT NULL,
    store_category nvarchar(20) NOT NULL
);

INSERT INTO @Sheet (venue, location_code, location_name, location_type, store_category)
VALUES
('1030','FH01','FIVE STORE BEV','STORE','BEVERAGE'),
('1030','FH02','FIVE STORE FOOD','STORE','FOOD'),
('1030','FH03','FIVE STORE GEN','STORE','GENERAL'),
('1030','FH04','FIVE STORE TOB','STORE','TOBACCO'),
('1030','FH05','FOC INV BEVERAGE','OUTLET',''),
('1030','FH06','HOUSEKEEPING GEN','OUTLET',''),
('1030','FH07','SPA PROFESSIONAL','OUTLET',''),
('1030','FH08','SPA RETAIL INV','OUTLET',''),
('1030','FH09','POMEC STORE GEN','STORE','GENERAL'),
('1030','FH10','ABOVE 21 INV BEV','OUTLET',''),
('1030','FH11','BANQUET INV BEV','OUTLET',''),
('1030','FH12','BOHEMIA INV BEV','OUTLET',''),
('1030','FH13','CINQUE INV BEV','OUTLET',''),
('1030','FH14','DELISSERRIE BEV','OUTLET',''),
('1030','FH15','IN RO DINING BEV','OUTLET',''),
('1030','FH16','MAIDEN SHANG BEV','OUTLET',''),
('1030','FH17','MINI BAR INV BEV','OUTLET',''),
('1030','FH18','NUMA INV BEV','OUTLET',''),
('1030','FH19','PENTHOUSE BEV','OUTLET',''),
('1030','FH20','POOL BAR INV BEV','OUTLET',''),
('1030','FH21','ABOVE 21 INV TOB','OUTLET',''),
('1030','FH22','BANQUET INV TOB','OUTLET',''),
('1030','FH23','BOHEMIA INV TOB','OUTLET',''),
('1030','FH24','CINQUE INV TOB','OUTLET',''),
('1030','FH25','DELISSERRIE TOB','OUTLET',''),
('1030','FH26','IN RO DINING TOB','OUTLET',''),
('1030','FH27','MAIDEN SHANG TOB','OUTLET',''),
('1030','FH28','NUMA INV TOB','OUTLET',''),
('1030','FH29','PENTHOUSE TOB','OUTLET',''),
('1030','FH30','POOL BAR INV TOB','OUTLET',''),
('1030','FH31','MINI BAR FOOD','OUTLET',''),
('1030','FH32','MINI BAR INV GEN','OUTLET',''),
('1030','FH33','JEBAL ALI PALM','OUTLET',''),
('1030','FH34','SPA STORE LINEN','STORE','GENERAL'),
('1030','FH35','HK STO LINE PALM','OUTLET',''),
('1030','FH36','DETOX ME INV BEV','OUTLET',''),
('1030','FH37','DETOX ME INV TOB','OUTLET',''),
('1030','FH38','JADE INV BEV','OUTLET',''),
('1030','FH39','JADE INV TOB','OUTLET',''),
('1030','FH40','POOL FIVE IN BEV','OUTLET',''),
('1030','FH41','POOL FIVE IN TOB','OUTLET',''),
('1030','FH42','BEACH INV BEV','OUTLET',''),
('1030','FH43','BEACH INV TOB','OUTLET',''),
('1040','PR01','BEACH DECK BEV','OUTLET',''),
('1040','PR02','BLING INV BEV','OUTLET',''),
('1040','PR03','PRAIA INV BEV','OUTLET',''),
('1040','PR04','BEACH DECK TOB','OUTLET',''),
('1040','PR05','BLING INV TOB','OUTLET',''),
('1040','PR06','PRAIA INV TOB','OUTLET',''),
('1050','FJ01','JVC STORE - BEV','STORE','BEVERAGE'),
('1050','FJ02','JVC STORE FOOD','STORE','FOOD'),
('1050','FJ03','JVC STORE - GEN','STORE','GENERAL'),
('1050','FJ04','JVC STORE - TOB','STORE','TOBACCO'),
('1050','FJ05','FOC INV BEVERAGE','OUTLET',''),
('1050','FJ06','HOUSEKEEPING GEN','OUTLET',''),
('1050','FJ07','SPA PROFESSIONAL','OUTLET',''),
('1050','FJ08','SPA RETAIL INV','OUTLET',''),
('1050','FJ09','POMEC STORE GEN','STORE','GENERAL'),
('1050','FJ10','BANQUET INV BEV','OUTLET',''),
('1050','FJ11','GOOSE ISLAND BEV','OUTLET',''),
('1050','FJ12','IN RO DINING BEV','OUTLET',''),
('1050','FJ13','MANSION INV BEV','OUTLET',''),
('1050','FJ14','MINI BAR INV BEV','OUTLET',''),
('1050','FJ15','ONE FOR THE BEV','OUTLET',''),
('1050','FJ16','POOL BAR INV BEV','OUTLET',''),
('1050','FJ17','SOUL STREET BEV','OUTLET',''),
('1050','FJ18','TRATTORIA BEV','OUTLET',''),
('1050','FJ19','BANQUET INV TOB','OUTLET',''),
('1050','FJ20','GOOSE ISLAND TOB','OUTLET',''),
('1050','FJ21','IN RO DINING TOB','OUTLET',''),
('1050','FJ22','MANSION INV TOB','OUTLET',''),
('1050','FJ23','ONE FOR THE TOB','OUTLET',''),
('1050','FJ24','POOL BAR INV TOB','OUTLET',''),
('1050','FJ25','SOUL STREET TOB','OUTLET',''),
('1050','FJ26','TRATTORIA TOB','OUTLET',''),
('1050','FJ27','MINI BAR FOOD','OUTLET',''),
('1050','FJ28','MINI BAR INV GEN','OUTLET',''),
('1050','FJ29','JEBAL ALI JVC','OUTLET',''),
('1050','FJ30','HK STO LINEN JVC','OUTLET',''),
('1060','FL01','FOC INV BEVERAGE','OUTLET',''),
('1060','FL02','LUXE STORE FOOD','STORE','FOOD'),
('1060','FL03','LUXE STORE GEN','STORE','GENERAL'),
('1060','FL04','LUXE STORE TOB','STORE','TOBACCO'),
('1060','FL05','LUXE STORE HOUSE','STORE','GENERAL'),
('1060','FL06','SPA PROFESSIONAL','OUTLET',''),
('1060','FL07','SPA INV RETAIL','OUTLET',''),
('1060','FL08','POMEC STORE GEN','STORE','GENERAL'),
('1060','FL09','IN RO DINING BEV','OUTLET',''),
('1060','FL10','GOOSE ISLAND BEV','OUTLET',''),
('1060','FL11','MINI BAR INV BEV','OUTLET',''),
('1060','FL12','BANQUETING BEV','OUTLET',''),
('1060','FL13','MICE INV BEV','OUTLET',''),
('1060','FL14','RONIN INV BEV','OUTLET',''),
('1060','FL15','CIELO INV BEV','OUTLET',''),
('1060','FL16','TETE A TETE BEV','OUTLET',''),
('1060','FL17','PARADISO INV BEV','OUTLET',''),
('1060','FL18','LOBBY LOUNGE BEV','OUTLET',''),
('1060','FL19','POOL BY PCHA BEV','OUTLET',''),
('1060','FL20','PLAYA PACHA BEV','OUTLET',''),
('1060','FL21','BEACH REST 1 BEV','OUTLET',''),
('1060','FL22','BEACH REST 2 BEV','OUTLET',''),
('1060','FL23','KIDS POOL BEV','OUTLET',''),
('1060','FL24','PLAYA PCH EV BEV','OUTLET',''),
('1060','FL25','MINI BAR FOOD','OUTLET',''),
('1060','FL26','MINI BAR INV GEN','OUTLET',''),
('1060','FL27','IN RO DINING TOB','OUTLET',''),
('1060','FL28','GOOSE ISLAND TOB','OUTLET',''),
('1060','FL29','BANQUETING TOB','OUTLET',''),
('1060','FL30','MICE INV TOB','OUTLET',''),
('1060','FL31','RONIN INV TOB','OUTLET',''),
('1060','FL32','CIELO INV TOB','OUTLET',''),
('1060','FL33','TETE A TETE TOB','OUTLET',''),
('1060','FL34','PARADISO INV TOB','OUTLET',''),
('1060','FL35','LOBBY LOUNGE TOB','OUTLET',''),
('1060','FL36','POOL BY PCH TOB','OUTLET',''),
('1060','FL37','PLAYA PACHA TOB','OUTLET',''),
('1060','FL38','BEACH REST 1 TOB','OUTLET',''),
('1060','FL39','BEACH REST 2 TOB','OUTLET',''),
('1060','FL40','KIDS POOL TOB','OUTLET',''),
('1060','FL41','PLAYA PCH EV TOB','OUTLET',''),
('1060','FL42','UAQ WAREHOU LUXE','OUTLET',''),
('1060','FL43','PACHA ICONS BEV','OUTLET',''),
('1060','FL44','PACHA ICONS TOB','OUTLET',''),
('1060','FL45','LUXE STORE BEV','STORE','BEVERAGE'),
('1060','FL46','HK ST LINEN LUXE','OUTLET',''),
('1070','FM01','FIVE MODE - IQ','OUTLET',''),
('1070','FM02','FIVE MODE - JBR','OUTLET',''),
('1070','FM03','FIVE MODE - JVC','OUTLET',''),
('1070','FM04','FIVE MODE - PALM','OUTLET',''),
('1070','FM05','FIVE MODE - ZURI','OUTLET',''),
('1210','RE01','UAQ STORE - DEV','STORE','GENERAL'),
('2000','UP01','BARRA 1','OUTLET',''),
('2000','UP02','BARRA 2','OUTLET',''),
('2000','UP03','BARRA 3','OUTLET',''),
('2000','UP04','BARRA 4','OUTLET',''),
('2000','UP05','BARRA 5','OUTLET',''),
('2000','UP06','BARRA 6 PACHA','OUTLET',''),
('2000','UP08','BARRA 8','OUTLET',''),
('2000','UP09','BARRA 9','OUTLET',''),
('2000','UP10','BARRA 10','OUTLET',''),
('2000','UP12','BARRA 12','OUTLET',''),
('2000','UP15','BARRA 15','OUTLET',''),
('2000','UP16','BARRA 16 VIP','OUTLET',''),
('2000','UP17','BARRA 17','OUTLET',''),
('2000','UP18','BARRA 18 TERRAZA','OUTLET',''),
('2000','UP19','BARRA 19 TERRAZA','OUTLET',''),
('2000','UP20','BODEGA RESTAURA.','OUTLET',''),
('2000','UP21','BARRA RTE INTERI','OUTLET',''),
('2000','UP22','BARRA RTE EXTERI','OUTLET',''),
('2000','UP23','BARRA 23','OUTLET',''),
('2000','UP24','BARRA 24','OUTLET',''),
('2000','UP25','BARRA 25','OUTLET',''),
('2000','UP27','BARRA 27 TERRAZA','OUTLET',''),
('2000','UP30','BARRA 30 GARDEN','OUTLET',''),
('2000','UP31','BARRA 31 VIP','OUTLET',''),
('2000','UP32','BARRA 32 RICARDO','OUTLET',''),
('2000','UP41','COCINA RESTAURAN','OUTLET',''),
('2000','UP50','NAVE AEROPUERTO','OUTLET',''),
('2000','UP51','CA NA PALAVA','OUTLET',''),
('2000','UP60','PRUEBAS','OUTLET',''),
('2000','UP61','EVENTOS 1','OUTLET',''),
('2000','UP62','EVENTOS 2','OUTLET',''),
('2000','UP63','EVENTOS 3','OUTLET',''),
('2000','UP70','COMIDA PERSONAL','OUTLET',''),
('2000','UP72','LIMPIEZA NOCHE','OUTLET',''),
('2000','UP73','LIMPIEZA DIA','OUTLET',''),
('2000','UP74','LIMPIEZA COCINA','OUTLET',''),
('2000','UP75','CONSUMIBLES DISC','OUTLET',''),
('2000','UP76','CONSUMIBLES RTE','OUTLET',''),
('2000','UP77','MANTENIMIENTO','OUTLET',''),
('2000','UP80','MENAJE DISCOTECA','OUTLET',''),
('2000','UP81','MENAJE RTE COCIN','OUTLET',''),
('2000','UP82','MENAJE RTE SALA','OUTLET',''),
('2000','UP90','CETIS','OUTLET',''),
('2000','UP98','ALM. DESCATALOGA','OUTLET',''),
('2000','UP99','BODEGA CENTRAL','OUTLET',''),
('2010','EH01','BARRA TERRAZA','OUTLET',''),
('2010','EH02','BAR RESTAURANTE','OUTLET',''),
('2010','EH40','MINIBAR','OUTLET',''),
('2010','EH41','COCINA','OUTLET',''),
('2010','EH42','ROOM SERVICE','OUTLET',''),
('2010','EH43','WELLNESS','OUTLET',''),
('2010','EH50','NAVE AEROPUERTO','OUTLET',''),
('2010','EH51','CA NA PALAVA','OUTLET',''),
('2010','EH60','PRUEBAS','OUTLET',''),
('2010','EH61','EVENTOS 1','OUTLET',''),
('2010','EH62','EVENTOS 2','OUTLET',''),
('2010','EH63','EVENTOS 3','OUTLET',''),
('2010','EH70','COMIDA PERSONAL','OUTLET',''),
('2010','EH71','LIMPIEZA CENTRAL','OUTLET',''),
('2010','EH72','LIMPIEZA HABITAC','OUTLET',''),
('2010','EH73','LIMPIEZA BARRAS','OUTLET',''),
('2010','EH74','LIMPIEZA COCINA','OUTLET',''),
('2010','EH75','CONSUMIBLES','OUTLET',''),
('2010','EH77','MANTENIMIENTO','OUTLET',''),
('2010','EH78','ALMACEN DESAYUNO','OUTLET',''),
('2010','EH81','MENAJE COCINA','OUTLET',''),
('2010','EH82','MENAJE SALA','OUTLET',''),
('2010','EH83','MENAJE HABITACIO','OUTLET',''),
('2010','EH98','ALM. DESCATALOGA','OUTLET','');

-- Drop the placeholder store and outlet that was created for each property.
DELETE m
FROM buyersystem.inventory_location_user_mapping m
JOIN buyersystem.inventory_location l ON l.id = m.location_id
WHERE l.buyer_id = @Buyer
  AND (l.location_code LIKE '%-STORE' OR l.location_code LIKE '%-OUTLET');

DELETE FROM buyersystem.inventory_location
WHERE buyer_id = @Buyer
  AND (location_code LIKE '%-STORE' OR location_code LIKE '%-OUTLET');

DELETE m
FROM buyersystem.buyer_outlet_user_mapping m
JOIN buyersystem.buyer_outlet o ON o.id = m.outlet_id
WHERE o.buyer_id = @Buyer
  AND o.outlet_code IN (SELECT company_code FROM buyersystem.buyer_property WHERE buyer_id = @Buyer);

DELETE FROM buyersystem.buyer_outlet
WHERE buyer_id = @Buyer
  AND outlet_code IN (SELECT company_code FROM buyersystem.buyer_property WHERE buyer_id = @Buyer);

-- One venue location per plant, carrying the property name.
INSERT INTO buyersystem.inventory_location
    (id, buyer_id, property_id, location_code, location_name, location_type, outlet_id,
     store_category, storage_location_code, transfer_enabled, sales_enabled,
     date_created, date_updated, created_by, updated_by, is_active,
     consumption_enabled, inventory_enabled, description)
SELECT NEWID(), @Buyer, p.id, p.plant_code, p.property_name, 'VENUE', NULL,
       NULL, NULL, 0, 0,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1,
       0, 0, p.property_name
FROM buyersystem.buyer_property p
WHERE p.buyer_id = @Buyer
  AND p.plant_code IN (SELECT DISTINCT venue FROM @Sheet)
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.inventory_location l
      WHERE l.buyer_id = @Buyer AND l.location_code = p.plant_code
  );

INSERT INTO buyersystem.buyer_outlet
    (id, buyer_id, outlet_name, outlet_code, description, property_id, storage_location,
     date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), @Buyer, s.location_name, s.location_code, s.location_name, p.id, s.location_code,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM @Sheet s
JOIN buyersystem.buyer_property p ON p.buyer_id = @Buyer AND p.plant_code = s.venue
WHERE s.location_type = 'OUTLET'
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.buyer_outlet o
      WHERE o.buyer_id = @Buyer AND o.outlet_code = s.location_code
  );

INSERT INTO buyersystem.inventory_location
    (id, buyer_id, property_id, location_code, location_name, location_type, outlet_id,
     store_category, storage_location_code, transfer_enabled, sales_enabled,
     date_created, date_updated, created_by, updated_by, is_active,
     consumption_enabled, inventory_enabled, description, parent_location_id)
SELECT NEWID(), @Buyer, p.id, s.location_code, s.location_name, s.location_type,
       CASE WHEN s.location_type = 'OUTLET' THEN o.id ELSE NULL END,
       NULLIF(s.store_category, ''), s.location_code,
       1, CASE WHEN s.location_type = 'OUTLET' THEN 1 ELSE 0 END,
       SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1,
       1, 1, s.location_name, v.id
FROM @Sheet s
JOIN buyersystem.buyer_property p ON p.buyer_id = @Buyer AND p.plant_code = s.venue
JOIN buyersystem.inventory_location v
  ON v.buyer_id = @Buyer AND v.location_code = s.venue AND v.location_type = 'VENUE'
LEFT JOIN buyersystem.buyer_outlet o
  ON o.buyer_id = @Buyer AND o.outlet_code = s.location_code
WHERE NOT EXISTS (
    SELECT 1 FROM buyersystem.inventory_location l
    WHERE l.buyer_id = @Buyer AND l.location_code = s.location_code
);

DECLARE @Users TABLE (user_id uniqueidentifier NOT NULL);
INSERT INTO @Users (user_id) VALUES
('dca4f6dd-d630-40f3-b349-33c0cf9edb02'),
('649c22a7-e308-4588-8816-096e24a4724f'),
('a0b4da97-69dc-4e6f-b495-cd5329ad9f02'),
('bddf4efb-bb2c-4a5a-a462-b5c274638e37');

INSERT INTO buyersystem.inventory_location_user_mapping
    (id, location_id, user_id, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), l.id, u.user_id, SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM buyersystem.inventory_location l
CROSS JOIN @Users u
WHERE l.buyer_id = @Buyer
  AND l.location_code IN (SELECT location_code FROM @Sheet UNION SELECT DISTINCT venue FROM @Sheet)
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.inventory_location_user_mapping m
      WHERE m.location_id = l.id AND m.user_id = u.user_id
  );

INSERT INTO buyersystem.buyer_outlet_user_mapping
    (id, outlet_id, user_id, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), o.id, u.user_id, SYSUTCDATETIME(), SYSUTCDATETIME(), @Actor, @Actor, 1
FROM buyersystem.buyer_outlet o
CROSS JOIN @Users u
WHERE o.buyer_id = @Buyer
  AND o.outlet_code IN (SELECT location_code FROM @Sheet WHERE location_type = 'OUTLET')
  AND NOT EXISTS (
      SELECT 1 FROM buyersystem.buyer_outlet_user_mapping m
      WHERE m.outlet_id = o.id AND m.user_id = u.user_id
  );

UPDATE buyersystem.item_buyer_master
SET unit_cost = 200,
    standard_price = 200,
    moving_average_price = 200,
    date_updated = SYSUTCDATETIME(),
    updated_by = @Actor
WHERE buyer_id = @Buyer
  AND (unit_cost IS NULL OR unit_cost <> 200 OR standard_price IS NULL OR standard_price <> 200);

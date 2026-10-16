-- SILA Test Buyer approval chains. Idempotent.
-- Recipe: Cost Controller, then F&B Director.
-- ITO: Outlet Manager, then Store Manager.
-- Inventory (stock count): Cost Controller, then Finance Manager.
-- F&B Director and Finance Manager are new roles. Their sign-in secret matches the other sila.test users.

DECLARE @actor UNIQUEIDENTIFIER = '5c4474fc-5eac-410b-bff4-c04f51195ff6';
DECLARE @org UNIQUEIDENTIFIER = '4fbe3656-4351-47f8-9849-908db9b51e44';
DECLARE @buyer UNIQUEIDENTIFIER = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @now DATETIME2 = SYSUTCDATETIME();

DECLARE @fnbRole UNIQUEIDENTIFIER = '8d2a6c40-1f7e-4b9a-9c55-6e3a1d8b4f02';
DECLARE @financeRole UNIQUEIDENTIFIER = '9e3b7d51-2a8f-4c0b-8d66-7f4b2e9c5a13';
DECLARE @outletRole UNIQUEIDENTIFIER = '7c4e1a90-6b2d-4f58-9c31-0e8a5d6f4b21';
DECLARE @costRole UNIQUEIDENTIFIER = '3f9d6c2e-5b1a-4e8f-9c7d-2a6b8e4f1c03';

DECLARE @fnbPerson UNIQUEIDENTIFIER = 'b7c2d4e1-6a18-4f33-9b20-1c5e8a3d7044';
DECLARE @financePerson UNIQUEIDENTIFIER = 'c8d3e5f2-7b29-4054-8c31-2d6f9b4e8155';
DECLARE @fnbUser UNIQUEIDENTIFIER = 'c1a0e8d2-4b6f-4a11-9e77-2d5c8b1a6f30';
DECLARE @financeUser UNIQUEIDENTIFIER = 'd2b1f9e3-5c70-4b22-8f88-3e6d9c2b7041';

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.role WHERE id = @fnbRole)
    INSERT INTO IdentitySystemDB.identitysystem.role (id, user_role, date_created, date_updated, created_by, updated_by, is_active)
    VALUES (@fnbRole, 'FNB_DIRECTOR', @now, @now, @actor, @actor, 1);

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.role WHERE id = @financeRole)
    INSERT INTO IdentitySystemDB.identitysystem.role (id, user_role, date_created, date_updated, created_by, updated_by, is_active)
    VALUES (@financeRole, 'FINANCE_MANAGER', @now, @now, @actor, @actor, 1);

INSERT INTO IdentitySystemDB.identitysystem.role_feature_mapping (id, feature_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), source.feature_id, @fnbRole, @now, @now, @actor, @actor, 1
FROM IdentitySystemDB.identitysystem.role_feature_mapping source
WHERE source.role_id = @outletRole AND source.is_active = 1
  AND NOT EXISTS (
      SELECT 1 FROM IdentitySystemDB.identitysystem.role_feature_mapping have
      WHERE have.role_id = @fnbRole AND have.feature_id = source.feature_id AND have.is_active = 1);

INSERT INTO IdentitySystemDB.identitysystem.role_feature_mapping (id, feature_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), source.feature_id, @financeRole, @now, @now, @actor, @actor, 1
FROM IdentitySystemDB.identitysystem.role_feature_mapping source
WHERE source.role_id = @costRole AND source.is_active = 1
  AND NOT EXISTS (
      SELECT 1 FROM IdentitySystemDB.identitysystem.role_feature_mapping have
      WHERE have.role_id = @financeRole AND have.feature_id = source.feature_id AND have.is_active = 1);

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.person WHERE id = @fnbPerson)
    INSERT INTO IdentitySystemDB.identitysystem.person (id, name, email, phone, organization_id, designation, department, date_created, date_updated, created_by, updated_by, is_active, address_line, country)
    VALUES (@fnbPerson, 'SILA Test F&B Director', 'sila.test.fnb.director@example.com', '9000000006', @org, 'F&B Director', 'Test', @now, @now, @actor, @actor, 1, '1 Test Street', 'India');

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.person WHERE id = @financePerson)
    INSERT INTO IdentitySystemDB.identitysystem.person (id, name, email, phone, organization_id, designation, department, date_created, date_updated, created_by, updated_by, is_active, address_line, country)
    VALUES (@financePerson, 'SILA Test Finance Manager', 'sila.test.finance.manager@example.com', '9000000007', @org, 'Finance Manager', 'Test', @now, @now, @actor, @actor, 1, '1 Test Street', 'India');

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.[user] WHERE id = @fnbUser)
    INSERT INTO IdentitySystemDB.identitysystem.[user] (id, person_id, user_name, user_secret, user_type, failed_login_attempts, date_created, date_updated, created_by, updated_by, is_active)
    SELECT @fnbUser, @fnbPerson, 'sila.test.fnb.director', user_secret, NULL, 0, @now, @now, @actor, @actor, 1
    FROM IdentitySystemDB.identitysystem.[user] WHERE user_name = 'sila.test.cost.controller';

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.[user] WHERE id = @financeUser)
    INSERT INTO IdentitySystemDB.identitysystem.[user] (id, person_id, user_name, user_secret, user_type, failed_login_attempts, date_created, date_updated, created_by, updated_by, is_active)
    SELECT @financeUser, @financePerson, 'sila.test.finance.manager', user_secret, NULL, 0, @now, @now, @actor, @actor, 1
    FROM IdentitySystemDB.identitysystem.[user] WHERE user_name = 'sila.test.cost.controller';

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.user_role_mapping WHERE user_id = @fnbUser AND role_id = @fnbRole AND is_active = 1)
    INSERT INTO IdentitySystemDB.identitysystem.user_role_mapping (id, user_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
    VALUES (NEWID(), @fnbUser, @fnbRole, @now, @now, @actor, @actor, 1);

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.user_role_mapping WHERE user_id = @financeUser AND role_id = @financeRole AND is_active = 1)
    INSERT INTO IdentitySystemDB.identitysystem.user_role_mapping (id, user_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
    VALUES (NEWID(), @financeUser, @financeRole, @now, @now, @actor, @actor, 1);

-- Approval type list used by Approval Management / SILA ME Setup.
INSERT INTO MasterDataDb.masterdata.metadata (id, [key], type, description, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), v.[key], 'APPROVAL_TYPE', v.description, @now, @now, @actor, @actor, 1
FROM (VALUES
    ('RECIPE', 'Recipe approval'),
    ('ITO', 'Internal transfer approval'),
    ('INVENTORY', 'Inventory count approval'),
    ('MATERIAL_PRICE', 'Material price approval')
) v([key], description)
WHERE NOT EXISTS (SELECT 1 FROM MasterDataDb.masterdata.metadata m WHERE m.type = 'APPROVAL_TYPE' AND m.[key] = v.[key] AND m.is_active = 1);

DECLARE @outletUser UNIQUEIDENTIFIER = 'bddf4efb-bb2c-4a5a-a462-b5c274638e37';
DECLARE @storeUser UNIQUEIDENTIFIER = '649c22a7-e308-4588-8816-096e24a4724f';
DECLARE @costUser UNIQUEIDENTIFIER = 'a0b4da97-69dc-4e6f-b495-cd5329ad9f02';
DECLARE @adminUser UNIQUEIDENTIFIER = 'dca4f6dd-d630-40f3-b349-33c0cf9edb02';

DECLARE @flows TABLE (code NVARCHAR(40), name NVARCHAR(120), type NVARCHAR(40));
INSERT INTO @flows VALUES
    ('SILA-RECIPE', 'Recipe approval', 'RECIPE'),
    ('SILA-ITO', 'Internal transfer approval', 'ITO'),
    ('SILA-INVENTORY', 'Inventory count approval', 'INVENTORY'),
    ('SILA-MATERIAL-PRICE', 'Material price approval', 'MATERIAL_PRICE');

INSERT INTO BuyerSystemDB.buyersystem.master_approval_flow
    (id, approval_code, approval_name, buyer_id, date_created, date_updated, created_by, updated_by, is_active, currency, total_amount, type, scope_kind)
SELECT NEWID(), f.code, f.name, @buyer, @now, @now, @actor, @actor, 1, 'AED', 0, f.type, 'ALL'
FROM @flows f
WHERE NOT EXISTS (
    SELECT 1 FROM BuyerSystemDB.buyersystem.master_approval_flow have
    WHERE have.buyer_id = @buyer AND have.approval_code = f.code AND have.is_active = 1);

-- Buyer admin is first so they can decide every chain; role-based IsAdministrator also bypasses level order.
DECLARE @levels TABLE (code NVARCHAR(40), user_id UNIQUEIDENTIFIER, sort_order INT);
INSERT INTO @levels VALUES
    ('SILA-RECIPE', @adminUser, 1),
    ('SILA-RECIPE', @costUser, 2),
    ('SILA-RECIPE', @fnbUser, 3),
    ('SILA-ITO', @adminUser, 1),
    ('SILA-ITO', @outletUser, 2),
    ('SILA-ITO', @storeUser, 3),
    ('SILA-INVENTORY', @adminUser, 1),
    ('SILA-INVENTORY', @costUser, 2),
    ('SILA-INVENTORY', @financeUser, 3),
    ('SILA-MATERIAL-PRICE', @adminUser, 1),
    ('SILA-MATERIAL-PRICE', @costUser, 2);

INSERT INTO BuyerSystemDB.buyersystem.approval_flow_user_mapping
    (id, approval_flow_id, user_id, [order], date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), flow.id, lvl.user_id, lvl.sort_order, @now, @now, @actor, @actor, 1
FROM @levels lvl
JOIN BuyerSystemDB.buyersystem.master_approval_flow flow
    ON flow.buyer_id = @buyer AND flow.approval_code = lvl.code AND flow.is_active = 1
WHERE NOT EXISTS (
    SELECT 1 FROM BuyerSystemDB.buyersystem.approval_flow_user_mapping have
    WHERE have.approval_flow_id = flow.id AND have.user_id = lvl.user_id AND have.is_active = 1);

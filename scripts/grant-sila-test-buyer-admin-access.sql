-- Grant sila.test.buyer.admin full SILA approval access on SILA Test Buyer.
-- Idempotent. Puts the buyer admin first on every SILA flow so they can decide
-- even when the cloud API build does not yet pass IsAdministrator into the engine.
-- Also adds the MATERIAL_PRICE flow the setups screen expects.

DECLARE @actor UNIQUEIDENTIFIER = '5c4474fc-5eac-410b-bff4-c04f51195ff6';
DECLARE @buyer UNIQUEIDENTIFIER = '15ce77a3-df16-4474-a5da-f874551782d8';
DECLARE @adminUser UNIQUEIDENTIFIER = 'dca4f6dd-d630-40f3-b349-33c0cf9edb02';
DECLARE @costUser UNIQUEIDENTIFIER = 'a0b4da97-69dc-4e6f-b495-cd5329ad9f02';
DECLARE @now DATETIME2 = SYSUTCDATETIME();

-- Approval types used by SILA ME Setup / Approval Management.
INSERT INTO MasterDataDb.masterdata.metadata (id, [key], type, description, date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), v.[key], 'APPROVAL_TYPE', v.description, @now, @now, @actor, @actor, 1
FROM (VALUES
    ('RECIPE', 'Recipe approval'),
    ('ITO', 'Internal transfer approval'),
    ('INVENTORY', 'Inventory count approval'),
    ('MATERIAL_PRICE', 'Material price approval')
) v([key], description)
WHERE NOT EXISTS (
    SELECT 1 FROM MasterDataDb.masterdata.metadata m
    WHERE m.type = 'APPROVAL_TYPE' AND m.[key] = v.[key] AND m.is_active = 1);

-- Ensure the four SILA flows exist (ALL scope).
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

-- Bump existing approvers so the buyer admin can sit at order 1.
UPDATE m
SET m.[order] = m.[order] + 1,
    m.date_updated = @now,
    m.updated_by = @actor
FROM BuyerSystemDB.buyersystem.approval_flow_user_mapping m
JOIN BuyerSystemDB.buyersystem.master_approval_flow f ON f.id = m.approval_flow_id
WHERE f.buyer_id = @buyer
  AND f.is_active = 1
  AND m.is_active = 1
  AND f.approval_code IN ('SILA-RECIPE', 'SILA-ITO', 'SILA-INVENTORY', 'SILA-MATERIAL-PRICE')
  AND NOT EXISTS (
      SELECT 1 FROM BuyerSystemDB.buyersystem.approval_flow_user_mapping have
      WHERE have.approval_flow_id = f.id AND have.user_id = @adminUser AND have.is_active = 1);

-- Put buyer admin first on every SILA flow.
INSERT INTO BuyerSystemDB.buyersystem.approval_flow_user_mapping
    (id, approval_flow_id, user_id, [order], date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), f.id, @adminUser, 1, @now, @now, @actor, @actor, 1
FROM BuyerSystemDB.buyersystem.master_approval_flow f
WHERE f.buyer_id = @buyer
  AND f.is_active = 1
  AND f.approval_code IN ('SILA-RECIPE', 'SILA-ITO', 'SILA-INVENTORY', 'SILA-MATERIAL-PRICE')
  AND NOT EXISTS (
      SELECT 1 FROM BuyerSystemDB.buyersystem.approval_flow_user_mapping have
      WHERE have.approval_flow_id = f.id AND have.user_id = @adminUser AND have.is_active = 1);

-- MATERIAL_PRICE needs a second approver when only the admin row was inserted above.
INSERT INTO BuyerSystemDB.buyersystem.approval_flow_user_mapping
    (id, approval_flow_id, user_id, [order], date_created, date_updated, created_by, updated_by, is_active)
SELECT NEWID(), f.id, @costUser, 2, @now, @now, @actor, @actor, 1
FROM BuyerSystemDB.buyersystem.master_approval_flow f
WHERE f.buyer_id = @buyer
  AND f.is_active = 1
  AND f.approval_code = 'SILA-MATERIAL-PRICE'
  AND NOT EXISTS (
      SELECT 1 FROM BuyerSystemDB.buyersystem.approval_flow_user_mapping have
      WHERE have.approval_flow_id = f.id AND have.user_id = @costUser AND have.is_active = 1);

-- Org already has SILA_ME; keep the mapping active.
UPDATE IdentitySystemDB.identitysystem.organization_model_mapping
SET is_active = 1, date_updated = @now, updated_by = @actor
WHERE organization_id = '4fbe3656-4351-47f8-9849-908db9b51e44'
  AND model_id = '515bc4e8-be65-48af-8433-dc65c9c40dbd';

-- Clear any lockout on the test buyer admin.
UPDATE IdentitySystemDB.identitysystem.[user]
SET failed_login_attempts = 0, lockout_end = NULL, date_updated = @now, updated_by = @actor
WHERE id = @adminUser;

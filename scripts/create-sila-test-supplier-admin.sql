-- Ensure sila.test.supplier.admin is a supplier organization administrator.
-- One role only: SUPPLIER_ADMINISTRATOR. No buyer or SILA Store roles.
-- Password matches the other SILA test sign-in.
-- Idempotent. Safe to run again.

DECLARE @userName NVARCHAR(200) = N'sila.test.supplier.admin';
DECLARE @roleId UNIQUEIDENTIFIER = '735bb267-fec0-489f-8249-d3d65b3857ea';
DECLARE @secret NVARCHAR(200) = N'$2a$11$c1jdhiMBA2iuhsgas3uhdummMU9CxM1f4eB11ZEs/2aRkyWHtprMi';
DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @actor UNIQUEIDENTIFIER = '5c4474fc-5eac-410b-bff4-c04f51195ff6';

DECLARE @orgId UNIQUEIDENTIFIER = '697d316d-e309-4757-abd2-b1c708fe676e';
DECLARE @personId UNIQUEIDENTIFIER = '5eb24567-6a42-4576-810a-eb043234cd2e';
DECLARE @userId UNIQUEIDENTIFIER = 'e9f4286f-ab12-44f0-814b-45e5f0a1045f';
DECLARE @mappingId UNIQUEIDENTIFIER = '7ed8c33f-84a7-42ad-83e2-f288b2fc1015';
DECLARE @profileId UNIQUEIDENTIFIER = '1308268e-17d8-4037-9cdd-6725c7145bae';

IF NOT EXISTS (SELECT 1 FROM IdentitySystemDB.identitysystem.[user] WHERE user_name = @userName)
BEGIN
    INSERT INTO IdentitySystemDB.identitysystem.organizations
        (id, organization_name, organization_type, email, phone, country,
         address_line1, city, state, pin_code, email_verified,
         date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (@orgId, N'SILA Test Supplier', 2, N'sila.test.supplier@example.com', N'+971500000001', N'United Arab Emirates',
         N'SILA Test', N'Dubai', N'Dubai', N'00000', 1,
         @now, @now, @actor, @actor, 1);

    INSERT INTO IdentitySystemDB.identitysystem.person
        (id, name, email, phone, organization_id, designation, country, address_line,
         date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (@personId, N'SILA Test Supplier Admin', N'sila.test.supplier.admin@example.com', N'+971500000001', @orgId,
         N'Supplier Administrator', N'United Arab Emirates', N'SILA Test',
         @now, @now, @actor, @actor, 1);

    INSERT INTO IdentitySystemDB.identitysystem.[user]
        (id, person_id, user_name, user_secret, failed_login_attempts,
         date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (@userId, @personId, @userName, @secret, 0,
         @now, @now, @actor, @actor, 1);

    INSERT INTO IdentitySystemDB.identitysystem.user_role_mapping
        (id, user_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (@mappingId, @userId, @roleId, @now, @now, @actor, @actor, 1);

    DECLARE @snid NVARCHAR(32) =
        (SELECT snid FROM IdentitySystemDB.identitysystem.organizations WHERE id = @orgId);

    IF NOT EXISTS (
        SELECT 1 FROM SupplierDb.supplier.supplier_business_profile WHERE organization_id = @orgId)
    BEGIN
        INSERT INTO SupplierDb.supplier.supplier_business_profile
            (id, organization_id, organization_name, snid, email, phone, country,
             address_line1, city, state, pin_code, industry, business_type, currency, status,
             date_created, date_updated, created_by, updated_by, is_active)
        VALUES
            (@profileId, @orgId, N'SILA Test Supplier', @snid, N'sila.test.supplier@example.com', N'+971500000001',
             N'United Arab Emirates', N'SILA Test', N'Dubai', N'Dubai', N'00000',
             N'Food service', N'Supplier', N'AED', N'VERIFIED',
             @now, @now, @actor, @actor, 1);
    END
END

DECLARE @existingUser UNIQUEIDENTIFIER =
    (SELECT id FROM IdentitySystemDB.identitysystem.[user] WHERE user_name = @userName);

UPDATE IdentitySystemDB.identitysystem.[user]
SET user_secret = @secret,
    failed_login_attempts = 0,
    lockout_end = NULL,
    is_active = 1,
    date_updated = @now,
    updated_by = @actor
WHERE id = @existingUser;

UPDATE IdentitySystemDB.identitysystem.user_role_mapping
SET is_active = 0, date_updated = @now, updated_by = @actor
WHERE user_id = @existingUser AND role_id <> @roleId AND is_active = 1;

IF NOT EXISTS (
    SELECT 1 FROM IdentitySystemDB.identitysystem.user_role_mapping
    WHERE user_id = @existingUser AND role_id = @roleId)
BEGIN
    INSERT INTO IdentitySystemDB.identitysystem.user_role_mapping
        (id, user_id, role_id, date_created, date_updated, created_by, updated_by, is_active)
    VALUES
        (NEWID(), @existingUser, @roleId, @now, @now, @actor, @actor, 1);
END
ELSE
BEGIN
    UPDATE IdentitySystemDB.identitysystem.user_role_mapping
    SET is_active = 1, date_updated = @now, updated_by = @actor
    WHERE user_id = @existingUser AND role_id = @roleId;
END

UPDATE profile
SET profile.status = N'VERIFIED',
    profile.is_active = 1,
    profile.date_updated = @now,
    profile.updated_by = @actor
FROM SupplierDb.supplier.supplier_business_profile profile
JOIN IdentitySystemDB.identitysystem.person person ON person.organization_id = profile.organization_id
WHERE person.id = (SELECT person_id FROM IdentitySystemDB.identitysystem.[user] WHERE id = @existingUser);

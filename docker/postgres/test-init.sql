-- Test Database Initialization Script
-- Creates additional test-specific databases and configurations

-- Grant privileges on the test database (hs_bridge_test is already created by POSTGRES_DB)
GRANT ALL PRIVILEGES ON DATABASE hs_bridge_test TO hs_bridge_test_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO hs_bridge_test_user;

-- Create additional test database for parallel testing
CREATE DATABASE hs_bridge_test_parallel;

-- Grant permissions to test user for parallel database
GRANT ALL PRIVILEGES ON DATABASE hs_bridge_test_parallel TO hs_bridge_test_user;

-- Create test schema if not exists
CREATE SCHEMA IF NOT EXISTS test_data;
GRANT ALL ON SCHEMA test_data TO hs_bridge_test_user;

-- Enable necessary extensions for testing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test-specific utility functions
CREATE OR REPLACE FUNCTION test_data.truncate_all_tables()
RETURNS void AS $$
DECLARE
    statements CURSOR FOR
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename != '_prisma_migrations';
BEGIN
    FOR stmt IN statements LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(stmt.tablename) || ' CASCADE;';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_data.truncate_all_tables() TO hs_bridge_test_user;

-- Create test data seeding functions
CREATE OR REPLACE FUNCTION test_data.create_test_tenant(
    tenant_name TEXT DEFAULT 'Test Company',
    tenant_slug TEXT DEFAULT 'test-company'
)
RETURNS UUID AS $$
DECLARE
    tenant_id UUID;
BEGIN
    INSERT INTO tenants (id, name, slug, is_active, max_users, created_by_id, created_at, updated_at)
    VALUES (
        uuid_generate_v4(),
        tenant_name,
        tenant_slug,
        true,
        100,
        'system',
        NOW(),
        NOW()
    ) 
    RETURNING id INTO tenant_id;
    
    RETURN tenant_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_data.create_test_tenant(TEXT, TEXT) TO hs_bridge_test_user;

-- Create test user creation function
CREATE OR REPLACE FUNCTION test_data.create_test_user(
    user_email TEXT DEFAULT 'test@example.com',
    user_first_name TEXT DEFAULT 'Test',
    user_last_name TEXT DEFAULT 'User'
)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    INSERT INTO users (id, email, first_name, last_name, password_hash, email_verified, email_verified_at, created_at, updated_at)
    VALUES (
        uuid_generate_v4(),
        user_email,
        user_first_name,
        user_last_name,
        '$2a$10$test.hash.for.testing',
        true,
        NOW(),
        NOW(),
        NOW()
    ) 
    RETURNING id INTO user_id;
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_data.create_test_user(TEXT, TEXT, TEXT) TO hs_bridge_test_user;

-- Create comprehensive test setup function
CREATE OR REPLACE FUNCTION test_data.setup_complete_test_environment()
RETURNS TABLE(tenant_id UUID, user_id UUID, admin_user_id UUID) AS $$
DECLARE
    t_id UUID;
    u_id UUID;
    a_id UUID;
BEGIN
    -- Clean existing data
    PERFORM test_data.truncate_all_tables();
    
    -- Create test tenant
    t_id := test_data.create_test_tenant();
    
    -- Create regular test user
    u_id := test_data.create_test_user();
    
    -- Create admin test user
    a_id := test_data.create_test_user('admin@test.com', 'Admin', 'User');
    
    -- Create memberships
    INSERT INTO tenant_memberships (user_id, tenant_id, role, is_primary, created_at, updated_at)
    VALUES 
        (u_id, t_id, 'MEMBER', false, NOW(), NOW()),
        (a_id, t_id, 'ADMIN', true, NOW(), NOW());
    
    RETURN QUERY SELECT t_id, u_id, a_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_data.setup_complete_test_environment() TO hs_bridge_test_user;

-- Performance optimizations for testing
ALTER SYSTEM SET synchronous_commit = off;
ALTER SYSTEM SET wal_level = minimal;
ALTER SYSTEM SET max_wal_senders = 0;
ALTER SYSTEM SET checkpoint_segments = 32;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = 16MB;
ALTER SYSTEM SET shared_buffers = 256MB;

-- Reload configuration
SELECT pg_reload_conf();

-- Create indexes for common test queries (will be applied after Prisma migrations)
-- These are commented out since they'll be created by Prisma
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_tenants_slug ON tenants(slug) WHERE is_active = true;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_users_email ON users(email) WHERE email_verified = true;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_memberships_lookup ON tenant_memberships(tenant_id, user_id);

COMMIT;
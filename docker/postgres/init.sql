-- Initialize hs_bridge database
-- This script is executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Phase 8 Configuration Management Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- For encryption functions if needed
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For enhanced indexing

-- Set timezone
SET timezone = 'UTC';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE hs_bridge TO hs_bridge_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO hs_bridge_user;

-- Phase 8: Ensure user has necessary permissions for new schema tables
-- These will be created by Prisma migrations, but user needs permissions
GRANT CREATE ON SCHEMA public TO hs_bridge_user;
GRANT USAGE ON SCHEMA public TO hs_bridge_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hs_bridge_user;
GRANT SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hs_bridge_user;

-- Set default permissions for future tables (Phase 8 configuration tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hs_bridge_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, UPDATE ON SEQUENCES TO hs_bridge_user;
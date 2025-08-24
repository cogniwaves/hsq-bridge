-- Initialize hs_bridge database
-- This script is executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE hs_bridge TO hs_bridge_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO hs_bridge_user;
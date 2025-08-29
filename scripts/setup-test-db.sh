#!/bin/bash

# Test Database Setup Script
# Sets up test database with proper schema and test data

set -e

echo "🔧 Setting up test database..."

# Load environment variables
if [ -f .env.test ]; then
    export $(cat .env.test | grep -v '^#' | xargs)
fi

# Default values if not set
export POSTGRES_TEST_PASSWORD=${POSTGRES_TEST_PASSWORD:-test_password}
export DATABASE_URL=${DATABASE_URL:-postgresql://hs_bridge_test_user:test_password@localhost:15433/hs_bridge_test}

# Function to wait for database
wait_for_db() {
    echo "⏳ Waiting for test database to be ready..."
    local max_attempts=30
    local attempt=1
    
    while ! pg_isready -h localhost -p 15433 -U hs_bridge_test_user -d hs_bridge_test > /dev/null 2>&1; do
        if [ $attempt -ge $max_attempts ]; then
            echo "❌ Test database failed to start after $max_attempts attempts"
            exit 1
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    echo "✅ Test database is ready"
}

# Function to run database migrations
run_migrations() {
    echo "📊 Running database migrations..."
    cd cw_app
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    npx prisma migrate deploy
    
    # Run database seeding if seed script exists
    if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
        echo "🌱 Seeding test database..."
        npx prisma db seed
    fi
    
    cd ..
    echo "✅ Database migrations completed"
}

# Function to verify database schema
verify_schema() {
    echo "🔍 Verifying database schema..."
    
    # Check if main tables exist
    local tables=("users" "tenants" "tenant_memberships" "tenant_invitations" "invoice_mapping" "payment_mapping")
    
    for table in "${tables[@]}"; do
        if ! PGPASSWORD=$POSTGRES_TEST_PASSWORD psql -h localhost -p 15433 -U hs_bridge_test_user -d hs_bridge_test -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';" > /dev/null 2>&1; then
            echo "❌ Table $table does not exist"
            exit 1
        fi
    done
    
    echo "✅ Database schema verification completed"
}

# Function to create test data
create_test_data() {
    echo "🧪 Creating test data..."
    
    # Use the test utility functions we created
    PGPASSWORD=$POSTGRES_TEST_PASSWORD psql -h localhost -p 15433 -U hs_bridge_test_user -d hs_bridge_test << 'EOF'
-- Create comprehensive test environment
SELECT test_data.setup_complete_test_environment();

-- Create additional test scenarios
INSERT INTO invoice_mapping (
    id, 
    hubspot_deal_id, 
    tenant_id, 
    amount, 
    currency, 
    status, 
    created_at, 
    updated_at
) 
SELECT 
    uuid_generate_v4(),
    'test-deal-' || generate_series,
    (SELECT id FROM tenants LIMIT 1),
    (random() * 10000)::numeric(10,2),
    'USD',
    'PENDING',
    NOW() - (generate_series || ' days')::interval,
    NOW()
FROM generate_series(1, 10);

-- Create test payment mappings
INSERT INTO payment_mapping (
    id,
    stripe_payment_intent_id,
    tenant_id,
    amount,
    currency,
    status,
    created_at,
    updated_at
)
SELECT 
    uuid_generate_v4(),
    'pi_test_' || generate_series,
    (SELECT id FROM tenants LIMIT 1),
    (random() * 5000)::numeric(10,2),
    'USD',
    'SUCCEEDED',
    NOW() - (generate_series || ' days')::interval,
    NOW()
FROM generate_series(1, 5);

EOF

    echo "✅ Test data creation completed"
}

# Function to run schema checks
run_schema_checks() {
    echo "🔍 Running schema integrity checks..."
    
    PGPASSWORD=$POSTGRES_TEST_PASSWORD psql -h localhost -p 15433 -U hs_bridge_test_user -d hs_bridge_test << 'EOF'
-- Check foreign key constraints
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint 
WHERE contype = 'f'
ORDER BY table_name, constraint_name;

-- Check unique constraints  
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name
FROM pg_constraint 
WHERE contype = 'u'
ORDER BY table_name;

-- Verify test functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'test_data'
ORDER BY routine_name;

EOF

    echo "✅ Schema integrity checks completed"
}

# Main execution
main() {
    echo "🚀 Starting test database setup..."
    
    # Start test database if not running
    if ! docker ps | grep -q cw_hsq_postgres_test; then
        echo "🐳 Starting test database container..."
        docker compose -f docker-compose.test.yml up -d cw_hsq_postgres_test cw_hsq_redis_test
    fi
    
    # Wait for database to be ready
    wait_for_db
    
    # Run migrations and setup
    run_migrations
    verify_schema
    create_test_data
    run_schema_checks
    
    echo "🎉 Test database setup completed successfully!"
    echo ""
    echo "📋 Test Database Information:"
    echo "   Host: localhost"
    echo "   Port: 15433" 
    echo "   Database: hs_bridge_test"
    echo "   User: hs_bridge_test_user"
    echo "   Password: $POSTGRES_TEST_PASSWORD"
    echo ""
    echo "📋 Test Redis Information:"
    echo "   Host: localhost"
    echo "   Port: 16380"
    echo ""
    echo "🧪 You can now run tests with:"
    echo "   cd cw_app && npm test"
    echo "   cd cw_dashboard && npm test"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "clean")
        echo "🧹 Cleaning test database..."
        PGPASSWORD=$POSTGRES_TEST_PASSWORD psql -h localhost -p 15433 -U hs_bridge_test_user -d hs_bridge_test -c "SELECT test_data.truncate_all_tables();"
        echo "✅ Test database cleaned"
        ;;
    "reset")
        echo "🔄 Resetting test database..."
        docker compose -f docker-compose.test.yml down -v
        main
        ;;
    "stop")
        echo "🛑 Stopping test services..."
        docker compose -f docker-compose.test.yml down
        ;;
    *)
        echo "Usage: $0 {setup|clean|reset|stop}"
        echo ""
        echo "Commands:"
        echo "  setup  - Set up test database and services (default)"
        echo "  clean  - Clean test data without destroying schema"
        echo "  reset  - Reset everything (destroy and recreate)"
        echo "  stop   - Stop test services"
        exit 1
        ;;
esac
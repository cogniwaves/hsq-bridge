-- Migration: Critical Constraints and Validations
-- Priority: IMMEDIATE - Run in production maintenance window

-- 1. Add essential CHECK constraints
ALTER TABLE invoice_mapping 
ADD CONSTRAINT invoice_amount_positive CHECK (total_amount >= 0),
ADD CONSTRAINT invoice_balance_due_valid CHECK (balance_due >= 0),
ADD CONSTRAINT currency_format CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE line_items
ADD CONSTRAINT quantity_positive CHECK (quantity > 0),
ADD CONSTRAINT unit_price_non_negative CHECK (unit_price >= 0),
ADD CONSTRAINT amount_non_negative CHECK (amount >= 0),
ADD CONSTRAINT tax_rate_valid CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100));

ALTER TABLE payment_mapping
ADD CONSTRAINT payment_amount_positive CHECK (amount > 0);

-- 2. Add currency validation function
CREATE OR REPLACE FUNCTION validate_invoice_currency_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.detected_currency IS NOT NULL 
     AND NEW.currency != NEW.detected_currency THEN
    RAISE WARNING 'Currency mismatch for invoice %: % vs detected %', 
      NEW.id, NEW.currency, NEW.detected_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_currency_consistency_trigger
  BEFORE INSERT OR UPDATE ON invoice_mapping
  FOR EACH ROW EXECUTE FUNCTION validate_invoice_currency_consistency();

-- 3. Add tax calculation validation
CREATE OR REPLACE FUNCTION validate_tax_calculations()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify total_after_tax consistency
  IF NEW.total_after_tax < NEW.subtotal_before_tax THEN
    RAISE EXCEPTION 'total_after_tax (%) cannot be less than subtotal_before_tax (%) for invoice %', 
      NEW.total_after_tax, NEW.subtotal_before_tax, NEW.invoice_id;
  END IF;
  
  -- Verify tax calculation with tolerance
  IF ABS((NEW.subtotal_before_tax + NEW.total_tax_amount) - NEW.total_after_tax) > 0.02 THEN
    RAISE WARNING 'Tax calculation inconsistency detected for invoice %: expected %, got %',
      NEW.invoice_id, 
      NEW.subtotal_before_tax + NEW.total_tax_amount, 
      NEW.total_after_tax;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_summary_validation_trigger
  BEFORE INSERT OR UPDATE ON tax_summary
  FOR EACH ROW EXECUTE FUNCTION validate_tax_calculations();

-- 4. Add audit logging
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  user_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record 
ON audit_log (table_name, record_id, timestamp DESC);

-- 5. Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER invoice_mapping_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_mapping
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER tax_summary_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tax_summary
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
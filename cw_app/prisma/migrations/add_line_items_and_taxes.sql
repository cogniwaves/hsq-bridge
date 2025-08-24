-- Migration: Add Line Items and Tax Details Support
-- Add line_items table for product-level invoice details

CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_line_item_id VARCHAR NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES invoice_mapping(id) ON DELETE CASCADE,
  
  -- Product Information
  product_name VARCHAR,
  hubspot_product_id VARCHAR,
  sku VARCHAR,
  
  -- Pricing Information
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
  amount DECIMAL(15,4) NOT NULL DEFAULT 0,
  currency VARCHAR(3),
  
  -- Discount Information
  discount_amount DECIMAL(15,4),
  discount_percentage DECIMAL(8,4),
  pre_discount_amount DECIMAL(15,4),
  total_discount DECIMAL(15,4),
  
  -- Tax Information
  tax_amount DECIMAL(15,4),
  tax_rate DECIMAL(8,4),
  tax_label VARCHAR,
  tax_category VARCHAR,
  post_tax_amount DECIMAL(15,4),
  external_tax_rate_id VARCHAR,
  
  -- HubSpot Raw Data
  hubspot_raw_data JSONB,
  
  -- HubSpot Timestamps
  hubspot_created_at TIMESTAMPTZ,
  hubspot_updated_at TIMESTAMPTZ,
  
  -- System Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT line_items_invoice_id_idx FOREIGN KEY (invoice_id) REFERENCES invoice_mapping(id)
);

-- Add indexes for performance
CREATE INDEX line_items_invoice_id_idx ON line_items(invoice_id);
CREATE INDEX line_items_hubspot_product_id_idx ON line_items(hubspot_product_id);
CREATE INDEX line_items_currency_idx ON line_items(currency);
CREATE INDEX line_items_tax_label_idx ON line_items(tax_label);
CREATE INDEX line_items_created_at_idx ON line_items(created_at);

-- Add tax_summary table for aggregated invoice tax information
CREATE TABLE tax_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoice_mapping(id) ON DELETE CASCADE,
  
  -- Tax Breakdown
  currency VARCHAR(3) NOT NULL,
  subtotal_before_tax DECIMAL(15,4) NOT NULL DEFAULT 0,
  total_tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
  total_after_tax DECIMAL(15,4) NOT NULL DEFAULT 0,
  
  -- Tax Details by Type (JSON for flexibility)
  tax_breakdown JSONB, -- {"TPS": {"rate": 5.0, "amount": 10.50}, "TVQ": {"rate": 9.975, "amount": 20.94}}
  
  -- Discount Summary
  total_discount_amount DECIMAL(15,4),
  
  -- System Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT tax_summary_invoice_unique UNIQUE(invoice_id)
);

-- Add indexes for tax_summary
CREATE INDEX tax_summary_invoice_id_idx ON tax_summary(invoice_id);
CREATE INDEX tax_summary_currency_idx ON tax_summary(currency);

-- Add currency column to invoice_mapping for real currency detection
ALTER TABLE invoice_mapping 
ADD COLUMN detected_currency VARCHAR(3);

-- Add line_items_count for quick reference
ALTER TABLE invoice_mapping 
ADD COLUMN line_items_count INTEGER DEFAULT 0;

-- Add trigger to update line_items_count
CREATE OR REPLACE FUNCTION update_line_items_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE invoice_mapping 
    SET line_items_count = line_items_count + 1 
    WHERE id = NEW.invoice_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE invoice_mapping 
    SET line_items_count = line_items_count - 1 
    WHERE id = OLD.invoice_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER line_items_count_trigger
  AFTER INSERT OR DELETE ON line_items
  FOR EACH ROW EXECUTE FUNCTION update_line_items_count();

-- Update trigger for updated_at on line_items
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER line_items_updated_at_trigger
  BEFORE UPDATE ON line_items
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER tax_summary_updated_at_trigger
  BEFORE UPDATE ON tax_summary
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
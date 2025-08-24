-- PHASE 1 CRITIQUE: Scripts SQL d'amélioration critiques
-- Basés sur les recommandations de l'expert SQL
-- Score actuel: 8.2/10 → Objectif: 9.5/10
-- 
-- ORDRE D'EXÉCUTION CRITIQUE:
-- 1. Contraintes de données (01_critical_constraints.sql)
-- 2. Index de performance (02_performance_indexes.sql) 
-- 3. Fonctions métier (03_business_functions.sql)
--
-- INSTRUCTIONS D'EXÉCUTION:
-- Exécuter ces scripts pendant une fenêtre de maintenance
-- Surveiller les performances pendant l'application des index CONCURRENTLY
-- Vérifier l'intégrité des données après les contraintes

-- Vérifications pré-migration
SELECT 'PRE-MIGRATION STATUS' as check_type;

-- 1. Vérifier le nombre d'enregistrements avant migration
SELECT 
  'invoice_mapping' as table_name, 
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE total_amount IS NULL OR total_amount < 0) as invalid_amounts,
  COUNT(*) FILTER (WHERE currency !~ '^[A-Z]{3}$') as invalid_currencies
FROM invoice_mapping

UNION ALL

SELECT 
  'line_items' as table_name,
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE quantity <= 0) as invalid_quantities,
  COUNT(*) FILTER (WHERE unit_price < 0) as invalid_prices
FROM line_items

UNION ALL

SELECT 
  'tax_summary' as table_name,
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE total_tax_amount < 0) as invalid_tax_amounts,
  COUNT(*) FILTER (WHERE total_after_tax < subtotal_before_tax) as invalid_calculations
FROM tax_summary;

-- 2. Identifier les données qui pourraient violer les nouvelles contraintes
SELECT 'POTENTIAL CONSTRAINT VIOLATIONS' as check_type;

-- Invoices avec montants négatifs
SELECT 
  'Invoices with negative amounts' as issue,
  COUNT(*) as violation_count
FROM invoice_mapping 
WHERE total_amount < 0 OR balance_due < 0;

-- Line items avec données invalides
SELECT 
  'Line items with invalid data' as issue,
  COUNT(*) as violation_count
FROM line_items 
WHERE quantity <= 0 OR unit_price < 0 OR amount < 0 
   OR (tax_rate IS NOT NULL AND (tax_rate < 0 OR tax_rate > 100));

-- Currency format issues
SELECT 
  'Invalid currency formats' as issue,
  COUNT(*) as violation_count
FROM invoice_mapping 
WHERE currency !~ '^[A-Z]{3}$';

-- Tax calculation inconsistencies
SELECT 
  'Tax calculation inconsistencies' as issue,
  COUNT(*) as violation_count
FROM tax_summary 
WHERE ABS((subtotal_before_tax + total_tax_amount) - total_after_tax) > 0.02;

-- MESSAGE D'AVERTISSEMENT
SELECT 'WARNING: Review the violation counts above before proceeding!' as warning_message;
SELECT 'If any violations exist, fix them manually before running the migration scripts.' as instruction;

-- NEXT STEPS:
-- 1. If no violations: proceed with \i prisma/migrations/01_critical_constraints.sql
-- 2. Then: \i prisma/migrations/02_performance_indexes.sql  
-- 3. Finally: \i prisma/migrations/03_business_functions.sql
-- 4. Run verification: \i scripts/sql/99_verify_phase1_success.sql

SELECT 'Ready to proceed with Phase 1 Critical Migration Scripts!' as status;
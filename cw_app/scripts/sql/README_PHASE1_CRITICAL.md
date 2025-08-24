# Phase 1 Critique - Guide d'Exécution des Scripts SQL

## 🎯 Objectif
Améliorer la qualité du schéma SQL de **8.2/10 à 9.5/10** en appliquant les recommandations critiques de l'expert SQL.

## 📋 Scripts Inclus

### Scripts de Migration (À exécuter en ordre)
1. **`00_run_phase1_critical.sql`** - Vérifications pré-migration et guide
2. **`01_critical_constraints.sql`** - Contraintes CHECK critiques et validation
3. **`02_performance_indexes.sql`** - Index de performance et vues matérialisées  
4. **`03_business_functions.sql`** - Fonctions métier et vues d'analyse

### Scripts de Contrôle
- **`99_verify_phase1_success.sql`** - Vérification post-migration
- **`98_emergency_rollback.sql`** - Rollback d'urgence (si problème)

## 🚀 Instructions d'Exécution

### Prérequis
```bash
# Se connecter à la base de données PostgreSQL
docker compose exec cw_hsq_db psql -U postgres -d cw_hsq_db
```

### Étape 1: Vérifications Pré-Migration
```sql
\i scripts/sql/00_run_phase1_critical.sql
```
**⚠️ Important:** Vérifier qu'il n'y a aucune violation avant de continuer !

### Étape 2: Appliquer les Contraintes Critiques
```sql
\i prisma/migrations/01_critical_constraints.sql
```

### Étape 3: Appliquer les Index de Performance
```sql
\i prisma/migrations/02_performance_indexes.sql
```
**Note:** Les index sont créés avec `CONCURRENTLY` pour minimiser l'impact

### Étape 4: Appliquer les Fonctions Métier  
```sql
\i prisma/migrations/03_business_functions.sql
```

### Étape 5: Vérification de Succès
```sql
\i scripts/sql/99_verify_phase1_success.sql
```

## 🎉 Résultats Attendus

### Améliorations de Sécurité des Données
- ✅ Contraintes CHECK sur montants (>= 0)
- ✅ Validation format des devises (3 lettres majuscules)
- ✅ Validation cohérence calculs de taxes
- ✅ Audit trail complet des modifications
- ✅ Triggers de validation automatique

### Améliorations de Performance
- ✅ 15+ index composites pour requêtes métier
- ✅ Index GIN pour recherches JSON
- ✅ Index partiels pour filtres fréquents
- ✅ Vue matérialisée pour dashboard
- ✅ Optimisation requêtes N+1

### Fonctions Métier Avancées
- ✅ Calcul automatique taxes canadiennes (TPS/TVQ)
- ✅ Réconciliation paiements
- ✅ Analyse qualité données
- ✅ Maintenance automatisée
- ✅ Vues métier avec associations

## 📊 Métriques de Performance

### Avant Migration (Score: 8.2/10)
- Contraintes basiques uniquement
- Index limités
- Pas de validation métier
- Pas d'audit trail

### Après Migration (Score: 9.5/10)
- Contraintes complètes avec validation
- Index optimisés pour toutes les requêtes
- Fonctions métier intégrées  
- Audit trail complet
- Vues d'analyse prêtes

## 🚨 Procédure d'Urgence

Si des problèmes surviennent après la migration :

```sql
\i scripts/sql/98_emergency_rollback.sql
```

**⚠️ Attention:** Le rollback supprime TOUTES les améliorations !

## 🔍 Tests Post-Migration

### Test des Contraintes
```sql
-- Test contrainte montant positif
INSERT INTO invoice_mapping (total_amount) VALUES (-100); -- Doit échouer
```

### Test des Fonctions
```sql
-- Test calcul taxes québécoises
SELECT calculate_canadian_taxes(100.00, 'QC');
-- Résultat attendu: {"GST": {"rate": 5.0, "amount": 5.00}, "TVQ": {"rate": 9.975, "amount": 9.98}}
```

### Test des Index
```sql
-- Vérifier utilisation des index
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM invoice_mapping 
WHERE status = 'PAID' AND currency = 'CAD' 
ORDER BY total_amount DESC;
```

## 💡 Optimisations Futures (Phase 2)

Après Phase 1, considérer :
- Partitioning par date pour gros volumes
- Réplication read-only pour analytics
- Monitoring continu performance
- Index adaptatifs selon usage

## 📞 Support

En cas de problème :
1. Vérifier logs PostgreSQL
2. Consulter `99_verify_phase1_success.sql` pour diagnostic
3. Utiliser `98_emergency_rollback.sql` si critique
4. Contacter l'équipe développement

---

**🎯 Objectif Final:** Base de données robuste, performante et prête pour la production avec intégrité des données garantie et performance optimisée pour toutes les requêtes métier.
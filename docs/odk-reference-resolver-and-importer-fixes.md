# ODK Reference Resolver & Importer Fixes

**Branch:** `feature/reference-resolver`
**Date:** 2026-03-12

## Problem Being Solved

When importing ODK form submissions, each record (event, household, verbal autopsy) needs to link to reference data — **Cluster**, **Area**, and **Staff** records. In production, these references exist in the database. But in **dev environments**, the ODK data may reference codes that don't exist locally, causing imports to fail.

## What Changed

### 1. New `ReferenceResolver` class (`api/odk/dev/reference_resolver.py`)

A dev-only utility that **auto-creates** missing reference records when `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True`:

- **`resolve_cluster(code)`** — finds or creates a Cluster, assigning it to an "Imported" province
- **`resolve_area(code, cluster)`** — finds or creates an Area, linking it to the correct cluster
- **`resolve_staff(code, cluster)`** — finds or creates a Staff (as CSA type), linking to the correct cluster
- **`_get_or_create_province()`** — uses existing province if only one exists, otherwise creates/finds an "Imported" province

### 2. Importer refactoring (events, households, verbal autopsies)

**Before:** When a reference was missing and `use_existing_if_missing` was true, the importers just grabbed `Cluster.objects.first()` / `Area.objects.first()` — pointing everything at a random existing record. This broke FK consistency (e.g., area might belong to a different cluster than the event's cluster).

**After:** The importers now use `ReferenceResolver` to create properly linked records:

```python
# Old (broken hierarchy):
cluster = Cluster.find_by(code=code) or (Cluster.objects.first() if use_existing_if_missing else None)

# New (correct hierarchy):
cluster = Cluster.find_by(code=code)
if use_existing_if_missing and not cluster:
    cluster = ReferenceResolver.resolve_cluster(code)
```

### 3. Quote fix (babies, deaths, household_members)

Fixed nested f-string quoting: `f"...{key or "NULL"}"` → `f"...{key or 'NULL'}"` (syntax error in some Python versions).

### 4. Cleanup (babies_importer)

Removed unused `from email.policy import default` import.

### 5. Comprehensive tests

- **`tests/api/odk/dev/test_reference_resolver.py`** — unit tests for the resolver itself
- **`tests/api/odk/importers/test_data_integrity.py`** — 10 integration tests verifying:
  - FK chains (Event→Cluster→Province)
  - Parent-child links (Death→Event, Baby→Event, HouseholdMember→Household)
  - Auto-created record hierarchies
  - Duplicate import idempotency
  - End-to-end pipeline counts
- **Updated importer tests** — added `test_it_auto_creates_missing_references` for both events and households importers

## Files Changed

| File | Change |
|------|--------|
| `api/odk/dev/reference_resolver.py` | New — auto-creates missing reference data |
| `api/odk/importers/form_submissions/events_importer.py` | Use ReferenceResolver instead of `.objects.first()` |
| `api/odk/importers/form_submissions/households_importer.py` | Use ReferenceResolver instead of `.objects.first()` |
| `api/odk/importers/form_submissions/verbal_autopsies_importer.py` | Use ReferenceResolver instead of `.objects.first()` |
| `api/odk/importers/form_submissions/babies_importer.py` | Quote fix, remove unused import |
| `api/odk/importers/form_submissions/deaths_importer.py` | Quote fix |
| `api/odk/importers/form_submissions/household_members_importer.py` | Quote fix |
| `tests/api/odk/dev/test_reference_resolver.py` | New — unit tests |
| `tests/api/odk/importers/test_data_integrity.py` | New — integration tests |
| `tests/api/odk/importers/test_events_importer.py` | Added auto-create test |
| `tests/api/odk/importers/test_households_importer.py` | Added auto-create test |

# ODK Dev Data Import — Design

## Problem

The project needs realistic test/dev data from real ODK Central submissions. Currently:
- `dev_generate_test_data` generates synthetic data via Faker (only Deaths)
- `odk_import_form_submissions` fetches real ODK data but fails when reference data (Province, Cluster, Area, Staff) doesn't match local DB
- `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True` falls back to `objects.first()` which lumps all mismatched records into one location

## Solution (Implemented)

Improved the existing `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING` logic in `EventsImporter` and `HouseholdsImporter`. Instead of falling back to `objects.first()`, they now use `ReferenceResolver` to auto-create missing Cluster, Area, and Staff records with proper names and relationships.

No new management command was needed — the existing `odk_import_form_submissions` now handles missing reference data correctly.

## What Changed

### New: `api/odk/dev/reference_resolver.py`

`ReferenceResolver` class with three classmethods:
- `resolve_cluster(code)` — finds existing or creates `Imported-{code}` cluster, assigns to a province
- `resolve_area(code, cluster)` — finds existing or creates area linked to cluster
- `resolve_staff(code, cluster)` — finds existing or creates CSA staff linked to cluster
- `_get_or_create_province()` — uses existing province if only one exists, otherwise creates "IM"/"Imported" province

### Modified: `EventsImporter.on_before_save_model()`

When `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True` and `find_by()` returns None, calls `ReferenceResolver` instead of `objects.first()`.

### Modified: `HouseholdsImporter.on_before_save_model()`

Same change as EventsImporter.

### Child importers unchanged

`DeathsImporter`, `BabiesImporter`, `HouseholdMembersImporter` were not modified — they resolve parent models (Event, Household) not reference data, and the parents are now correctly imported with proper references.

## Usage

```bash
# 1. Seed reference data and ODK config
python manage.py seed_database --stage dev

# 2. Set env var to enable auto-creation of missing references
export DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True

# 3. Import real ODK data (same command as production)
python manage.py odk_import_form_submissions --projects 6 --verbose
```

The key difference from before: instead of `objects.first()` silently assigning everything to the same Cluster/Area/Staff, the `ReferenceResolver` creates properly named records (`Imported-CL001`, `Imported-ST001`) with correct relationships.

## Deduplication

Handled by the existing import pipeline — `FromSubmissionImporterBase.import_submissions()` checks for existing records by primary key and skips duplicates.

## Dependencies

- pyodk (already installed)
- ODK Central credentials in `.env` (ODK_BASE_URL, ODK_USERNAME, ODK_PASSWORD)
- Seed data loaded (ETL mappings, ODK project config) via `seed_database`

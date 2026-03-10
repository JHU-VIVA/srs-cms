# ODK Fetch Dev Data — Design

## Problem

The project needs realistic test/dev data from real ODK Central submissions. Currently:
- `dev_generate_test_data` generates synthetic data via Faker (only Deaths)
- `odk_import_form_submissions` fetches real ODK data but fails when reference data (Province, Cluster, Area, Staff) doesn't match local DB
- `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True` falls back to `objects.first()` which lumps all mismatched records into one location
- No deduplication or data cleaning

## Solution

New management command `odk_fetch_dev_data` that fetches real Events + Households submissions from ODK Central with automatic reference data reconciliation, deduplication, and data cleaning.

## Architecture

```
odk_fetch_dev_data command
    |
    +-- 1. Connect to ODK Central (reuse OdkConfig.from_env())
    |
    +-- 2. Fetch raw submissions (Events + Households)
    |      reuse pyodk client.submissions.get_table()
    |
    +-- 3. Pre-scan & reconcile reference data
    |      +-- Extract unique cluster_id, area_id, staff_id
    |      +-- Extract GPS coordinates per cluster/area
    |      +-- Auto-create missing Provinces (group by GPS proximity)
    |      +-- Auto-create missing Clusters (use centroid GPS)
    |      +-- Auto-create missing Areas (link to cluster)
    |      +-- Auto-create missing Staff (link to cluster, infer type)
    |
    +-- 4. Clean & deduplicate submissions
    |      +-- Skip submissions whose key already exists in DB
    |      +-- Filter out records with missing required fields
    |      +-- Normalize field values (whitespace, dates)
    |      +-- Log skipped/cleaned records
    |
    +-- 5. Run existing import pipeline
           reuse FromSubmissionImporterBase.import_submissions()
           pass pre-fetched form_submissions (bypass live API call)
           child importers (Deaths, Babies, HouseholdMembers) run automatically
```

## Scope

### Forms to fetch
- **Events** -> Event, Death, Baby models
- **Households** -> Household, HouseholdMember models
- No Verbal Autopsies

### Data handling
- No anonymization (sandbox/test ODK project data)
- No JSON file caching (fetches live each time)
- Does not modify existing records (skip duplicates)

## Command Interface

```bash
python manage.py odk_fetch_dev_data \
    --projects 6 \
    --forms events households \
    --start-date 2025-01-01 \
    --end-date 2026-03-10 \
    --limit 100 \
    --verbose
```

### Arguments
- `--projects`: ODK project ID(s). Defaults to all enabled projects.
- `--forms`: Which form types to fetch. Choices: `events`, `households`. Defaults to both.
- `--start-date` / `--end-date`: Submission date range filter. Optional.
- `--limit`: Max submissions per form type. Optional (useful for quick dev seeding).
- `--verbose`: Show detailed progress.

## Reference Data Reconciliation (GIS-Aware)

When a submission references a cluster/area/staff that doesn't exist locally:

1. **Cluster**: Create with the code from submission. Use GPS centroid (average lat/lon across all submissions for that cluster) as geographic reference. Assign to an existing Province by GPS proximity, or create a default "Imported" Province.

2. **Area**: Create with the code from submission. Link to the resolved Cluster.

3. **Staff**: Create with the code from submission. Link to the resolved Cluster. Infer staff_type (CSA) from the form context (Events/Households forms are submitted by CSA workers).

4. **Province**: If no existing Province is geographically close to the cluster centroid, create a default "Imported" Province to hold orphan clusters.

## Deduplication

- Before importing, check the `key` field (derived from `__id`) against existing records
- Skip and log any duplicates found
- This prevents errors on re-runs

## Data Cleaning

Between fetch and import:
- Filter out submissions missing `cluster_id`, `area_id`, or `staff_id`
- Strip whitespace from string fields
- Log any submissions that fail cleaning with reason

## Integration with Existing Infrastructure

- Reuses `OdkConfig.from_env()` for ODK Central connection
- Reuses `FromSubmissionImporterBase.import_submissions()` via `form_submissions` parameter (bypasses live API fetch)
- Works with existing ETL mappings and transformers
- Can be called from `SeedLoader.generate_test_data()` for both dev and test stages
- Does NOT replace `dev_generate_test_data` (Faker fallback for offline use)

## Dependencies

- pyodk (already installed)
- ODK Central credentials in `.env` (ODK_BASE_URL, ODK_USERNAME, ODK_PASSWORD)
- Seed data loaded (ETL mappings, ODK project config) via `seed_database`

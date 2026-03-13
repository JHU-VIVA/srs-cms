# Test Coverage Expansion: Migrations, Transformers, Exporters, Import Edge Cases

**Date:** 2026-03-13
**Status:** Approved (revised after spec review)

## Overview

Expand test coverage across 4 untested areas of the SRS-CMS codebase:
1. Django data migrations (materialized view, indexes, reversibility)
2. ODK transformers (replace, strftime, factory, TransformField)
3. ODK entity list exporters (VaPreloadExporter)
4. ODK import edge cases (malformed data, missing fields, disabled projects)

## Architecture

4 new test files following the existing flat convention (one file per concern):

```
tests/
  api/
    migrations/
      __init__.py
      test_migrations.py            # 6 tests
    odk/
      transformers/
        __init__.py
        test_transformers.py        # 12 tests
      exporters/
        test_va_preload_exporter.py # 7 tests
      importers/
        test_import_edge_cases.py   # 8 tests
```

Total: ~33 new tests.

---

## File 1: `tests/api/migrations/test_migrations.py`

Tests the `0002_dashboard_stats_view` migration which creates:
- 2 indexes on the `events` table
- A materialized view `dashboard_stats` aggregating counts for 6 entity types by province

### Tests

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `test_dashboard_stats_view_exists` | The `dashboard_stats` materialized view exists in `pg_matviews` after migrations |
| 2 | `test_dashboard_stats_view_returns_correct_metrics` | Create known data via factories, refresh the view, assert `DashboardStat` returns correct counts for all 6 metrics |
| 3 | `test_dashboard_stats_view_province_breakdown` | Create data in 2 provinces, refresh view, verify per-province counts and NULL-province (total) rows |
| 4 | `test_dashboard_stats_view_refresh_updates_counts` | Create data, refresh, add more data, refresh again, verify counts updated |
| 5 | `test_migration_0002_indexes_exist` | Verify `idx_events_type_outcome_date` and `idx_events_type_id_desc` exist |
| 6 | `test_migration_reverse_drops_view_and_indexes` | Roll back `0002` via `call_command('migrate', 'api', '0001')`, verify view+indexes gone via `pg_matviews`/`pg_indexes` queries, then re-apply with `call_command('migrate', 'api', '0002')` to restore state for other tests |

### Key implementation details

- Use `django.db.connection.cursor()` to query `pg_matviews` and `pg_indexes` for verification
- Refresh materialized view with raw SQL: `REFRESH MATERIALIZED VIEW dashboard_stats`
- Use `DashboardStat` unmanaged model to query counts after refresh
- Reversibility test uses `call_command('migrate', ...)` (not `MigrationExecutor` directly) for simplicity
- Reversibility test MUST re-apply `0002` in teardown/finally to not break other tests

### Fixtures

- `refresh_dashboard_stats`: Runs `REFRESH MATERIALIZED VIEW dashboard_stats` after data setup
- Reuse existing `ProvinceFactory`, `ClusterFactory`, `EventFactory`, `DeathFactory`, etc.

---

## File 2: `tests/api/odk/transformers/test_transformers.py`

Tests the transformer pipeline: `TransformField` → `TransformerFactory` → individual transformers.

### Tests

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `test_replace_transformer_basic` | `ReplaceTransformer.transform("uuid:abc", TransformField(name="replace", args=["uuid:", ""]))` → `"abc"` |
| 2 | `test_replace_transformer_none_value` | `None` input returns `None` unchanged |
| 3 | `test_replace_transformer_non_string_coerced` | Integer `123` input is coerced to `"123"` then replaced |
| 4 | `test_strftime_transformer_basic` | `datetime(2026,1,1).strftime("%Y-%m-%d")` → `"2026-01-01"` via transformer |
| 5 | `test_strftime_transformer_none_value` | `None` input returns `None` (early return at line 4 of strftime_transformer.py) |
| 6 | `test_strftime_transformer_empty_string` | Empty string `""` returns `""` unchanged (early return at line 4, same guard as None) |
| 7 | `test_transformer_factory_returns_replace` | `TransformerFactory.get_transformer('replace')` returns `ReplaceTransformer` instance |
| 8 | `test_transformer_factory_returns_strftime` | `TransformerFactory.get_transformer('strftime')` returns `StrftimeTransformer` instance |
| 9 | `test_transformer_factory_unknown_raises` | `TransformerFactory.get_transformer('unknown')` raises `TypeError` (unpacking `None`) |
| 10 | `test_transform_field_from_json_string` | `TransformField.get('{"name":"replace","args":["a","b"]}')` parses JSON → `TransformField` with correct attrs |
| 11 | `test_transform_field_from_dict` | `TransformField.get({"name":"replace","args":["a","b"]})` constructs via `cls(**transform)` — dict is unpacked as kwargs |
| 12 | `test_transform_field_end_to_end` | `TransformField.get('{"name":"replace","args":["uuid:",""]}').transform("uuid:abc")` → `"abc"` |

### Key implementation details

- Pure unit tests, no DB needed (no `@pytest.mark.django_db`)
- Create `TransformField` instances directly with name/args/kwargs
- For strftime test, use a `datetime` object as input
- Test #11: `TransformField.get()` accepts dicts because the `elif isinstance(str)` branch is skipped, and `cls(**transform)` unpacks the dict as keyword arguments to `__init__`

---

## File 3: `tests/api/odk/exporters/test_va_preload_exporter.py`

Tests the `VaPreloadExporter` which exports `Death` records with `VA_SCHEDULED` status to ODK entity lists.

### Tests

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `test_export_scheduled_deaths` | Create `Death` records with `VA_SCHEDULED` status, run exporter, verify `exported_models` contains them |
| 2 | `test_export_skips_non_scheduled_deaths` | Deaths with `NEW_DEATH` status are not in `exported_models` |
| 3 | `test_export_validation_fails_without_etl_document` | `validate_before_execute()` returns `False`, `result.errors` contains "ETL Document not set" |
| 4 | `test_export_validation_fails_without_etl_mappings` | `validate_before_execute()` returns `False`, `result.errors` contains "ETL Document Mappings not set" |
| 5 | `test_export_validation_fails_without_primary_key` | `validate_before_execute()` returns `False`, `result.errors` contains "primary key(s)" |
| 6 | `test_export_saves_json_to_out_dir` | When `out_dir` is set to a `tempfile.mkdtemp()`, file `entity-list-{name}.json` exists after export |
| 7 | `test_export_calls_odk_entities_merge` | Verify mock's `.entities.merge` was called with `update_matched=True`, `delete_not_matched=True`, correct `entity_list_name` |

### Mock strategy for OdkConfig/client

The `VaPreloadExporter.__init__()` calls `OdkConfig.from_env()` and then `.client()`. Mock setup:

```python
@pytest.fixture
def mock_odk_client(mocker):
    """Mock the OdkConfig chain to return a mock client with entities.merge."""
    mock_client = mocker.MagicMock()
    mock_config = mocker.patch('api.odk.OdkConfig.from_env')
    mock_config.return_value.client.return_value = mock_client
    return mock_client
```

This returns a `MagicMock` where `mock_client.entities.merge` is auto-created and capturable via `assert_called_once_with(...)`.

### New factories needed

```python
class OdkEntityListFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OdkEntityList
    odk_project = factory.SubFactory(OdkProjectFactory)
    name = factory.LazyFunction(lambda: f"entity-list-{uuid.uuid4().hex[:8]}")
    is_enabled = True

class OdkEntityListExporterModelFactory(factory.django.DjangoModelFactory):
    """Factory for OdkEntityListExporter model (renamed to avoid collision
    with the existing exporter factory module)."""
    class Meta:
        model = OdkEntityListExporter
    odk_entity_list = factory.SubFactory(OdkEntityListFactory)
    etl_document = factory.SubFactory(EtlDocumentFactory)
    exporter = EntityListExporterFactory.ODK_VA_PRELOAD_EXPORTER_NAME
    is_enabled = True
```

### ETL mappings for VA exporter

The VA exporter needs ETL mappings that map `Death` model fields to export fields. Create a minimal set:
- `source_name=death_code`, `target_name=death_code`, `is_primary_key=True`, `is_required=True`
- `source_name=deceased_name`, `target_name=deceased_name`, `is_primary_key=False`

Use `EtlMappingFactory` for these, creating them directly in the test fixture rather than via seed files.

---

## File 4: `tests/api/odk/importers/test_import_edge_cases.py`

Tests error handling and edge cases in the ODK import pipeline.

### Tests

| # | Test | What it verifies | Expected behavior (from source) |
|---|------|-----------------|-------------------------------|
| 1 | `test_import_with_missing_required_field` | Submission missing a required mapped field | `result.errors` contains "ETL Record does not have a field named..." (base importer line 300-304) |
| 2 | `test_import_with_invalid_field_type` | String where int expected | `TypeCaster.cast()` handles coercion — verify the record imports with coerced value or produces error |
| 3 | `test_import_with_empty_submission_batch` | Empty `value` list from ODK API | `result.imported_models` is empty, `result.errors` is empty |
| 4 | `test_import_with_null_optional_fields` | Optional fields set to `None` | Record imports successfully with `None` values on optional fields |
| 5 | `test_import_with_malformed_gps_data` | GPS dict missing `coordinates` key | Record still imports (GPS is mapped as a dict field, not validated structurally) — verify import succeeds with malformed GPS stored |
| 6 | `test_import_with_duplicate_keys_in_batch` | Two submissions with same `__id` | First is imported, second is skipped with "Model already exists" info message (base importer line 344-348). Assert `imported_models` count is 1. |
| 7 | `test_disabled_project_not_imported` | `OdkProject.is_enabled=False` | `result.errors` contains "OdkProject not enabled" (form_submission_importer.py line 99) |
| 8 | `test_disabled_form_not_imported` | `OdkForm.is_enabled=False` | `result.errors` contains "OdkForm not not enabled" (form_submission_importer.py line 128, note: typo in source) |

### Key implementation details

- Use existing `setup` fixture pattern from `test_form_submission_importer.py` with `mock_get_table_dynamic`
- For missing field test: use `FormSubmissionFactory.create_event()` then delete a required key from the returned dict
- For duplicate keys: create two submissions with the same `__id` value
- For disabled tests: create project/form via factories, then set `is_enabled=False` and `save()` before running import

---

## Dependencies

- No new Python packages needed
- Extend `tests/factories/factories.py` with `OdkEntityListFactory` and `OdkEntityListExporterModelFactory`
- Create `__init__.py` files for new test directories: `tests/api/migrations/`, `tests/api/odk/transformers/`

## Test execution

All tests run under the existing `pipenv run pytest` command. No changes to `pytest.ini` needed.

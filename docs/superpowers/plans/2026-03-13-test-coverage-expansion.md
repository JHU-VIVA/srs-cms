# Test Coverage Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~33 tests covering 4 untested areas: Django data migrations, ODK transformers, ODK entity list exporters, and ODK import edge cases.

**Architecture:** 4 new test files in `tests/api/`, 2 new `__init__.py` files for new directories, and 2 new factory classes in the existing `tests/factories/factories.py`. Pure additions — no existing files modified except the factory module.

**Tech Stack:** pytest, pytest-django, pytest-mock, factory_boy, Django `call_command`

**Spec:** `docs/superpowers/specs/2026-03-13-test-coverage-expansion-design.md`

---

## Chunk 1: Scaffolding + Transformer Tests (pure unit tests, no DB)

### Task 1: Create directory scaffolding

**Files:**
- Create: `tests/api/migrations/__init__.py`
- Create: `tests/api/odk/transformers/__init__.py`

- [ ] **Step 1: Create empty `__init__.py` files**

```bash
mkdir -p tests/api/migrations tests/api/odk/transformers
touch tests/api/migrations/__init__.py tests/api/odk/transformers/__init__.py
```

- [ ] **Step 2: Verify pytest still collects existing tests**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest --collect-only -q 2>&1 | tail -5`
Expected: `56 tests collected`

- [ ] **Step 3: Commit**

```bash
git add tests/api/migrations/__init__.py tests/api/odk/transformers/__init__.py
git commit -m "chore: add test directory scaffolding for migrations and transformers"
```

---

### Task 2: Transformer tests — ReplaceTransformer + StrftimeTransformer

**Files:**
- Create: `tests/api/odk/transformers/test_transformers.py`
- Reference: `api/odk/transformers/replace_transformer.py`
- Reference: `api/odk/transformers/strftime_transformer.py`
- Reference: `api/odk/transformers/transformer_factory.py`
- Reference: `api/odk/transformers/transform_field.py`

These are **pure unit tests** — no database, no Django models, no fixtures from conftest.

- [ ] **Step 1: Write all 12 transformer tests**

Create `tests/api/odk/transformers/test_transformers.py`:

```python
"""
Tests for the ODK transformer pipeline.

Covers: ReplaceTransformer, StrftimeTransformer, TransformerFactory, TransformField.
All tests are pure unit tests — no database access needed.
"""
import pytest
from datetime import datetime
from api.odk.transformers.replace_transformer import ReplaceTransformer
from api.odk.transformers.strftime_transformer import StrftimeTransformer
from api.odk.transformers.transformer_factory import TransformerFactory
from api.odk.transformers.transform_field import TransformField


# ─────────────────────────────────────────────────────────────────────────────
# ReplaceTransformer
# ─────────────────────────────────────────────────────────────────────────────

class TestReplaceTransformer:
    def test_basic_replacement(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['uuid:', ''])
        result = transformer.transform('uuid:abc-123', tf)
        assert result == 'abc-123'

    def test_none_value_returns_none(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['uuid:', ''])
        result = transformer.transform(None, tf)
        assert result is None

    def test_non_string_coerced_to_string(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['1', 'X'])
        result = transformer.transform(123, tf)
        assert result == 'X23'


# ─────────────────────────────────────────────────────────────────────────────
# StrftimeTransformer
# ─────────────────────────────────────────────────────────────────────────────

class TestStrftimeTransformer:
    def test_basic_formatting(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform(datetime(2026, 1, 15), tf)
        assert result == '2026-01-15'

    def test_none_value_returns_none(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform(None, tf)
        assert result is None

    def test_empty_string_returns_empty_string(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform('', tf)
        assert result == ''


# ─────────────────────────────────────────────────────────────────────────────
# TransformerFactory
# ─────────────────────────────────────────────────────────────────────────────

class TestTransformerFactory:
    def test_returns_replace_transformer(self):
        transformer = TransformerFactory.get_transformer('replace')
        assert isinstance(transformer, ReplaceTransformer)

    def test_returns_strftime_transformer(self):
        transformer = TransformerFactory.get_transformer('strftime')
        assert isinstance(transformer, StrftimeTransformer)

    def test_unknown_name_raises(self):
        with pytest.raises(TypeError):
            TransformerFactory.get_transformer('unknown')


# ─────────────────────────────────────────────────────────────────────────────
# TransformField
# ─────────────────────────────────────────────────────────────────────────────

class TestTransformField:
    def test_from_json_string(self):
        tf = TransformField.get('{"name": "replace", "args": ["a", "b"]}')
        assert isinstance(tf, TransformField)
        assert tf.name == 'replace'
        assert tf.args == ['a', 'b']

    def test_from_dict(self):
        tf = TransformField.get({"name": "replace", "args": ["a", "b"]})
        assert isinstance(tf, TransformField)
        assert tf.name == 'replace'
        assert tf.args == ['a', 'b']

    def test_end_to_end_pipeline(self):
        result = TransformField.get(
            '{"name": "replace", "args": ["uuid:", ""]}'
        ).transform('uuid:abc-123')
        assert result == 'abc-123'
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest tests/api/odk/transformers/test_transformers.py -v`
Expected: 12 passed

- [ ] **Step 3: Commit**

```bash
git add tests/api/odk/transformers/test_transformers.py
git commit -m "test: add transformer unit tests (ReplaceTransformer, StrftimeTransformer, TransformerFactory, TransformField)"
```

---

## Chunk 2: Migration Tests (DB-dependent, materialized view)

### Task 3: Migration tests — materialized view, indexes, reversibility

**Files:**
- Create: `tests/api/migrations/test_migrations.py`
- Reference: `api/migrations/0002_dashboard_stats_view.py`
- Reference: `api/models/dashboard.py` (DashboardStat unmanaged model)

**Important context for implementer:**
- The `dashboard_stats` materialized view is created by migration `0002`. It aggregates counts for 6 metrics: `pregnancy_outcomes_total`, `deaths_total`, `households_total`, `household_members_total`, `babies_total`, `verbal_autopsies_total`.
- Each metric has per-province rows AND a NULL-province row (overall total).
- The view is NOT auto-refreshed — you must run `REFRESH MATERIALIZED VIEW dashboard_stats` after data changes.
- `DashboardStat` is an unmanaged model at `api/models/dashboard.py` with fields: `metric` (CharField, primary_key), `province_id` (IntegerField, null=True), `count` (IntegerField).

- [ ] **Step 1: Write all 6 migration tests**

Create `tests/api/migrations/test_migrations.py`:

```python
"""
Tests for Django data migrations.

Covers migration 0002_dashboard_stats_view:
- Materialized view dashboard_stats existence and correctness
- Custom indexes on events table
- Migration reversibility
"""
import pytest
from django.db import connection
from django.core.management import call_command
from api.models import (
    DashboardStat, Province, Event, Death, Baby,
    Household, HouseholdMember, VerbalAutopsy,
)
from tests.factories.factories import (
    ProvinceFactory, ClusterFactory, AreaFactory, StaffFactory,
    EventFactory, DeathFactory,
)


@pytest.fixture
def refresh_dashboard_stats():
    """Refresh the dashboard_stats materialized view."""
    def _refresh():
        with connection.cursor() as cursor:
            cursor.execute("REFRESH MATERIALIZED VIEW dashboard_stats")
    return _refresh


def _view_exists():
    """Check if dashboard_stats materialized view exists."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'dashboard_stats'"
        )
        return cursor.fetchone()[0] > 0


def _index_exists(index_name):
    """Check if a specific index exists."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM pg_indexes WHERE indexname = %s",
            [index_name]
        )
        return cursor.fetchone()[0] > 0


# ─────────────────────────────────────────────────────────────────────────────
# Materialized View Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dashboard_stats_view_exists():
    """The dashboard_stats materialized view should exist after migrations."""
    assert _view_exists(), "dashboard_stats materialized view does not exist"


@pytest.mark.django_db
def test_dashboard_stats_view_returns_correct_metrics(refresh_dashboard_stats):
    """After creating known data and refreshing, DashboardStat returns correct counts."""
    province = ProvinceFactory()
    cluster = ClusterFactory(province=province)
    area = AreaFactory(cluster=cluster)
    staff = StaffFactory(cluster=cluster, province=province)

    # Create 2 events (pregnancy outcomes: event_type=2)
    EventFactory.create_batch(2, cluster=cluster, area=area, event_staff=staff,
                              event_type=Event.EventType.PREGNANCY_OUTCOME)
    # Create 1 death event + death record
    death_event = EventFactory(cluster=cluster, area=area, event_staff=staff,
                               event_type=Event.EventType.DEATH)
    DeathFactory(event=death_event)
    # Create 1 household + 1 member
    hh = Household.objects.create(
        key='test-hh-1', cluster=cluster, area=area, event_staff=staff,
        form_version='1',
    )
    HouseholdMember.objects.create(
        key='test-hm-1', household=hh, form_version='1',
    )
    # Create 1 baby
    baby_event = EventFactory(cluster=cluster, area=area, event_staff=staff,
                              event_type=Event.EventType.PREGNANCY_OUTCOME)
    Baby.objects.create(key='test-baby-1', event=baby_event)
    # Create 1 verbal autopsy
    VerbalAutopsy.objects.create(
        key='test-va-1', cluster=cluster, area=area,
        form_version='1',
    )

    refresh_dashboard_stats()

    # Check totals (province_id IS NULL rows)
    stats = {s.metric: s.count for s in DashboardStat.objects.filter(province_id__isnull=True)}
    assert stats['pregnancy_outcomes_total'] == 3  # 2 explicit + 1 baby_event
    assert stats['deaths_total'] == 1
    assert stats['households_total'] == 1
    assert stats['household_members_total'] == 1
    assert stats['babies_total'] == 1
    assert stats['verbal_autopsies_total'] == 1


@pytest.mark.django_db
def test_dashboard_stats_view_province_breakdown(refresh_dashboard_stats):
    """Per-province counts are correct, plus NULL-province totals exist."""
    province_a = ProvinceFactory()
    province_b = ProvinceFactory()
    cluster_a = ClusterFactory(province=province_a)
    cluster_b = ClusterFactory(province=province_b)
    area_a = AreaFactory(cluster=cluster_a)
    area_b = AreaFactory(cluster=cluster_b)
    staff_a = StaffFactory(cluster=cluster_a, province=province_a)
    staff_b = StaffFactory(cluster=cluster_b, province=province_b)

    # Province A: 2 households
    Household.objects.create(key='hh-a1', cluster=cluster_a, area=area_a, event_staff=staff_a, form_version='1')
    Household.objects.create(key='hh-a2', cluster=cluster_a, area=area_a, event_staff=staff_a, form_version='1')
    # Province B: 1 household
    Household.objects.create(key='hh-b1', cluster=cluster_b, area=area_b, event_staff=staff_b, form_version='1')

    refresh_dashboard_stats()

    # Per-province
    stats_a = DashboardStat.objects.filter(metric='households_total', province_id=province_a.id).first()
    stats_b = DashboardStat.objects.filter(metric='households_total', province_id=province_b.id).first()
    assert stats_a is not None and stats_a.count == 2
    assert stats_b is not None and stats_b.count == 1

    # Overall total (NULL province_id)
    total = DashboardStat.objects.filter(metric='households_total', province_id__isnull=True).first()
    assert total is not None and total.count == 3


@pytest.mark.django_db
def test_dashboard_stats_view_refresh_updates_counts(refresh_dashboard_stats):
    """Refreshing after adding more data updates the counts."""
    province = ProvinceFactory()
    cluster = ClusterFactory(province=province)
    area = AreaFactory(cluster=cluster)
    staff = StaffFactory(cluster=cluster, province=province)

    Household.objects.create(key='hh-r1', cluster=cluster, area=area, event_staff=staff, form_version='1')
    refresh_dashboard_stats()

    count_before = DashboardStat.objects.filter(
        metric='households_total', province_id__isnull=True
    ).first().count
    assert count_before == 1

    # Add another household and refresh
    Household.objects.create(key='hh-r2', cluster=cluster, area=area, event_staff=staff, form_version='1')
    refresh_dashboard_stats()

    count_after = DashboardStat.objects.filter(
        metric='households_total', province_id__isnull=True
    ).first().count
    assert count_after == 2


# ─────────────────────────────────────────────────────────────────────────────
# Index Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_migration_0002_indexes_exist():
    """Custom indexes created by migration 0002 should exist."""
    assert _index_exists('idx_events_type_outcome_date'), \
        "Index idx_events_type_outcome_date does not exist"
    assert _index_exists('idx_events_type_id_desc'), \
        "Index idx_events_type_id_desc does not exist"


# ─────────────────────────────────────────────────────────────────────────────
# Migration Reversibility
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_migration_reverse_drops_view_and_indexes():
    """Rolling back migration 0002 should drop the view and indexes, re-applying restores them."""
    # Verify they exist before rollback
    assert _view_exists()
    assert _index_exists('idx_events_type_outcome_date')

    try:
        # Roll back to 0001
        call_command('migrate', 'api', '0001', verbosity=0)
        assert not _view_exists(), "View should not exist after rollback"
        assert not _index_exists('idx_events_type_outcome_date'), \
            "Index should not exist after rollback"
        assert not _index_exists('idx_events_type_id_desc'), \
            "Index should not exist after rollback"
    finally:
        # MUST re-apply to not break other tests
        call_command('migrate', 'api', verbosity=0)

    # Verify restored
    assert _view_exists(), "View should exist after re-applying migration"
    assert _index_exists('idx_events_type_outcome_date')
    assert _index_exists('idx_events_type_id_desc')
```

- [ ] **Step 2: Run migration tests**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest tests/api/migrations/test_migrations.py -v`
Expected: 6 passed

**Troubleshooting:** If `test_dashboard_stats_view_returns_correct_metrics` fails on counts, check:
- The materialized view SQL uses `event_type = 2` for pregnancy outcomes — verify `Event.EventType.PREGNANCY` maps to `2`.
- The view counts `events` with `event_type = 2`, so all events with PREGNANCY type are counted (including baby_event).

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest -v`
Expected: 68 passed (56 existing + 12 new)

- [ ] **Step 4: Commit**

```bash
git add tests/api/migrations/test_migrations.py
git commit -m "test: add migration tests for dashboard_stats view, indexes, and reversibility"
```

---

## Chunk 3: Exporter Tests (new factories + VaPreloadExporter)

### Task 4: Add exporter-related factories

**Files:**
- Modify: `tests/factories/factories.py` (append new factories at end)
- Reference: `api/models/models.py:315-390` (OdkEntityList, OdkEntityListExporter)
- Reference: `api/odk/exporters/entity_lists/entity_list_exporter_factory.py`

- [ ] **Step 1: Add OdkEntityListFactory and OdkEntityListExporterModelFactory**

Append to end of `tests/factories/factories.py`, before the final blank line:

```python
class OdkEntityListModelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OdkEntityList

    odk_project = factory.SubFactory(OdkProjectFactory)
    name = factory.LazyFunction(lambda: f"entity-list-{uuid.uuid4().hex[:8]}")
    is_enabled = True


class OdkEntityListExporterModelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OdkEntityListExporter

    odk_entity_list = factory.SubFactory(OdkEntityListModelFactory)
    etl_document = factory.SubFactory(EtlDocumentFactory)
    exporter = EntityListExporterFactory.ODK_VA_PRELOAD_EXPORTER_NAME
    is_enabled = True
```

Also add `OdkEntityList, OdkEntityListExporter` to the import at top of `tests/factories/factories.py`:

```python
from api.models import (OdkProject, OdkForm, EtlDocument, EtlMapping,
                        Province, Cluster, Area, Staff,
                        Event, Death, Baby,
                        Household, HouseholdMember,
                        VerbalAutopsy,
                        OdkFormImporter,
                        OdkEntityList, OdkEntityListExporter)
```

And add the `EntityListExporterFactory` import:

```python
from api.odk.exporters.entity_lists.entity_list_exporter_factory import EntityListExporterFactory
```

- [ ] **Step 2: Verify factories work**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest tests/factories/test_factories.py -v`
Expected: 4 passed (existing factory tests still work)

- [ ] **Step 3: Commit**

```bash
git add tests/factories/factories.py
git commit -m "feat: add OdkEntityListModelFactory and OdkEntityListExporterModelFactory"
```

---

### Task 5: VaPreloadExporter tests

**Files:**
- Create: `tests/api/odk/exporters/test_va_preload_exporter.py`
- Reference: `api/odk/exporters/entity_lists/va_preload_exporter.py`
- Reference: `api/odk/exporters/entity_lists/entity_list_export_result.py`

**Important context for implementer:**
- `VaPreloadExporter.__init__()` calls `OdkConfig.from_env()` then `.client(project_id=...)` — both must be mocked.
- The exporter queries `Death.objects.filter(death_status=Death.DeathStatus.VA_SCHEDULED)`.
- It loops over ETL mappings, building records with `label` field set to joined primary keys.
- It calls `self.odk_client.entities.merge(...)` to push data to ODK Central.
- `validate_before_execute()` checks: exporter is `OdkEntityListExporter` instance, has `etl_document`, has enabled mappings, has primary key mappings.

- [ ] **Step 1: Write all 7 exporter tests**

Create `tests/api/odk/exporters/test_va_preload_exporter.py`:

```python
"""
Tests for VaPreloadExporter.

Covers: export of VA_SCHEDULED deaths, validation, JSON output, ODK merge call.
All tests mock the OdkConfig/pyodk client chain.
"""
import os
import tempfile
import pytest
from api.models import Death, OdkEntityListExporter
from api.odk.exporters.entity_lists.va_preload_exporter import VaPreloadExporter
from tests.factories.factories import (
    DeathFactory, EtlMappingFactory,
    OdkEntityListExporterModelFactory,
)


@pytest.fixture
def mock_odk_client(mocker):
    """Mock the OdkConfig chain to return a mock client with entities.merge."""
    mock_client = mocker.MagicMock()
    mock_config = mocker.patch('api.odk.exporters.entity_lists.va_preload_exporter.OdkConfig.from_env')
    mock_config.return_value.client.return_value = mock_client
    return mock_client


@pytest.fixture
def exporter_with_mappings(mock_odk_client):
    """Create an OdkEntityListExporter with ETL mappings for Death fields."""
    odk_exporter = OdkEntityListExporterModelFactory()
    etl_doc = odk_exporter.etl_document

    # Primary key mapping: death_code
    EtlMappingFactory(
        etl_document=etl_doc,
        source_name='death_code',
        target_name='death_code',
        target_type='int',
        is_primary_key=True,
        is_required=True,
    )
    # Non-PK mapping: deceased_name
    EtlMappingFactory(
        etl_document=etl_doc,
        source_name='deceased_name',
        target_name='deceased_name',
        target_type='str',
        is_primary_key=False,
        is_required=False,
    )
    return odk_exporter, mock_odk_client


# ─────────────────────────────────────────────────────────────────────────────
# Happy Path
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_export_scheduled_deaths(exporter_with_mappings):
    """VA_SCHEDULED deaths should appear in exported_models."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory.create_batch(2, death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    result = exporter.execute()

    assert len(result.exported_models) == 2
    assert not result.errors


@pytest.mark.django_db
def test_export_skips_non_scheduled_deaths(exporter_with_mappings):
    """Deaths with NEW_DEATH status should not be exported."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory.create_batch(2, death_status=Death.DeathStatus.NEW_DEATH)
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    result = exporter.execute()

    assert len(result.exported_models) == 1


# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_export_validation_fails_without_etl_document(mock_odk_client):
    """Validation fails when etl_document is None."""
    odk_exporter = OdkEntityListExporterModelFactory(etl_document=None)

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('ETL Document not set' in e for e in exporter.result.errors)


@pytest.mark.django_db
def test_export_validation_fails_without_etl_mappings(mock_odk_client):
    """Validation fails when etl_document has no enabled mappings."""
    odk_exporter = OdkEntityListExporterModelFactory()
    # etl_document exists but has no mappings

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('ETL Document Mappings not set' in e for e in exporter.result.errors)


@pytest.mark.django_db
def test_export_validation_fails_without_primary_key(mock_odk_client):
    """Validation fails when mappings exist but none is primary key."""
    odk_exporter = OdkEntityListExporterModelFactory()
    EtlMappingFactory(
        etl_document=odk_exporter.etl_document,
        source_name='deceased_name',
        target_name='deceased_name',
        target_type='str',
        is_primary_key=False,
    )

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('primary key' in e for e in exporter.result.errors)


# ─────────────────────────────────────────────────────────────────────────────
# Output and ODK Integration
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_export_saves_json_to_out_dir(exporter_with_mappings):
    """When out_dir is set, an entity list JSON file is written."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)
    out_dir = tempfile.mkdtemp()

    exporter = VaPreloadExporter(odk_exporter, out_dir=out_dir)
    exporter.execute()

    expected_file = os.path.join(
        out_dir,
        f'entity-list-{odk_exporter.odk_entity_list.name}.json'
    )
    assert os.path.isfile(expected_file)


@pytest.mark.django_db
def test_export_calls_odk_entities_merge(exporter_with_mappings):
    """The exporter should call entities.merge with correct parameters."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    exporter.execute()

    mock_client.entities.merge.assert_called_once()
    call_kwargs = mock_client.entities.merge.call_args
    assert call_kwargs.kwargs['update_matched'] is True
    assert call_kwargs.kwargs['delete_not_matched'] is True
    assert call_kwargs.kwargs['entity_list_name'] == odk_exporter.odk_entity_list.name
```

- [ ] **Step 2: Run exporter tests**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest tests/api/odk/exporters/test_va_preload_exporter.py -v`
Expected: 7 passed

**Troubleshooting:** If `test_export_validation_fails_without_etl_document` fails because factory can't create with `etl_document=None`, check the `OdkEntityListExporter` model's `null=True` on the etl_document FK (it is `null=True` per models.py:364-369).

- [ ] **Step 3: Commit**

```bash
git add tests/api/odk/exporters/test_va_preload_exporter.py
git commit -m "test: add VaPreloadExporter tests (export, validation, JSON output, ODK merge)"
```

---

## Chunk 4: Import Edge Case Tests

### Task 6: Import edge case tests

**Files:**
- Create: `tests/api/odk/importers/test_import_edge_cases.py`
- Reference: `api/odk/importers/form_submissions/form_submission_importer_base.py:297-348` (error handling logic)
- Reference: `api/odk/importers/form_submissions/form_submission_importer.py:97-128` (disabled project/form checks)
- Reference: `tests/api/odk/importers/test_events_importer.py` (fixture pattern to follow)

**Important context for implementer:**
- The base importer (line 300-304) checks `etl_mapping.is_required and not has_source_field` — if true, it logs an error and breaks the mapping loop for that submission.
- Duplicate detection (line 293-295): after primary keys are set, `_find_model()` checks if a record exists. If found, it's skipped with an info message (line 344-348).
- Disabled project/form errors are generated in `form_submission_importer.py` lines 97-128.
- Use the `EventsImporter` + `mock_get_table` pattern from `test_events_importer.py` for single-form tests.
- Use `FromSubmissionImporter` + `mock_get_table_dynamic` for full pipeline tests (disabled project/form).

- [ ] **Step 1: Write all 8 edge case tests**

Create `tests/api/odk/importers/test_import_edge_cases.py`:

```python
"""
Edge case and error handling tests for the ODK import pipeline.

Covers: missing required fields, invalid types, empty batches, null optionals,
malformed GPS, duplicate keys, disabled projects/forms.
"""
import pytest
from api.models import Event, OdkProject, OdkForm
from api.odk.importers.form_submissions.events_importer import EventsImporter
from api.odk.importers.form_submissions.form_submission_importer import FromSubmissionImporter
from api.odk.importers.form_submissions.form_submission_importer_factory import FromSubmissionImporterFactory
from tests.factories.factories import (
    OdkProjectFactory, FormSubmissionFactory, ProvinceFactory,
)


DEFAULT_FORM_SUBMISSION_COUNT = 3


@pytest.fixture
def setup_events(mock_get_table):
    """Setup for single-form event import tests."""
    def _m(form_submissions=None):
        ProvinceFactory(with_clusters=True,
                        with_clusters__with_areas=True,
                        with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        event_odk_form = odk_project.odk_forms.filter(
            name=OdkProjectFactory.ODK_FORM_NAME_FOR_EVENTS
        ).first()
        event_odk_form_importer = event_odk_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_EVENTS_IMPORTER_NAME
        )
        event_etl_document = event_odk_form_importer.etl_document

        if form_submissions is None:
            form_submissions = []

        mock_get_table(form_submissions)
        return event_odk_form, event_odk_form_importer, event_etl_document, form_submissions

    yield _m


@pytest.fixture
def setup_full_pipeline(mock_get_table_dynamic):
    """Setup for full pipeline tests (disabled project/form)."""
    def _m():
        ProvinceFactory(with_clusters=True,
                        with_clusters__with_areas=True,
                        with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        mock_get_table_dynamic(events=[], deaths=[], babies=[],
                               households=[], household_members=[],
                               verbal_autopsies=[])
        return odk_project

    yield _m


# ─────────────────────────────────────────────────────────────────────────────
# Malformed Submission Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_import_with_missing_required_field(setup_events):
    """A submission missing a required mapped field should produce an error."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    # Delete a required field (cluster_id is required in event ETL mappings)
    del submission['cluster_id']
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.errors) > 0
    assert any('does not have a field named' in e for e in result.errors)


@pytest.mark.django_db
def test_import_with_invalid_field_type(setup_events):
    """A string where int is expected — TypeCaster handles coercion."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    # Set a field that should be a string to an unexpected type
    # The importer should still handle this via TypeCaster
    submission['cluster_id'] = 12345  # normally a string code
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    # The import may error on cluster lookup (cluster not found) but
    # the TypeCaster itself should not crash — verify no uncaught exceptions
    assert all('Error executing' not in e for e in result.errors)


@pytest.mark.django_db
def test_import_with_empty_submission_batch(setup_events):
    """An empty submission list should produce 0 imports and no errors."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()
    # form_submissions is already empty

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 0
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_null_optional_fields(setup_events):
    """Submissions with null optional fields should still import."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    # Set optional fields to None
    submission['resp_name'] = None
    submission['hh_address'] = None
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    # Should import without errors (these fields are not required)
    assert len(result.imported_models) == 1
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_malformed_gps_data(setup_events):
    """GPS dict missing coordinates key — import should still succeed."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    submission['gps'] = {"type": "Point"}  # missing coordinates and properties
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    # GPS is stored as a dict field — no structural validation
    assert len(result.imported_models) == 1
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_duplicate_keys_in_batch(setup_events):
    """Two submissions with the same __id — first imports, second is skipped."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    # Add the same submission twice (same __id)
    form_submissions.append(submission)
    form_submissions.append(submission.copy())

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 1
    # Second one is skipped with info message, not an error
    assert any('already exists' in msg for msg in result.info_log)


# ─────────────────────────────────────────────────────────────────────────────
# Disabled Project/Form Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_disabled_project_not_imported(setup_full_pipeline):
    """A disabled OdkProject should produce an error, not import."""
    odk_project = setup_full_pipeline()
    odk_project.is_enabled = False
    odk_project.save()

    importer = FromSubmissionImporter(odk_projects=odk_project)
    result = importer.execute()

    assert any('not enabled' in e for e in result.errors)
    assert len(result.imported_models) == 0


@pytest.mark.django_db
def test_disabled_form_not_imported(setup_full_pipeline):
    """A disabled OdkForm should produce an error, not import."""
    odk_project = setup_full_pipeline()
    odk_form = odk_project.odk_forms.first()
    odk_form.is_enabled = False
    odk_form.save()

    importer = FromSubmissionImporter(odk_forms=[odk_form])
    result = importer.execute()

    assert any('not enabled' in e or 'not not enabled' in e for e in result.errors)
    assert len(result.imported_models) == 0
```

- [ ] **Step 2: Run edge case tests**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest tests/api/odk/importers/test_import_edge_cases.py -v`
Expected: 8 passed

**Troubleshooting:**
- `test_import_with_missing_required_field`: If `cluster_id` is not a required field in the ETL mapping, try deleting `__id` instead (always required as primary key). Check the ETL seed file to see which fields are `is_required=True`.
- `test_import_with_duplicate_keys_in_batch`: The info message check uses `result.info_log` — verify this attribute exists on `FromSubmissionImportResult`.
- `test_disabled_form_not_imported`: The source code has a typo: "not not enabled" (line 128 of form_submission_importer.py). The assertion checks for both strings.

- [ ] **Step 3: Commit**

```bash
git add tests/api/odk/importers/test_import_edge_cases.py
git commit -m "test: add import edge case tests (missing fields, duplicates, disabled project/form)"
```

---

## Chunk 5: Final Verification

### Task 7: Run full test suite and verify counts

- [ ] **Step 1: Run all pytest tests**

Run: `cd /Users/ericliu/projects5/srs-cms && pipenv run pytest -v`
Expected: ~89 passed (56 existing + 33 new)

- [ ] **Step 2: Run Playwright E2E tests**

Run: `cd /Users/ericliu/projects5/srs-cms/frontend && npx playwright test`
Expected: 19 passed (no regressions)

- [ ] **Step 3: Report results**

```
Test Results:
- Pytest: X passed / Y failed (was: 56 passed)
- Playwright E2E: 19 passed / 0 failed
- New tests added: ~33
- Total: X passed / Y failed
```

- [ ] **Step 4: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "test: finalize test coverage expansion — migrations, transformers, exporters, edge cases"
```

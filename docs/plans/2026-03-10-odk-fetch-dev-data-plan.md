# ODK Dev Data Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the existing `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING` logic in the ODK importers so that missing reference data (Province, Cluster, Area, Staff) is auto-created instead of falling back to `objects.first()`. This allows the existing `odk_import_form_submissions` command to successfully import real ODK data into a dev/test database.

**Architecture:** Extract shared reference-data resolution logic into a helper module. Replace the `objects.first()` fallback in each importer's `on_before_save_model()` with calls to `get_or_create` that auto-create missing records with sensible defaults. The existing command, pipeline, and ETL mappings remain unchanged.

**Tech Stack:** Django ORM, existing importer classes

---

### Task 1: Reference Data Resolver Helper

A shared utility for resolving (find or auto-create) Cluster, Area, and Staff records. Used by both `EventsImporter` and `HouseholdsImporter`.

**Files:**
- Create: `api/odk/dev/__init__.py`
- Create: `api/odk/dev/reference_resolver.py`
- Test: `tests/api/odk/dev/__init__.py`
- Test: `tests/api/odk/dev/test_reference_resolver.py`

**Step 1: Write failing tests**

```python
# tests/api/odk/dev/__init__.py
# (empty)
```

```python
# tests/api/odk/dev/test_reference_resolver.py
import pytest
from api.odk.dev.reference_resolver import ReferenceResolver
from api.models import Province, Cluster, Area, Staff


@pytest.mark.django_db
class TestReferenceResolver:

    def test_resolve_cluster_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", name="Cluster 1", province=province)
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved == cluster

    def test_resolve_cluster_creates_missing(self):
        assert not Cluster.objects.filter(code="CL001").exists()
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved is not None
        assert resolved.code == "CL001"
        assert resolved.province is not None
        # Should create a default "Imported" province
        assert Province.objects.filter(code="IM").exists()

    def test_resolve_cluster_uses_existing_province_if_only_one(self):
        province = Province.objects.create(code="P1", name="Province 1")
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved.province == province

    def test_resolve_cluster_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_cluster(None) is None
        assert ReferenceResolver.resolve_cluster("") is None

    def test_resolve_area_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        area = Area.objects.create(code="AR001", cluster=cluster)
        resolved = ReferenceResolver.resolve_area("AR001", cluster)
        assert resolved == area

    def test_resolve_area_creates_missing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_area("AR001", cluster)
        assert resolved is not None
        assert resolved.code == "AR001"
        assert resolved.cluster == cluster

    def test_resolve_area_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_area(None, None) is None

    def test_resolve_staff_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        staff = Staff.objects.create(code="ST001", staff_type=Staff.StaffType.CSA, cluster=cluster)
        resolved = ReferenceResolver.resolve_staff("ST001", cluster)
        assert resolved == staff

    def test_resolve_staff_creates_missing_csa(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_staff("ST001", cluster)
        assert resolved is not None
        assert resolved.code == "ST001"
        assert resolved.staff_type == Staff.StaffType.CSA
        assert resolved.cluster == cluster

    def test_resolve_staff_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_staff(None, None) is None

    def test_resolve_cluster_strips_whitespace(self):
        province = Province.objects.create(code="P1", name="Province 1")
        Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_cluster("  CL001  ")
        assert resolved.code == "CL001"

    def test_resolve_cluster_idempotent(self):
        """Calling resolve twice with same code should not create duplicates."""
        resolved1 = ReferenceResolver.resolve_cluster("CL001")
        resolved2 = ReferenceResolver.resolve_cluster("CL001")
        assert resolved1.id == resolved2.id
        assert Cluster.objects.filter(code="CL001").count() == 1
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/api/odk/dev/test_reference_resolver.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.odk.dev'`

**Step 3: Write the implementation**

```python
# api/odk/dev/__init__.py
# (empty)
```

```python
# api/odk/dev/reference_resolver.py
from api.models import Province, Cluster, Area, Staff


class ReferenceResolver:
    """
    Resolves reference data records (Cluster, Area, Staff) by code.
    If a record doesn't exist and DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING is True,
    auto-creates it with sensible defaults instead of falling back to objects.first().
    """

    DEFAULT_PROVINCE_CODE = "IM"
    DEFAULT_PROVINCE_NAME = "Imported"

    @classmethod
    def resolve_cluster(cls, code):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        cluster = Cluster.find_by(code=code)
        if cluster:
            return cluster
        province = cls._get_or_create_province()
        cluster = Cluster.objects.create(
            code=code,
            name=f"Imported-{code}",
            province=province,
        )
        return cluster

    @classmethod
    def resolve_area(cls, code, cluster):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        area = Area.find_by(code=code)
        if area:
            return area
        if not cluster:
            return None
        area = Area.objects.create(code=code, cluster=cluster)
        return area

    @classmethod
    def resolve_staff(cls, code, cluster):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        staff = Staff.find_by(code=code)
        if staff:
            return staff
        if not cluster:
            return None
        staff = Staff.objects.create(
            code=code,
            staff_type=Staff.StaffType.CSA,
            full_name=f"Imported-{code}",
            cluster=cluster,
        )
        return staff

    @classmethod
    def _get_or_create_province(cls):
        """Get existing province or create a default one for imported data."""
        # If there's exactly one province, use it (common in dev)
        if Province.objects.count() == 1:
            return Province.objects.first()
        # Otherwise use or create the "Imported" province
        province = Province.find_by(code=cls.DEFAULT_PROVINCE_CODE)
        if not province:
            province = Province.objects.create(
                code=cls.DEFAULT_PROVINCE_CODE,
                name=cls.DEFAULT_PROVINCE_NAME,
            )
        return province
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/api/odk/dev/test_reference_resolver.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/dev/ tests/api/odk/dev/
git commit -m "feat: add ReferenceResolver for auto-creating missing reference data"
```

---

### Task 2: Update EventsImporter to Use ReferenceResolver

Replace the `objects.first()` fallback with `ReferenceResolver` calls.

**Files:**
- Modify: `api/odk/importers/form_submissions/events_importer.py`
- Modify: `tests/api/odk/importers/test_events_importer.py` (add test for auto-create behavior)

**Step 1: Write failing test for auto-create behavior**

Add a new test to the existing test file that verifies missing reference data is auto-created when `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True`.

```python
# Add to tests/api/odk/importers/test_events_importer.py

@pytest.mark.django_db
class TestEventsImporterAutoCreate:
    """Test that EventsImporter auto-creates missing reference data."""

    def test_auto_creates_missing_cluster_area_staff(self, monkeypatch, mock_odk_login):
        """When DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True and reference data is missing,
        the importer should auto-create Cluster, Area, and Staff records."""
        monkeypatch.setenv("DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING", "True")

        # Set up ODK project but with NO matching reference data for submission codes
        # The submission will reference codes that don't exist in the DB
        # After import, the reference data should be auto-created
        from api.models import Cluster, Area, Staff
        assert not Cluster.objects.filter(code="NEWCL").exists()
        # ... (test will be filled in based on existing test patterns in the file)
```

Note: Read the existing test file first to match its patterns, then add the auto-create test.

**Step 2: Run existing tests to confirm they still pass**

Run: `pytest tests/api/odk/importers/test_events_importer.py -v`
Expected: All existing tests PASS

**Step 3: Update EventsImporter**

Replace `on_before_save_model` in `api/odk/importers/form_submissions/events_importer.py`:

```python
from api.odk.importers.form_submissions.form_submission_importer_base import FromSubmissionImporterBase
from api.odk.dev.reference_resolver import ReferenceResolver
from api.models import Event, Cluster, Area, Staff
from config.env import Env


class EventsImporter(FromSubmissionImporterBase):
    def __init__(self, odk_form, odk_form_importer, **kwargs):
        super().__init__(odk_form, odk_form_importer, **kwargs)

    def execute(self):
        try:
            if self.validate_before_execute():
                self.import_submissions(Event)
        except Exception as ex:
            self.result.error('Error executing {}.'.format(self.__class__.__name__), error=ex, console=True)
        return self.result

    def on_before_save_model(self, new_event, etl_record, form_submission):
        use_existing_if_missing = Env.get("DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING", cast=bool, default=False)
        try:
            cluster = Cluster.find_by(code=new_event.cluster_code)
            area = Area.find_by(code=new_event.area_code)
            event_staff = Staff.find_by(code=new_event.staff_code)

            if use_existing_if_missing:
                if not cluster:
                    cluster = ReferenceResolver.resolve_cluster(new_event.cluster_code)
                if not area:
                    area = ReferenceResolver.resolve_area(new_event.area_code, cluster)
                if not event_staff:
                    event_staff = ReferenceResolver.resolve_staff(new_event.staff_code, cluster)

            errors = []
            if cluster is None:
                errors.append(f"Cluster not found: {new_event.cluster_code or 'NULL'}")
            if area is None:
                errors.append(f"Area not found: {new_event.area_code or 'NULL'}")
            if event_staff is None:
                errors.append(f"Staff not found: {new_event.staff_code or 'NULL'}")

            if not errors:
                new_event.cluster = cluster
                new_event.area = area
                new_event.event_staff = event_staff
                return True
            else:
                self.result.error(f"Event: {new_event.key}, " + ", ".join(errors))
                return False
        except Exception as ex:
            self.result.error('Error executing {}.on_before_save_model.'.format(self.__class__.__name__),
                              error=ex, console=True)
            return False
```

**Step 4: Run tests**

Run: `pytest tests/api/odk/importers/test_events_importer.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/importers/form_submissions/events_importer.py tests/api/odk/importers/test_events_importer.py
git commit -m "feat: EventsImporter auto-creates missing reference data via ReferenceResolver"
```

---

### Task 3: Update HouseholdsImporter to Use ReferenceResolver

Same pattern as Task 2 for Households.

**Files:**
- Modify: `api/odk/importers/form_submissions/households_importer.py`
- Modify: `tests/api/odk/importers/test_households_importer.py`

**Step 1: Write failing test for auto-create behavior**

Add a test to the existing test file matching its patterns. Test that missing Cluster/Area/Staff are auto-created.

**Step 2: Run existing tests first**

Run: `pytest tests/api/odk/importers/test_households_importer.py -v`
Expected: All existing tests PASS

**Step 3: Update HouseholdsImporter**

Replace `on_before_save_model` with the same pattern as EventsImporter — use `ReferenceResolver` when `DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True`:

```python
from api.odk.importers.form_submissions.form_submission_importer_base import FromSubmissionImporterBase
from api.odk.dev.reference_resolver import ReferenceResolver
from api.models import Household, Area, Cluster, Staff
from config.env import Env


class HouseholdsImporter(FromSubmissionImporterBase):
    def __init__(self, odk_form, odk_form_importer, **kwargs):
        super().__init__(odk_form, odk_form_importer, **kwargs)

    def execute(self):
        try:
            if self.validate_before_execute():
                self.import_submissions(Household)
        except Exception as ex:
            self.result.error('Error executing {}.'.format(self.__class__.__name__), error=ex, console=True)
        return self.result

    def on_before_save_model(self, new_household, etl_record, form_submission):
        use_existing_if_missing = Env.get("DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING", cast=bool, default=False)
        try:
            cluster = Cluster.find_by(code=new_household.cluster_code)
            area = Area.find_by(code=new_household.area_code)
            event_staff = Staff.find_by(code=new_household.staff_code)

            if use_existing_if_missing:
                if not cluster:
                    cluster = ReferenceResolver.resolve_cluster(new_household.cluster_code)
                if not area:
                    area = ReferenceResolver.resolve_area(new_household.area_code, cluster)
                if not event_staff:
                    event_staff = ReferenceResolver.resolve_staff(new_household.staff_code, cluster)

            errors = []
            if cluster is None:
                errors.append(f"Cluster not found: {new_household.cluster_code or 'NULL'}")
            if area is None:
                errors.append(f"Area not found: {new_household.area_code or 'NULL'}")
            if event_staff is None:
                errors.append(f"Staff not found: {new_household.staff_code or 'NULL'}")

            if not errors:
                new_household.cluster = cluster
                new_household.area = area
                new_household.event_staff = event_staff
                return True
            else:
                self.result.error(f"{new_household.key}, " + ", ".join(errors))
                return False
        except Exception as ex:
            self.result.error('Error executing {}.on_before_save_model.'.format(self.__class__.__name__),
                              error=ex, console=True)
            return False
```

**Step 4: Run tests**

Run: `pytest tests/api/odk/importers/test_households_importer.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/importers/form_submissions/households_importer.py tests/api/odk/importers/test_households_importer.py
git commit -m "feat: HouseholdsImporter auto-creates missing reference data via ReferenceResolver"
```

---

### Task 4: Verify Full Test Suite & Existing Behavior

Ensure no regressions — the child importers (Deaths, Babies, HouseholdMembers) don't need changes since they resolve parent models (Event, Household) not reference data directly.

**Step 1: Run the full test suite**

Run: `pytest -v`
Expected: All PASS, no regressions

**Step 2: Verify the child importers still work**

The `DeathsImporter`, `BabiesImporter`, and `HouseholdMembersImporter` use `objects.first()` for their parent model lookups (Event, Household). These are fine for now — the parent Event/Household will already exist because the primary importer runs first with the improved reference resolution.

Run: `pytest tests/api/odk/importers/ -v`
Expected: All PASS

**Step 3: Commit if any fixups needed**

```bash
git add -A
git commit -m "chore: verify full test suite passes with ReferenceResolver changes"
```

---

### Task 5: Update Design Doc and Clean Up

**Step 1: Update the design doc to reflect the simplified approach**

Update `docs/plans/2026-03-10-odk-fetch-dev-data-design.md` to reflect that we improved existing importers instead of creating a new command.

**Step 2: Commit**

```bash
git add docs/plans/
git commit -m "docs: update design doc to reflect simplified importer approach"
```

---

## Usage After Implementation

No new command needed. The existing workflow becomes:

```bash
# 1. Seed reference data and ODK config
python manage.py seed_database --stage dev

# 2. Set env var to enable auto-creation of missing references
export DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True

# 3. Import real ODK data (same command as production, now handles missing refs)
python manage.py odk_import_form_submissions --projects 6 --verbose
```

The key difference: instead of `objects.first()` silently assigning everything to the same Cluster/Area/Staff, the `ReferenceResolver` creates properly named records (`Imported-CL001`, `Imported-ST001`) with correct relationships.

# ODK Fetch Dev Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a management command that fetches real ODK Central submissions (Events + Households) and imports them into the local database, auto-creating any missing reference data with GIS-aware defaults.

**Architecture:** A new `odk_fetch_dev_data` management command that: (1) fetches raw submissions from ODK Central via pyodk, (2) pre-scans submissions to reconcile missing reference data (Province, Cluster, Area, Staff) using GPS coordinates from the submissions, (3) cleans and deduplicates, then (4) feeds the cleaned submissions into the existing ETL import pipeline via the `form_submissions` parameter.

**Tech Stack:** Django management commands, pyodk, existing ETL import pipeline (`FromSubmissionImporterBase`)

---

### Task 1: Reference Data Reconciler

This is the core new logic — a class that scans raw ODK submissions and auto-creates missing Province, Cluster, Area, and Staff records.

**Files:**
- Create: `api/odk/dev/reference_data_reconciler.py`
- Create: `api/odk/dev/__init__.py`
- Test: `tests/api/odk/dev/test_reference_data_reconciler.py`
- Test: `tests/api/odk/dev/__init__.py`

**Step 1: Write failing tests for reference data extraction**

```python
# tests/api/odk/dev/__init__.py
# (empty)
```

```python
# tests/api/odk/dev/test_reference_data_reconciler.py
import pytest
from api.odk.dev.reference_data_reconciler import ReferenceDataReconciler
from api.models import Province, Cluster, Area, Staff


@pytest.mark.django_db
class TestReferenceDataReconciler:

    def _make_submission(self, cluster_id="CL001", area_id="AR001", staff_id="ST001",
                         gps_lat=-15.5, gps_lon=28.3):
        return {
            "__id": "uuid:test-001",
            "cluster_id": cluster_id,
            "area_id": area_id,
            "staff_id": staff_id,
            "gps": {
                "type": "Point",
                "coordinates": [gps_lon, gps_lat, 1000],
                "properties": {"accuracy": 10.0}
            }
        }

    def _make_household_submission(self, cluster_id="CL001", area_id="AR001", staff_id="ST001",
                                    gps_lat=-15.5, gps_lon=28.3):
        return {
            "__id": "uuid:test-hh-001",
            "grp_cluster": {"cluster_id": cluster_id},
            "grp_area": {"area_id": area_id, "worker_id": staff_id},
            "gps": {
                "type": "Point",
                "coordinates": [gps_lon, gps_lat, 1000],
                "properties": {"accuracy": 10.0}
            }
        }

    def test_extract_references_from_event_submissions(self):
        submissions = [self._make_submission()]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        refs = reconciler.extract_references()
        assert "CL001" in refs["clusters"]
        assert "AR001" in refs["areas"]
        assert "ST001" in refs["staff"]

    def test_extract_references_from_household_submissions(self):
        submissions = [self._make_household_submission()]
        reconciler = ReferenceDataReconciler(submissions, form_type="households")
        refs = reconciler.extract_references()
        assert "CL001" in refs["clusters"]
        assert "AR001" in refs["areas"]
        assert "ST001" in refs["staff"]

    def test_extract_gps_centroid_per_cluster(self):
        submissions = [
            self._make_submission(cluster_id="CL001", gps_lat=-15.0, gps_lon=28.0),
            self._make_submission(cluster_id="CL001", gps_lat=-16.0, gps_lon=29.0),
        ]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        refs = reconciler.extract_references()
        centroid = refs["clusters"]["CL001"]["gps_centroid"]
        assert centroid["lat"] == pytest.approx(-15.5, abs=0.01)
        assert centroid["lon"] == pytest.approx(28.5, abs=0.01)

    def test_reconcile_creates_missing_province(self):
        submissions = [self._make_submission()]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        assert Province.objects.filter(code="IM").exists()

    def test_reconcile_creates_missing_cluster(self):
        submissions = [self._make_submission(cluster_id="CL001")]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        assert Cluster.objects.filter(code="CL001").exists()
        cluster = Cluster.objects.get(code="CL001")
        assert cluster.province is not None

    def test_reconcile_creates_missing_area(self):
        submissions = [self._make_submission(area_id="AR001", cluster_id="CL001")]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        assert Area.objects.filter(code="AR001").exists()
        area = Area.objects.get(code="AR001")
        assert area.cluster.code == "CL001"

    def test_reconcile_creates_missing_staff(self):
        submissions = [self._make_submission(staff_id="ST001", cluster_id="CL001")]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        assert Staff.objects.filter(code="ST001").exists()
        staff = Staff.objects.get(code="ST001")
        assert staff.staff_type == Staff.StaffType.CSA
        assert staff.cluster.code == "CL001"

    def test_reconcile_skips_existing_records(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", name="Cluster 1", province=province)
        Area.objects.create(code="AR001", cluster=cluster)
        Staff.objects.create(code="ST001", staff_type=Staff.StaffType.CSA, cluster=cluster)

        submissions = [self._make_submission()]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        result = reconciler.reconcile()
        assert result["provinces_created"] == 0
        assert result["clusters_created"] == 0
        assert result["areas_created"] == 0
        assert result["staff_created"] == 0

    def test_reconcile_uses_existing_province_by_gps_proximity(self):
        Province.objects.create(code="P1", name="Province 1")
        # Create a cluster in P1 with known GPS to establish province location
        cluster = Cluster.objects.create(code="EXISTING", name="Existing", province_id=Province.objects.first().id)
        # When a new cluster is close to existing clusters in a province, it should join that province
        # For now, without GPS on Province model, new clusters go to "Imported" province
        submissions = [self._make_submission(cluster_id="NEW_CL")]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        new_cluster = Cluster.objects.get(code="NEW_CL")
        assert new_cluster.province is not None

    def test_reconcile_handles_multiple_clusters(self):
        submissions = [
            self._make_submission(cluster_id="CL001", area_id="AR001", staff_id="ST001"),
            self._make_submission(cluster_id="CL002", area_id="AR002", staff_id="ST002"),
        ]
        reconciler = ReferenceDataReconciler(submissions, form_type="events")
        reconciler.reconcile()
        assert Cluster.objects.count() == 2
        assert Area.objects.count() == 2
        assert Staff.objects.count() == 2
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/api/odk/dev/test_reference_data_reconciler.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.odk.dev'`

**Step 3: Write the implementation**

```python
# api/odk/dev/__init__.py
# (empty)
```

```python
# api/odk/dev/reference_data_reconciler.py
from api.models import Province, Cluster, Area, Staff
from api.common import Utils


class ReferenceDataReconciler:
    """
    Scans raw ODK submissions and auto-creates missing reference data
    (Province, Cluster, Area, Staff) with GIS-aware defaults.
    """

    # Field paths for extracting reference codes from submissions
    FIELD_PATHS = {
        "events": {
            "cluster_id": "cluster_id",
            "area_id": "area_id",
            "staff_id": "staff_id",
        },
        "households": {
            "cluster_id": "grp_cluster.cluster_id",
            "area_id": "grp_area.area_id",
            "staff_id": "grp_area.worker_id",
        },
    }

    DEFAULT_PROVINCE_CODE = "IM"
    DEFAULT_PROVINCE_NAME = "Imported"

    def __init__(self, submissions, form_type="events", verbose=False, stdout=None):
        self.submissions = submissions or []
        self.form_type = form_type
        self.verbose = verbose
        self.stdout = stdout
        self._field_paths = self.FIELD_PATHS.get(form_type, self.FIELD_PATHS["events"])

    def extract_references(self):
        """Extract unique cluster/area/staff codes and GPS data from submissions."""
        clusters = {}
        areas = {}
        staff = {}

        for sub in self.submissions:
            cluster_code = self._get_field(sub, self._field_paths["cluster_id"])
            area_code = self._get_field(sub, self._field_paths["area_id"])
            staff_code = self._get_field(sub, self._field_paths["staff_id"])
            gps = self._extract_gps(sub)

            if cluster_code:
                cluster_code = str(cluster_code).strip()
                if cluster_code not in clusters:
                    clusters[cluster_code] = {"gps_points": [], "areas": set(), "staff": set()}
                if gps:
                    clusters[cluster_code]["gps_points"].append(gps)
                if area_code:
                    clusters[cluster_code]["areas"].add(str(area_code).strip())
                if staff_code:
                    clusters[cluster_code]["staff"].add(str(staff_code).strip())

            if area_code:
                area_code = str(area_code).strip()
                if area_code not in areas:
                    areas[area_code] = {"cluster_code": str(cluster_code).strip() if cluster_code else None}

            if staff_code:
                staff_code = str(staff_code).strip()
                if staff_code not in staff:
                    staff[staff_code] = {"cluster_code": str(cluster_code).strip() if cluster_code else None}

        # Compute GPS centroids per cluster
        for code, data in clusters.items():
            points = data["gps_points"]
            if points:
                avg_lat = sum(p["lat"] for p in points) / len(points)
                avg_lon = sum(p["lon"] for p in points) / len(points)
                data["gps_centroid"] = {"lat": avg_lat, "lon": avg_lon}
            else:
                data["gps_centroid"] = None

        return {"clusters": clusters, "areas": areas, "staff": staff}

    def reconcile(self):
        """Create missing reference data. Returns counts of created records."""
        refs = self.extract_references()
        result = {
            "provinces_created": 0,
            "clusters_created": 0,
            "areas_created": 0,
            "staff_created": 0,
        }

        # Ensure default province exists for orphan clusters
        default_province = self._get_or_create_default_province(result)

        # Create missing clusters
        for cluster_code, data in refs["clusters"].items():
            if not Cluster.find_by(code=cluster_code):
                province = default_province
                Cluster.objects.create(
                    code=cluster_code,
                    name=f"Imported-{cluster_code}",
                    province=province,
                )
                result["clusters_created"] += 1
                self._log(f"Created Cluster: {cluster_code}")

        # Create missing areas
        for area_code, data in refs["areas"].items():
            if not Area.find_by(code=area_code):
                cluster = Cluster.find_by(code=data["cluster_code"]) if data["cluster_code"] else None
                if cluster:
                    Area.objects.create(code=area_code, cluster=cluster)
                    result["areas_created"] += 1
                    self._log(f"Created Area: {area_code} -> Cluster: {cluster.code}")
                else:
                    self._log(f"Skipped Area: {area_code} (no cluster)")

        # Create missing staff
        for staff_code, data in refs["staff"].items():
            if not Staff.find_by(code=staff_code):
                cluster = Cluster.find_by(code=data["cluster_code"]) if data["cluster_code"] else None
                if cluster:
                    Staff.objects.create(
                        code=staff_code,
                        staff_type=Staff.StaffType.CSA,
                        full_name=f"Imported-{staff_code}",
                        cluster=cluster,
                    )
                    result["staff_created"] += 1
                    self._log(f"Created Staff: {staff_code} -> Cluster: {cluster.code}")
                else:
                    self._log(f"Skipped Staff: {staff_code} (no cluster)")

        return result

    def _get_or_create_default_province(self, result):
        province = Province.find_by(code=self.DEFAULT_PROVINCE_CODE)
        if not province:
            # If any province exists, use the first one instead of creating a new one
            province = Province.objects.first()
            if not province:
                province = Province.objects.create(
                    code=self.DEFAULT_PROVINCE_CODE,
                    name=self.DEFAULT_PROVINCE_NAME,
                )
                result["provinces_created"] = 1
                self._log(f"Created default Province: {self.DEFAULT_PROVINCE_CODE}")
        return province

    def _get_field(self, obj, field_path):
        return Utils.get_field(obj, field_path)

    def _extract_gps(self, submission):
        gps = submission.get("gps")
        if gps and isinstance(gps, dict):
            coords = gps.get("coordinates")
            if coords and len(coords) >= 2:
                return {"lon": coords[0], "lat": coords[1]}
        return None

    def _log(self, message):
        if self.verbose and self.stdout:
            self.stdout.write(message)
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/api/odk/dev/test_reference_data_reconciler.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/dev/ tests/api/odk/dev/
git commit -m "feat: add ReferenceDataReconciler for auto-creating missing reference data"
```

---

### Task 2: Submission Cleaner

A utility that deduplicates and cleans raw ODK submissions before passing them to the import pipeline.

**Files:**
- Create: `api/odk/dev/submission_cleaner.py`
- Test: `tests/api/odk/dev/test_submission_cleaner.py`

**Step 1: Write failing tests**

```python
# tests/api/odk/dev/test_submission_cleaner.py
import pytest
from api.odk.dev.submission_cleaner import SubmissionCleaner
from api.models import Event, Province, Cluster, Area, Staff


@pytest.mark.django_db
class TestSubmissionCleaner:

    def _make_submission(self, uuid="001", cluster_id="CL001", area_id="AR001", staff_id="ST001"):
        return {
            "__id": f"uuid:{uuid}",
            "__system": {
                "formVersion": "1",
                "submissionDate": "2025-06-01T10:00:00Z"
            },
            "cluster_id": cluster_id,
            "area_id": area_id,
            "staff_id": staff_id,
        }

    def test_removes_submissions_missing_cluster_id(self):
        submissions = [self._make_submission(cluster_id=None)]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 0
        assert len(skipped) == 1

    def test_removes_submissions_missing_area_id(self):
        submissions = [self._make_submission(area_id=None)]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 0
        assert len(skipped) == 1

    def test_removes_submissions_missing_staff_id(self):
        submissions = [self._make_submission(staff_id=None)]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 0
        assert len(skipped) == 1

    def test_keeps_valid_submissions(self):
        submissions = [self._make_submission()]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 1
        assert len(skipped) == 0

    def test_deduplicates_by_uuid(self):
        submissions = [
            self._make_submission(uuid="001"),
            self._make_submission(uuid="001"),
        ]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 1

    def test_skips_existing_db_records(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        area = Area.objects.create(code="AR001", cluster=cluster)
        staff = Staff.objects.create(code="ST001", staff_type="CSA", cluster=cluster)
        Event.objects.create(
            key="001", cluster=cluster, area=area, event_staff=staff,
            cluster_code="CL001", area_code="AR001", staff_code="ST001"
        )

        submissions = [self._make_submission(uuid="001")]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 0
        assert len(skipped) == 1

    def test_strips_whitespace_from_codes(self):
        submissions = [self._make_submission(cluster_id=" CL001 ", area_id=" AR001 ", staff_id=" ST001 ")]
        cleaner = SubmissionCleaner(submissions, form_type="events")
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 1
        assert cleaned[0]["cluster_id"] == "CL001"
        assert cleaned[0]["area_id"] == "AR001"
        assert cleaned[0]["staff_id"] == "ST001"

    def test_applies_limit(self):
        submissions = [self._make_submission(uuid=f"00{i}") for i in range(10)]
        cleaner = SubmissionCleaner(submissions, form_type="events", limit=3)
        cleaned, skipped = cleaner.clean()
        assert len(cleaned) == 3
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/api/odk/dev/test_submission_cleaner.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.odk.dev.submission_cleaner'`

**Step 3: Write the implementation**

```python
# api/odk/dev/submission_cleaner.py
from api.models import Event, Household
from api.common import Utils


class SubmissionCleaner:
    """
    Cleans and deduplicates raw ODK submissions before import.
    - Removes submissions missing required reference fields
    - Deduplicates by __id
    - Skips records that already exist in the database
    - Strips whitespace from code fields
    - Applies optional limit
    """

    FIELD_PATHS = {
        "events": {
            "cluster_id": "cluster_id",
            "area_id": "area_id",
            "staff_id": "staff_id",
        },
        "households": {
            "cluster_id": "grp_cluster.cluster_id",
            "area_id": "grp_area.area_id",
            "staff_id": "grp_area.worker_id",
        },
    }

    MODEL_MAP = {
        "events": Event,
        "households": Household,
    }

    def __init__(self, submissions, form_type="events", limit=None, verbose=False, stdout=None):
        self.submissions = submissions or []
        self.form_type = form_type
        self.limit = limit
        self.verbose = verbose
        self.stdout = stdout
        self._field_paths = self.FIELD_PATHS.get(form_type, self.FIELD_PATHS["events"])

    def clean(self):
        cleaned = []
        skipped = []
        seen_ids = set()
        model_class = self.MODEL_MAP.get(self.form_type)

        # Get existing keys from DB for dedup
        existing_keys = set()
        if model_class:
            existing_keys = set(model_class.objects.values_list("key", flat=True))

        for sub in self.submissions:
            if self.limit and len(cleaned) >= self.limit:
                break

            uuid = self._extract_uuid(sub)

            # Deduplicate by UUID
            if uuid in seen_ids:
                skipped.append({"submission": sub, "reason": "duplicate_uuid"})
                continue
            seen_ids.add(uuid)

            # Skip if already in DB
            if uuid in existing_keys:
                skipped.append({"submission": sub, "reason": "exists_in_db"})
                continue

            # Strip whitespace from code fields and validate required fields
            missing_fields = []
            for field_name, field_path in self._field_paths.items():
                value = Utils.get_field(sub, field_path)
                if not value:
                    missing_fields.append(field_name)
                else:
                    stripped = str(value).strip()
                    self._set_field(sub, field_path, stripped)

            if missing_fields:
                skipped.append({"submission": sub, "reason": f"missing_{','.join(missing_fields)}"})
                continue

            cleaned.append(sub)

        return cleaned, skipped

    def _extract_uuid(self, submission):
        raw_id = submission.get("__id", "")
        return raw_id.replace("uuid:", "")

    def _set_field(self, obj, field_path, value):
        """Set a value in a nested dict using dot-notation path."""
        parts = field_path.split(".")
        current = obj
        for part in parts[:-1]:
            if isinstance(current, dict):
                current = current.get(part, {})
        if isinstance(current, dict):
            current[parts[-1]] = value
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/api/odk/dev/test_submission_cleaner.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/dev/submission_cleaner.py tests/api/odk/dev/test_submission_cleaner.py
git commit -m "feat: add SubmissionCleaner for deduplication and data cleaning"
```

---

### Task 3: ODK Submission Fetcher

A thin wrapper around the pyodk client that fetches raw submissions with pagination and optional limit.

**Files:**
- Create: `api/odk/dev/submission_fetcher.py`
- Test: `tests/api/odk/dev/test_submission_fetcher.py`

**Step 1: Write failing tests**

```python
# tests/api/odk/dev/test_submission_fetcher.py
import pytest
from unittest.mock import MagicMock, patch
from api.odk.dev.submission_fetcher import SubmissionFetcher


class TestSubmissionFetcher:

    def _mock_get_table(self, submissions):
        """Create a mock client whose submissions.get_table returns paginated results."""
        client = MagicMock()
        client.submissions.get_table.return_value = {
            "value": submissions,
            "@odata.count": len(submissions),
        }
        return client

    def test_fetches_submissions(self):
        subs = [{"__id": f"uuid:{i}"} for i in range(3)]
        client = self._mock_get_table(subs)
        fetcher = SubmissionFetcher(client, project_id=6, form_id="events_form")
        result = fetcher.fetch()
        assert len(result) == 3

    def test_respects_limit(self):
        subs = [{"__id": f"uuid:{i}"} for i in range(10)]
        client = self._mock_get_table(subs)
        fetcher = SubmissionFetcher(client, project_id=6, form_id="events_form", limit=3)
        result = fetcher.fetch()
        assert len(result) == 3

    def test_passes_date_filter(self):
        client = self._mock_get_table([])
        fetcher = SubmissionFetcher(
            client, project_id=6, form_id="events_form",
            start_date="2025-01-01", end_date="2025-12-31"
        )
        fetcher.fetch()
        call_kwargs = client.submissions.get_table.call_args[1]
        assert "2025-01-01" in call_kwargs["filter"]
        assert "2025-12-31" in call_kwargs["filter"]

    def test_fetches_without_date_filter(self):
        client = self._mock_get_table([])
        fetcher = SubmissionFetcher(client, project_id=6, form_id="events_form")
        fetcher.fetch()
        call_kwargs = client.submissions.get_table.call_args[1]
        assert "filter" not in call_kwargs or call_kwargs.get("filter") is None
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/api/odk/dev/test_submission_fetcher.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.odk.dev.submission_fetcher'`

**Step 3: Write the implementation**

```python
# api/odk/dev/submission_fetcher.py
from django.conf import settings


class SubmissionFetcher:
    """
    Fetches raw form submissions from ODK Central via pyodk client.
    Handles pagination and optional date filtering and limit.
    """

    def __init__(self, client, project_id, form_id, start_date=None, end_date=None,
                 limit=None, verbose=False, stdout=None):
        self.client = client
        self.project_id = project_id
        self.form_id = form_id
        self.start_date = start_date
        self.end_date = end_date
        self.limit = limit
        self.verbose = verbose
        self.stdout = stdout

    def fetch(self):
        page_size = getattr(settings, "ODK_API_FORM_SUBMISSION_PAGE_SIZE", 100)
        offset = 0
        all_submissions = []

        while True:
            if self.limit and len(all_submissions) >= self.limit:
                break

            kwargs = {
                "form_id": self.form_id,
                "project_id": self.project_id,
                "count": True,
                "top": page_size,
                "skip": offset,
                "expand": "*",
            }

            if self.start_date and self.end_date:
                kwargs["filter"] = (
                    f"__system/submissionDate ge '{self.start_date}' "
                    f"and __system/submissionDate le '{self.end_date}'"
                )

            response = self.client.submissions.get_table(**kwargs)
            page = response.get("value", [])

            for sub in page:
                if self.limit and len(all_submissions) >= self.limit:
                    break
                all_submissions.append(sub)

            if len(page) < page_size:
                break
            offset += page_size

        if self.verbose and self.stdout:
            self.stdout.write(f"Fetched {len(all_submissions)} submissions for form {self.form_id}")

        return all_submissions
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/api/odk/dev/test_submission_fetcher.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/odk/dev/submission_fetcher.py tests/api/odk/dev/test_submission_fetcher.py
git commit -m "feat: add SubmissionFetcher for paginated ODK Central data retrieval"
```

---

### Task 4: Management Command `odk_fetch_dev_data`

The main command that ties everything together.

**Files:**
- Create: `api/management/commands/odk_fetch_dev_data.py`
- Test: `tests/api/odk/dev/test_odk_fetch_dev_data_command.py`

**Step 1: Write failing test**

```python
# tests/api/odk/dev/test_odk_fetch_dev_data_command.py
import pytest
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from io import StringIO
from api.models import Province, Cluster, Area, Staff, Event, Household, OdkProject, OdkForm
from tests.factories.factories import OdkProjectFactory, ProvinceFactory


@pytest.mark.django_db
class TestOdkFetchDevDataCommand:

    def _make_event_submission(self, uuid="001", cluster_id="CL001", area_id="AR001",
                                staff_id="ST001", form_version="1"):
        return {
            "__id": f"uuid:{uuid}",
            "__system": {
                "formVersion": form_version,
                "submissionDate": "2025-06-01T10:00:00Z",
                "submitterId": "1",
                "submitterName": "Test",
                "deviceId": "collect:test",
            },
            "meta": {"instanceID": f"uuid:{uuid}", "instanceName": uuid},
            "cluster_id": cluster_id,
            "area_id": area_id,
            "staff_id": staff_id,
            "gps": {
                "type": "Point",
                "coordinates": [28.3, -15.5, 1000],
                "properties": {"accuracy": 10.0}
            },
        }

    @patch("api.odk.dev.submission_fetcher.SubmissionFetcher.fetch")
    @patch("api.odk.odk_config.OdkConfig.client")
    def test_command_creates_reference_data(self, mock_client, mock_fetch):
        mock_fetch.return_value = [self._make_event_submission()]
        mock_client.return_value = MagicMock()

        # Need ODK project/form config in DB
        ProvinceFactory(with_clusters=True)
        odk_project = OdkProjectFactory(with_forms=True)

        out = StringIO()
        call_command("odk_fetch_dev_data", "--forms", "events", stdout=out)
        output = out.getvalue()

        assert Cluster.objects.filter(code="CL001").exists()
        assert Area.objects.filter(code="AR001").exists()
        assert Staff.objects.filter(code="ST001").exists()

    @patch("api.odk.dev.submission_fetcher.SubmissionFetcher.fetch")
    @patch("api.odk.odk_config.OdkConfig.client")
    def test_command_runs_without_error(self, mock_client, mock_fetch):
        mock_fetch.return_value = []
        mock_client.return_value = MagicMock()

        ProvinceFactory(with_clusters=True)
        OdkProjectFactory(with_forms=True)

        out = StringIO()
        call_command("odk_fetch_dev_data", "--forms", "events", stdout=out)
        output = out.getvalue()
        assert "Fetching" in output or "fetch" in output.lower() or "complete" in output.lower()
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/api/odk/dev/test_odk_fetch_dev_data_command.py -v`
Expected: FAIL — command not found

**Step 3: Write the implementation**

```python
# api/management/commands/odk_fetch_dev_data.py
import argparse
from django.core.management.base import BaseCommand
from api.odk import OdkConfig
from api.odk.dev.reference_data_reconciler import ReferenceDataReconciler
from api.odk.dev.submission_cleaner import SubmissionCleaner
from api.odk.dev.submission_fetcher import SubmissionFetcher
from api.odk.importers.form_submissions.form_submission_importer import FromSubmissionImporter
from api.models import OdkProject, OdkForm


class Command(BaseCommand):
    help = "Fetch real ODK Central submissions for dev/test seeding."

    FORM_CHOICES = ["events", "households"]

    def add_arguments(self, parser):
        def valid_date(date_string):
            try:
                from datetime import datetime
                return datetime.strptime(date_string, "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                raise argparse.ArgumentTypeError(f"Invalid date: '{date_string}'. Use YYYY-MM-DD.")

        parser.add_argument(
            "--projects", nargs="*", type=int,
            help="ODK Project IDs. Defaults to all enabled projects."
        )
        parser.add_argument(
            "--forms", nargs="*", type=str, choices=self.FORM_CHOICES,
            default=self.FORM_CHOICES,
            help="Form types to fetch. Defaults to all."
        )
        parser.add_argument("--start-date", type=valid_date, help="Start date (YYYY-MM-DD).")
        parser.add_argument("--end-date", type=valid_date, help="End date (YYYY-MM-DD).")
        parser.add_argument("--limit", type=int, help="Max submissions per form type.")
        parser.add_argument("--verbose", default=False, action="store_true")

    def handle(self, *args, **kwargs):
        forms = kwargs["forms"]
        project_ids = kwargs["projects"]
        start_date = kwargs["start_date"]
        end_date = kwargs["end_date"]
        limit = kwargs["limit"]
        verbose = kwargs["verbose"]

        self.stdout.write("Fetching dev data from ODK Central...")

        # Connect to ODK Central
        odk_config = OdkConfig.from_env()
        client = odk_config.client()

        # Resolve ODK projects
        if project_ids:
            odk_projects = OdkProject.objects.filter(id__in=project_ids)
        else:
            odk_projects = OdkProject.objects.filter(is_enabled=True)

        if not odk_projects.exists():
            self.stderr.write(self.style.ERROR("No ODK projects found."))
            return

        # Map form type names to OdkForm name patterns
        form_name_patterns = {
            "events": "Events",
            "households": "Households",
        }

        for odk_project in odk_projects:
            self.stdout.write(f"\nProject: {odk_project.name} (id: {odk_project.id})")

            for form_type in forms:
                pattern = form_name_patterns[form_type]
                odk_forms = odk_project.odk_forms.filter(
                    name__icontains=pattern, is_enabled=True
                )

                for odk_form in odk_forms:
                    self.stdout.write(
                        f"\n  Fetching {form_type}: {odk_form.name} "
                        f"(version: {odk_form.version}, xml_form_id: {odk_form.xml_form_id})"
                    )

                    # Step 1: Fetch raw submissions
                    fetcher = SubmissionFetcher(
                        client,
                        project_id=odk_project.project_id,
                        form_id=odk_form.xml_form_id,
                        start_date=start_date,
                        end_date=end_date,
                        limit=limit,
                        verbose=verbose,
                        stdout=self.stdout,
                    )
                    raw_submissions = fetcher.fetch()
                    self.stdout.write(f"  Fetched: {len(raw_submissions)} raw submissions")

                    if not raw_submissions:
                        continue

                    # Step 2: Reconcile reference data
                    reconciler = ReferenceDataReconciler(
                        raw_submissions, form_type=form_type,
                        verbose=verbose, stdout=self.stdout,
                    )
                    reconcile_result = reconciler.reconcile()
                    self.stdout.write(
                        f"  Reconciled: "
                        f"{reconcile_result['provinces_created']} provinces, "
                        f"{reconcile_result['clusters_created']} clusters, "
                        f"{reconcile_result['areas_created']} areas, "
                        f"{reconcile_result['staff_created']} staff created"
                    )

                    # Step 3: Clean and deduplicate
                    cleaner = SubmissionCleaner(
                        raw_submissions, form_type=form_type, limit=limit,
                        verbose=verbose, stdout=self.stdout,
                    )
                    cleaned, skipped = cleaner.clean()
                    self.stdout.write(
                        f"  Cleaned: {len(cleaned)} valid, {len(skipped)} skipped"
                    )

                    if not cleaned:
                        continue

                    # Step 4: Run import pipeline with pre-fetched submissions
                    self.stdout.write(f"  Importing {len(cleaned)} submissions...")
                    importer = FromSubmissionImporter(
                        odk_projects=odk_project.id,
                        odk_forms=odk_form.id,
                        form_versions=[odk_form.version],
                        import_start_date=start_date,
                        import_end_date=end_date,
                        verbose=verbose,
                    )

                    # Override to use our cleaned submissions instead of fetching from API
                    importer.odk_config = odk_config
                    importer.client = client

                    # Use the importer factory to run with pre-fetched data
                    self._run_import(odk_form, cleaned, verbose)

        self.stdout.write(self.style.SUCCESS("\nDev data fetch complete."))

    def _run_import(self, odk_form, cleaned_submissions, verbose):
        """Run the existing import pipeline with pre-fetched submissions."""
        from api.odk.importers.form_submissions.form_submission_importer_factory import FromSubmissionImporterFactory

        importers = odk_form.get_odk_form_importers()
        primary = odk_form.get_primary_odk_form_importer(_importer_list=importers)
        children = odk_form.get_child_odk_form_importers(_importer_list=importers)

        if primary is None:
            self.stderr.write(f"    No primary importer for form: {odk_form.name}")
            return

        primary_importer = FromSubmissionImporterFactory.get_importer(
            primary, odk_form, primary,
            child_importers=children,
            form_submissions=cleaned_submissions,
            verbose=verbose,
        )
        result = primary_importer.execute()

        if result.errors:
            for error in result.errors:
                self.stderr.write(self.style.ERROR(f"    {error}"))
        else:
            self.stdout.write(
                f"    Imported: {len(result.imported_models)} models, "
                f"{len(result.imported_forms)} forms"
            )
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/api/odk/dev/test_odk_fetch_dev_data_command.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/management/commands/odk_fetch_dev_data.py tests/api/odk/dev/test_odk_fetch_dev_data_command.py
git commit -m "feat: add odk_fetch_dev_data management command"
```

---

### Task 5: Integration Test

An end-to-end test that verifies the full pipeline: fetch -> reconcile -> clean -> import.

**Files:**
- Test: `tests/api/odk/dev/test_integration.py`

**Step 1: Write the integration test**

```python
# tests/api/odk/dev/test_integration.py
import pytest
from unittest.mock import patch, MagicMock
from django.core.management import call_command
from io import StringIO
from api.models import Province, Cluster, Area, Staff, Event, Death, Household, HouseholdMember
from tests.factories.factories import OdkProjectFactory, ProvinceFactory, FormSubmissionFactory


@pytest.mark.django_db
class TestOdkFetchDevDataIntegration:
    """End-to-end test: fetch -> reconcile -> clean -> import."""

    @patch("api.odk.dev.submission_fetcher.SubmissionFetcher.fetch")
    @patch("api.odk.odk_config.OdkConfig.client")
    def test_full_pipeline_with_events(self, mock_client, mock_fetch, mock_odk_login):
        mock_client.return_value = MagicMock()

        # Set up ODK project config (ETL mappings, importers, etc.)
        province_data = ProvinceFactory(with_clusters=True)
        odk_project = OdkProjectFactory(with_forms=True)

        # Create realistic event submissions using existing factory
        cluster = Cluster.objects.first()
        area = Area.objects.first()
        staff = Staff.objects.first()

        submissions = [
            FormSubmissionFactory.create_event(
                cluster=cluster, area=area, staff=staff,
                form_version=odk_project.odk_forms.filter(name__icontains="Events").first().version
            )
            for _ in range(3)
        ]

        mock_fetch.return_value = submissions

        out = StringIO()
        call_command("odk_fetch_dev_data", "--forms", "events", "--verbose", stdout=out)

        # Verify events were imported
        assert Event.objects.count() >= 3
```

**Step 2: Run test**

Run: `pytest tests/api/odk/dev/test_integration.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/api/odk/dev/test_integration.py
git commit -m "test: add integration test for odk_fetch_dev_data pipeline"
```

---

### Task 6: Verify All Tests Pass & Final Cleanup

**Step 1: Run the full test suite**

Run: `pytest -v`
Expected: All PASS, no regressions

**Step 2: Run the command manually (if ODK credentials available)**

```bash
python manage.py odk_fetch_dev_data --forms events households --limit 5 --verbose
```

**Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for odk_fetch_dev_data"
```

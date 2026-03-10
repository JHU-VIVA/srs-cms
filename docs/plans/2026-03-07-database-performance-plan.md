# Database Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add B-tree indexes to speed up list page queries, and a materialized view for pre-computed dashboard counts by province.

**Architecture:** Database-level optimization only — no Redis or external cache. Composite indexes target the filter/sort patterns on the events table. A materialized view pre-computes 6 count metrics across 10 provinces + overall totals (66 rows), refreshed after ODK sync.

**Tech Stack:** Django migrations, PostgreSQL materialized views, Django Ninja API

---

### Task 1: Add B-tree indexes migration

**Files:**
- Create: `api/migrations/0003_add_indexes_and_dashboard_view.py`

**Step 1: Create the migration file**

```python
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_add_gin_index_mother_name'),
    ]

    operations = [
        migrations.RunSQL(
            sql='CREATE INDEX idx_events_type_outcome_date ON events (event_type, preg_outcome_date);',
            reverse_sql='DROP INDEX IF EXISTS idx_events_type_outcome_date;',
        ),
        migrations.RunSQL(
            sql='CREATE INDEX idx_events_type_id_desc ON events (event_type, id DESC);',
            reverse_sql='DROP INDEX IF EXISTS idx_events_type_id_desc;',
        ),
    ]
```

**Step 2: Run migration to verify it works**

Run: `python manage.py migrate api`
Expected: Migration 0003 applies successfully

**Step 3: Commit**

```bash
git add api/migrations/0003_add_indexes_and_dashboard_view.py
git commit -m "Add B-tree indexes on events for list page query performance"
```

---

### Task 2: Add materialized view to the same migration

**Files:**
- Modify: `api/migrations/0003_add_indexes_and_dashboard_view.py`

**Step 1: Add the materialized view SQL to the migration**

Append this operation to the `operations` list in the migration file:

```python
        migrations.RunSQL(
            sql="""
                CREATE MATERIALIZED VIEW dashboard_stats AS

                -- pregnancy_outcomes_total (event_type=2)
                SELECT 'pregnancy_outcomes_total' AS metric, c.province_id, COUNT(*) AS count
                FROM events e JOIN clusters c ON e.cluster_id = c.id
                WHERE e.event_type = 2
                GROUP BY c.province_id
                UNION ALL
                SELECT 'pregnancy_outcomes_total', NULL, COUNT(*)
                FROM events WHERE event_type = 2

                UNION ALL

                -- deaths_total (from deaths table, via events)
                SELECT 'deaths_total', c.province_id, COUNT(*)
                FROM deaths d JOIN events e ON d.event_id = e.id JOIN clusters c ON e.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'deaths_total', NULL, COUNT(*) FROM deaths

                UNION ALL

                -- households_total
                SELECT 'households_total', c.province_id, COUNT(*)
                FROM households h JOIN clusters c ON h.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'households_total', NULL, COUNT(*) FROM households

                UNION ALL

                -- household_members_total
                SELECT 'household_members_total', c.province_id, COUNT(*)
                FROM household_members hm JOIN households h ON hm.household_id = h.id JOIN clusters c ON h.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'household_members_total', NULL, COUNT(*) FROM household_members

                UNION ALL

                -- babies_total
                SELECT 'babies_total', c.province_id, COUNT(*)
                FROM babies b JOIN events e ON b.event_id = e.id JOIN clusters c ON e.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'babies_total', NULL, COUNT(*) FROM babies

                UNION ALL

                -- verbal_autopsies_total
                SELECT 'verbal_autopsies_total', c.province_id, COUNT(*)
                FROM verbal_autopsies va JOIN clusters c ON va.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'verbal_autopsies_total', NULL, COUNT(*) FROM verbal_autopsies;
            """,
            reverse_sql='DROP MATERIALIZED VIEW IF EXISTS dashboard_stats;',
        ),
```

**Step 2: Run migration to verify**

Run: `python manage.py migrate api`
Expected: Migration applies, materialized view is created

**Step 3: Verify the view has data**

Run: `python manage.py dbshell` then `SELECT * FROM dashboard_stats LIMIT 10;`
Expected: Rows with metric, province_id, and count columns

**Step 4: Commit**

```bash
git add api/migrations/0003_add_indexes_and_dashboard_view.py
git commit -m "Add dashboard_stats materialized view to migration"
```

---

### Task 3: Create unmanaged Django model for the view

**Files:**
- Create: `api/models/dashboard.py`
- Modify: `api/models/__init__.py`

**Step 1: Create the model file**

```python
from django.db import models


class DashboardStat(models.Model):
    metric = models.CharField(max_length=50, primary_key=True)
    province_id = models.IntegerField(null=True)
    count = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'dashboard_stats'
```

**Step 2: Add import to `api/models/__init__.py`**

Add this line at the end of the file:

```python
from .dashboard import DashboardStat
```

**Step 3: Commit**

```bash
git add api/models/dashboard.py api/models/__init__.py
git commit -m "Add unmanaged DashboardStat model for materialized view"
```

---

### Task 4: Add dashboard-stats API endpoint

**Files:**
- Modify: `api/api.py`

**Step 1: Add schema and endpoint**

Add the schema class after the existing schema definitions (after `PaginatedHouseholdsOut`):

```python
class DashboardStatOut(Schema):
    metric: str
    province_id: Optional[int] = None
    count: int
```

Add the endpoint after the household endpoints section:

```python
# ──────────────────────────────────────────────
# Dashboard endpoints
# ──────────────────────────────────────────────

@api.get("/dashboard-stats", auth=django_auth, response=list[DashboardStatOut])
def get_dashboard_stats(request):
    from api.models.dashboard import DashboardStat
    stats = DashboardStat.objects.all()
    return [{"metric": s.metric, "province_id": s.province_id, "count": s.count} for s in stats]
```

**Step 2: Verify the endpoint works**

Start the dev server and call: `GET /api/dashboard-stats`
Expected: JSON array with 66 objects, each with metric, province_id, and count

**Step 3: Commit**

```bash
git add api/api.py
git commit -m "Add /dashboard-stats API endpoint"
```

---

### Task 5: Add materialized view refresh to ODK sync command

**Files:**
- Modify: `api/management/commands/odk_import_form_submissions.py`

**Step 1: Add refresh call after import completes**

In the `handle` method, add the refresh before the `sys.exit` calls:

```python
    def handle(self, *args, **kwargs):
        # ... existing code ...

        odk_import_result = FromSubmissionImporter(
            # ... existing params ...
        ).execute()

        # Refresh dashboard stats after import
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW dashboard_stats;')

        if odk_import_result.errors:
            sys.exit(1)
        else:
            sys.exit(0)
```

**Step 2: Commit**

```bash
git add api/management/commands/odk_import_form_submissions.py
git commit -m "Refresh dashboard_stats materialized view after ODK sync"
```

---

### Task 6: Add refresh management command

**Files:**
- Create: `api/management/commands/refresh_dashboard_stats.py`

A standalone command for manual refresh outside of ODK sync.

**Step 1: Create the command**

```python
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Refresh the dashboard_stats materialized view'

    def handle(self, *args, **kwargs):
        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW dashboard_stats;')
        self.stdout.write(self.style.SUCCESS('dashboard_stats refreshed'))
```

**Step 2: Test it**

Run: `python manage.py refresh_dashboard_stats`
Expected: "dashboard_stats refreshed"

**Step 3: Commit**

```bash
git add api/management/commands/refresh_dashboard_stats.py
git commit -m "Add refresh_dashboard_stats management command"
```

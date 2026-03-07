# Database Performance: Indexes + Dashboard Materialized View

## Problem

- List pages and Excel exports query hundreds of thousands of records with filtering, sorting, and counting.
- A planned dashboard page needs aggregate counts across 6 tables, broken down by province.
- Data changes once daily via ODK sync (except deaths, which change in real-time).
- 50 concurrent users will see the same dashboard data.

## Solution: Approach A — Database-Level Optimization

### 1. B-Tree Indexes on `events` Table

Add composite indexes for the filter/sort patterns used by list page and export queries:

| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(event_type, preg_outcome_date)` | Filter by type + date range |
| Composite | `(event_type, id DESC)` | Default sort (no date filter) |

Existing GIN trigram indexes already cover text search (`mother_name`, `cluster_code`).

### 2. Materialized View for Dashboard

A PostgreSQL materialized view `dashboard_stats` pre-computes aggregate counts.

**View structure:**

| Column | Type | Description |
|--------|------|-------------|
| `metric` | text | Metric name |
| `province_id` | integer (nullable) | Province ID, or NULL for overall total |
| `count` | integer | Pre-computed count |

**Metrics (6):**

- `pregnancy_outcomes_total`
- `deaths_total`
- `households_total`
- `household_members_total`
- `babies_total`
- `verbal_autopsies_total`

Each metric has 11 rows: one per province (1-10) + one overall total (province_id = NULL). Total: 66 rows.

**Refresh:** The ODK sync management command calls `REFRESH MATERIALIZED VIEW dashboard_stats;` after import completes.

### 3. Unmanaged Django Model

An unmanaged model (`managed = False`) in `api/models/dashboard.py` mapped to the `dashboard_stats` view, enabling ORM queries from the API.

### 4. API Endpoint

A new `/dashboard-stats` endpoint queries the unmanaged model and returns all 66 rows as JSON.

## Files to Modify/Create

1. `api/migrations/0003_add_indexes_and_dashboard_view.py` — Migration with indexes + materialized view
2. `api/models/dashboard.py` — Unmanaged model for the view
3. `api/api.py` — New `/dashboard-stats` endpoint
4. ODK sync management command — Add `REFRESH MATERIALIZED VIEW` call

## Decisions

- Exact counts required (no approximate counts)
- No Redis or external cache — pure database solution
- Dashboard data is stale until next ODK sync (desired behavior)
- No frontend changes in this design — dashboard page built separately

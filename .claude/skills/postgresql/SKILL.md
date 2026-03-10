---
name: postgresql
description: Project-specific PostgreSQL database reference for SRS-CMS. This skill should be used when working with database schema, migrations, queries, Docker database operations (backup, restore, connection), seed data, or Django ORM models. Triggers on tasks involving database tables, SQL queries, migrations, docker-compose database services, Makefile database commands, or model field changes.
---

# PostgreSQL — SRS-CMS Database Reference

## Overview

This skill documents the PostgreSQL database configuration, schema, Docker operations, and conventions used in the SRS-CMS project. PostgreSQL 16 runs in Docker with Django ORM as the primary interface.

## Database Configuration

| Setting | Dev | Docker/Production |
|---------|-----|-------------------|
| **Engine** | `django.db.backends.postgresql` | same |
| **Host** | `localhost` | `srs-cms-db` (container name) |
| **Port** | `5432` | `5432` (configurable via `DB_PORT`) |
| **Database** | `dev_srs_cms` | `production_srs_cms` |
| **User** | `postgres` | `postgres` |
| **Image** | n/a | `postgres:16` |

Environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
Settings file: `config/settings.py` (loaded via `config/env.py`)

## Docker Database Operations

### Starting/Stopping

```bash
# Start all services (app, db, nginx, cron)
cd docker && make up

# Stop all services
cd docker && make down

# Rebuild images
cd docker && make build
```

The DB container uses a health check (`pg_isready`) — web and cron services wait for it before starting.

### Connecting to the Database

```bash
# Shell into the web container
cd docker && make bash

# Then use Django's dbshell
python manage.py dbshell

# Or connect directly to postgres container
docker exec -it ${APP_STAGE}-srs-cms-db psql -U postgres -d ${DB_NAME}
```

### Migrations in Docker

```bash
cd docker && make migrate
cd docker && make createsuperuser
```

### Data Persistence

Database data is stored in a named Docker volume: `postgres_data`. This persists across container restarts. To fully reset, remove the volume:

```bash
docker volume rm srs-cms-${APP_STAGE}_postgres_data
```

## Local Development Database Commands

All commands via the project root `Makefile`:

| Command | Purpose |
|---------|---------|
| `make migrate` | Run pending migrations |
| `make migrations` | Generate new migration files + validate |
| `make init_dev` | Drop, create, migrate, seed (dev) |
| `make init_dev_with_test_data` | Same as above + load test data |
| `make dev_seed_db` | Seed with development data |
| `make prod_seed_db` | Seed with production data |
| `make init_database` | Drop (if exists) and create empty database |
| `make init_database_migrate` | Drop, create, and run migrations |
| `make delete_migrations` | Remove migration files (000*.py) |
| `make reset_migrations` | Delete migrations, init DB, create & run new ones |
| `make kill_db_connections` | Force-close all active connections |

### Database Initialization Flow

`python manage.py init_database --migrate --seed` performs:
1. Kill existing connections
2. Drop database (dev/test only)
3. Create new database + user
4. Run Django migrations
5. Enable `pg_trgm` extension
6. Load seed data
7. Create superuser (if `DEV_SUPER_USER` env var set)

## Schema Overview

Refer to `references/schema.md` for detailed table-by-table field definitions.

### Table Hierarchy

```
provinces
  └── clusters
        └── areas
        └── staff (CSA type)
  └── staff (VA type)

events (linked to cluster, area, staff)
  ├── babies
  ├── deaths
  │     └── verbal_autopsies (OneToOne)
  └── pregnancies

households (linked to cluster, area, staff)
  └── household_members

odk_projects
  └── odk_forms
        └── odk_form_importers
        │     └── odk_form_importer_jobs
        └── etl_documents
              └── etl_mappings

odk_entity_lists
  └── odk_entity_list_exporters
        └── odk_entity_list_exporter_jobs
```

### Key Database Features

**Trigram Search (pg_trgm):**
The `pg_trgm` extension is enabled for fuzzy text search. GIN indexes exist on:
- `provinces.code`, `clusters.code`, `areas.code`, `staff.code`
- `events.household_head_name`, `events.deceased_person_name`, `events.respondent_name`
- `deaths.death_code`, `deaths.deceased_name`
- `pregnancies.code`

**Timestamps:**
All tables have `created_at` (auto_now_add) and `updated_at` (auto_now) via the `@db_timestamps` decorator.

**Primary Keys:**
All tables use `BigAutoField` (64-bit auto-incrementing integer).

**Constraints:**
- Staff: `CHECK (staff_type='CSA' AND cluster IS NOT NULL) OR (staff_type='VA' AND province IS NOT NULL)`
- Death: `UNIQUE(death_code)`
- OdkForm: `UNIQUE(odk_project, xml_form_id, version)`
- EtlMapping: `UNIQUE` on source/target name combinations

## Seed Data

Located in `api/data/seeds/`:

| Directory | Contains | Format |
|-----------|----------|--------|
| `test/` | ODK config, ETL mappings | JSON |
| `staging/` | Clusters, areas, staff + ODK/ETL | CSV + JSON |
| `production/` | Clusters, areas, staff + ODK/ETL | CSV + JSON |

**CSV schemas:**
- `clusters.csv`: `code, name, province_code`
- `areas.csv`: `code, cluster_code, adm0_code, adm0_name, ..., adm5_name, urban_rural, carto_house_count, carto_pop_count, import_code, status, comment`
- `staff.csv`: `code, cluster_code, province_code, staff_type_id, full_name, title, mobile_per, email, cms_status, comment`

## Django ORM Conventions

### QueryExtensionMixin

All models inherit `QueryExtensionMixin`, providing:

```python
# Find single record by field(s)
Event.find_by(key="some-key")

# Filter multiple records
Death.filter_by(death_status=Death.DeathStatus.NEW_DEATH)
```

### Choice Enumerations

Models use Django's `IntegerChoices` and `TextChoices` for enum fields. Key enumerations:

- **Event.EventType**: NO_EVENT=0, PREGNANCY=1, PREGNANCY_OUTCOME=2, DEATH=3
- **Death.DeathStatus**: NEW_DEATH=0, VA_SCHEDULED=1, VA_COMPLETED=2, VA_ON_HOLD=3
- **Death.DeathType**: NORMAL=2, STILLBIRTH=3
- **Staff.StaffType**: CSA, VA (TextChoices)
- **Household.MetStatusType**: YES=1, HOUSEHOLD_MOVED=3, ABSENT=4, DESTROYED=5
- **HouseholdMember.RelationHeadType**: HEAD=1, SPOUSE=2, BIOLOGICAL_CHILD=3, ... NO_RELATIONSHIP=10

### Adding New Models

When adding a new model:
1. Define in the appropriate file under `api/models/`
2. Apply `@db_timestamps` decorator
3. Inherit from `QueryExtensionMixin`
4. Export from `api/models/__init__.py`
5. Run `make migrations` then `make migrate`
6. Add GIN index on searchable text fields if needed

## Resources

### references/

- `schema.md` — Complete table-by-table field definitions with types, constraints, and indexes

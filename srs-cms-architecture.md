# SRS-CMS Architecture

## Overview

SRS-CMS (Surveillance and Response System - Case Management System) is a full-stack web application for managing health surveillance data. It tracks death events, household population data, and verbal autopsy interviews, integrating with ODK (Open Data Kit) for mobile field data collection.

## Tech Stack

| Layer          | Technology                                          |
|----------------|-----------------------------------------------------|
| Backend        | Django 5.2.8, Django Ninja 1.4.5 (REST API)         |
| Language       | Python 3.12                                         |
| Frontend       | Django Templates (SSR), TailwindCSS, DaisyUI        |
| Database       | PostgreSQL 16+                                      |
| ODK Integration| pyodk 1.2.1                                         |
| Infrastructure | Docker, Docker Compose, Nginx, Gunicorn, Cron       |
| Testing        | Pytest, Factory Boy, Faker                          |

## Project Structure

```
srs-cms/
├── api/                                    # Core Django app - models, API, ETL, ODK
│   ├── __init__.py
│   ├── admin.py                            # Django admin configuration
│   ├── api.py                              # REST API endpoints (Django Ninja)
│   ├── apps.py
│   ├── forms.py
│   │
│   ├── common/                             # Shared utilities
│   │   ├── permissions.py                  # Role-based access control
│   │   ├── type_caster.py                  # Type conversion utilities
│   │   └── utils.py                        # General helpers
│   │
│   ├── data/
│   │   └── seeds/                          # Seed data per environment
│   │       ├── seed_loader.py              # Seed loading logic
│   │       ├── dev/                        # Dev seed data (CSVs + JSONs)
│   │       ├── production/                 # Production seed data
│   │       ├── staging/
│   │       └── test/                       # Test seed data
│   │
│   ├── management/commands/                # Django management commands
│   │   ├── init_database.py                # Create/reset database
│   │   ├── seed_database.py                # Load seed data
│   │   ├── dev_generate_test_data.py       # Generate synthetic test data
│   │   ├── load_provinces.py               # Load provinces from CSV
│   │   ├── load_clusters.py                # Load clusters from CSV
│   │   ├── load_areas.py                   # Load areas from CSV
│   │   ├── load_staff.py                   # Load staff from CSV
│   │   ├── load_etl_documents.py           # Load ETL config from JSON
│   │   ├── load_odk_projects.py            # Load ODK project config
│   │   ├── load_permissions.py             # Load permissions and groups
│   │   ├── odk_import_form_submissions.py  # Import data from ODK Central
│   │   ├── odk_export_entity_lists.py      # Export data to ODK Central
│   │   ├── validate_migration.py           # Validate migration files
│   │   └── list_urls.py                    # List all URL routes
│   │
│   ├── migrations/                         # Database migrations
│   │   └── 0001_initial.py
│   │
│   ├── models/                             # Database models
│   │   ├── __init__.py
│   │   ├── models.py                       # Core models (User, OdkProject, EtlDocument, etc.)
│   │   ├── events.py                       # Event and pregnancy/death tracking
│   │   ├── households.py                   # Household and member data
│   │   ├── verbal_autopsies.py             # Verbal autopsy questionnaire (100+ fields)
│   │   ├── decorators.py                   # Custom decorators (db_timestamps)
│   │   └── query_extensions.py             # Custom QuerySet extensions
│   │
│   ├── odk/                                # ODK integration layer
│   │   ├── odk_config.py                   # ODK configuration
│   │   ├── importers/
│   │   │   └── form_submissions/           # Form submission importers
│   │   │       ├── form_submission_importer.py       # Main importer orchestrator
│   │   │       ├── form_submission_importer_base.py  # Base importer class
│   │   │       ├── form_submission_importer_factory.py
│   │   │       ├── form_submission_import_result.py
│   │   │       ├── events_importer.py
│   │   │       ├── households_importer.py
│   │   │       ├── household_members_importer.py
│   │   │       ├── deaths_importer.py
│   │   │       ├── babies_importer.py
│   │   │       └── verbal_autopsies_importer.py
│   │   ├── exporters/
│   │   │   └── entity_lists/               # Entity list exporters
│   │   │       ├── entity_list_exporter.py
│   │   │       ├── entity_list_exporter_factory.py
│   │   │       ├── entity_list_export_result.py
│   │   │       └── va_preload_exporter.py
│   │   └── transformers/                   # Field transformers for ETL
│   │       ├── transform_field.py
│   │       ├── transformer_factory.py
│   │       ├── replace_transformer.py
│   │       └── strftime_transformer.py
│   │
│   └── templates/admin/                    # Custom admin templates
│       ├── import_file_changelist.html
│       ├── import_file_form.html
│       └── odk/odk_project/change_form.html
│
├── client/                                 # Frontend Django app
│   ├── admin.py
│   ├── apps.py
│   ├── forms.py                            # HTML forms (death management)
│   ├── models.py
│   ├── urls.py                             # Client URL routing
│   ├── views.py                            # View functions
│   ├── static/client/
│   │   ├── css/                            # Page-specific CSS
│   │   │   ├── base.css
│   │   │   ├── header.css
│   │   │   ├── footer.css
│   │   │   ├── home.css
│   │   │   ├── login.css
│   │   │   └── death_management/
│   │   │       ├── home.css
│   │   │       └── edit.css
│   │   ├── js/
│   │   │   └── form_utils.js
│   │   └── images/
│   │       └── avatar.jpg
│   ├── templates/client/                   # HTML templates
│   │   ├── base.html
│   │   ├── header.html
│   │   ├── header_menu_items.html
│   │   ├── footer.html
│   │   ├── home.html
│   │   ├── login.html
│   │   ├── password_reset_*.html           # Password reset flow
│   │   ├── death_management/
│   │   │   ├── home.html
│   │   │   └── edit.html
│   │   └── widgets/
│   │       └── form_layout.html
│   └── templatetags/
│       └── query_utils.py                  # Custom template tags
│
├── config/                                 # Django project configuration
│   ├── __init__.py
│   ├── settings.py                         # Main settings
│   ├── env.py                              # Environment variable management
│   ├── urls.py                             # Root URL configuration
│   ├── wsgi.py                             # WSGI entry point
│   └── asgi.py                             # ASGI entry point
│
├── theme/                                  # TailwindCSS theme app
│   ├── apps.py
│   ├── static/css/dist/
│   │   └── styles.css                      # Compiled TailwindCSS output
│   ├── static_src/
│   │   ├── src/styles.css                  # TailwindCSS source
│   │   ├── tailwind.config.js              # TailwindCSS configuration
│   │   ├── postcss.config.js               # PostCSS configuration
│   │   └── package.json                    # NPM dependencies
│   └── templates/
│       └── base.html                       # Root base template
│
├── tests/                                  # Test suite
│   ├── conftest.py                         # Pytest fixtures and configuration
│   ├── factories/
│   │   ├── factories.py                    # Factory Boy model factories
│   │   └── test_factories.py               # Tests for factories
│   ├── api/
│   │   ├── common/
│   │   │   ├── test_permissions.py
│   │   │   └── test_utils.py
│   │   ├── models/
│   │   │   └── test_models.py
│   │   └── odk/
│   │       ├── test_odk_config.py
│   │       ├── importers/
│   │       │   ├── test_form_submission_importer.py
│   │       │   ├── test_events_importer.py
│   │       │   ├── test_households_importer.py
│   │       │   ├── test_household_members_importer.py
│   │       │   ├── test_deaths_importer.py
│   │       │   ├── test_babies_importer.py
│   │       │   └── test_verbal_autopsies_importer.py
│   │       └── exporters/
│   └── client/
│       └── test_views.py
│
├── docker/                                 # Docker deployment
│   ├── Dockerfile                          # Python/Django app image
│   ├── Dockerfile.nginx                    # Nginx reverse proxy image
│   ├── docker-compose.yml                  # Multi-container orchestration
│   ├── Makefile                            # Docker make commands
│   ├── entrypoint_web.sh                   # Web service startup
│   ├── entrypoint_cron.sh                  # Cron service startup
│   ├── nginx.template.conf                 # Nginx config template
│   ├── crontab.template                    # Cron jobs template
│   ├── .env.template                       # Docker env template
│   └── ReadMe.md                           # Docker deployment guide
│
├── scripts/                                # Helper scripts
│   ├── mk_database.sh                      # Database creation (Linux)
│   ├── gen_mappings_json.py                 # ETL mapping generator
│   ├── run_with_env.sh                     # Run commands with .env (Linux)
│   ├── run_with_env.ps1                    # Run commands with .env (Windows)
│   └── utils.sh                            # Shell utility functions
│
├── .env.template                           # Environment variable template
├── .dockerignore
├── .gitignore
├── LICENSE
├── Makefile                                # Development commands
├── manage.py                               # Django CLI entry point
├── Pipfile                                 # Python dependencies
├── Pipfile.lock
├── pytest.ini                              # Pytest configuration
└── README.md
```

## Core Data Models

### Geography & Staff
- **Province** - Geographic regions
- **Cluster** - Administrative clusters within a province
- **Area** - Geographic areas within a cluster
- **Staff** - Community Surveillance Assistants (CSA) and VA interviewers

### Health Surveillance
- **Event** - Primary health events (pregnancy, death, routine visit)
- **Household** - Household data with consent tracking
- **HouseholdMember** - Individual household members
- **Death** - Death event management with status workflow: `NEW_DEATH` -> `VA_SCHEDULED` -> `VA_COMPLETED`
- **VerbalAutopsy** - Detailed questionnaire responses (100+ fields)

### ODK & ETL
- **OdkProject** - ODK Central project configuration
- **OdkForm** - Forms within an ODK project
- **OdkFormImporter** - Links forms to ETL documents with import ordering
- **OdkEntityList** / **OdkEntityListExporter** - Entity list export configuration
- **EtlDocument** - ETL transformation rules (name, version, source root)
- **EtlMapping** - Field-level mapping with type casting and transformations

### Authentication
- **User** - Custom user model extending Django's AbstractUser with province assignments

## Key Workflows

### Data Import (ODK -> Database)
```
ODK Central -> pyodk -> OdkFormImporter -> EtlMapping -> TypeCaster
-> Transformers -> Django Models -> PostgreSQL
```

### Data Export (Database -> ODK)
```
PostgreSQL -> Django Models -> EntityListExporter -> EtlMapping
-> Transformers -> ODK Entity Lists -> ODK Central
```

### Death Management
```
New Death Event -> Import -> Assign VA Interviewer -> VA Scheduled
-> Verbal Autopsy Completion -> VA Completed -> Read-only
```

## URL Structure

| Path        | Handler          | Description                         |
|-------------|------------------|-------------------------------------|
| `/`         | `client.urls`    | Frontend views (SSR)                |
| `/api/`     | `api.api.urls`   | REST API (Django Ninja)             |
| `/api/docs` | Django Ninja     | Auto-generated API docs (Swagger)   |
| `/admin/`   | Django Admin     | Admin interface                     |

## Deployment

### Docker (Production/Staging)
Four containers orchestrated via Docker Compose:

1. **srs-cms-db** - PostgreSQL 16 with persistent volume
2. **srs-cms-web** - Django/Gunicorn application server
3. **srs-cms-nginx** - Nginx reverse proxy (static files + routing)
4. **srs-cms-cron** - Scheduled ODK imports/exports

### Local Development
- Django dev server (`manage.py runserver`)
- TailwindCSS watch mode (`manage.py tailwind start`)
- Local PostgreSQL instance

## Dependencies

### Production (Python)
- Django 5.2.8
- Django Ninja 1.4.5
- psycopg2-binary (PostgreSQL adapter)
- pyodk 1.2.1 (ODK Central client)
- django-environ (environment config)
- django-tailwind with reload
- python-dateutil

### Development (Python)
- pytest-django, pytest-cov, pytest-mock
- factory_boy 3.3.3
- faker
- coverage, coveralls

### Frontend (NPM)
- TailwindCSS
- DaisyUI
- PostCSS

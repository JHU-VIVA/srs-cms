---
name: django-ninja
description: Reference guide for Django Ninja API development in the SRS-CMS project. This skill should be used when creating, modifying, or reviewing Django Ninja API endpoints, schemas, routers, or authentication patterns. Triggers on tasks involving api.py, API endpoints, Ninja routers, Pydantic schemas for the API layer, or REST API development.
---

# Django Ninja — SRS-CMS Reference Guide

## Overview

This skill documents the Django Ninja conventions, patterns, and architecture used in the SRS-CMS project. It serves as a reference when developing new API endpoints, modifying existing ones, or expanding the API surface.

## Project API Configuration

- **Django Ninja version:** 1.4.5
- **Django version:** 5.2.8
- **API entry point:** `api/api.py`
- **URL mount point:** `/api/` (registered in `config/urls.py`)
- **CSRF:** Enabled (`csrf=True` on the NinjaAPI instance)
- **Authentication:** Session-based using `django_auth` from `ninja.security`
- **Custom User model:** `api.User` (set via `AUTH_USER_MODEL`)

## Current API Structure

All endpoints are currently defined in a single file: `api/api.py`. The NinjaAPI instance is created at module level:

```python
from ninja import NinjaAPI
from ninja.security import django_auth
from ninja import Schema

api = NinjaAPI(csrf=True)
```

Registered in `config/urls.py`:

```python
from api.api import api
urlpatterns = [
    path('api/', api.urls),
    ...
]
```

## Endpoint Conventions

### Decorator Style

Use function-based views with `@api.get()`, `@api.post()`, etc.:

```python
@api.post("/auth/login")
def login_view(request, payload: AuthSchema):
    ...
```

### Authentication

To protect an endpoint, pass `auth=django_auth`:

```python
@api.get("/hello", auth=django_auth)
def test_protected(request):
    ...
```

### Response Format

Return plain dicts. Current convention uses `success` and `message` keys:

```python
return {"success": True, "message": "Logged in successfully."}
return {"success": False, "message": "Invalid credentials."}
```

### Schema Definitions

Use Django Ninja's `Schema` (Pydantic wrapper) for request validation:

```python
class AuthSchema(Schema):
    username: str
    password: str
```

## Router Organization Options

The project currently uses a **flat structure** (all endpoints in `api/api.py`). When adding new endpoints, choose between:

### Option A: Keep Flat (simple, current approach)

Add endpoints directly to `api/api.py`. Best when the API surface is small.

### Option B: Use Routers (modular, for larger APIs)

Create separate router files per domain under `api/routers/`:

```
api/
├── api.py              # NinjaAPI instance + router registration
├── routers/
│   ├── __init__.py
│   ├── auth.py         # Auth endpoints
│   ├── events.py       # Event CRUD
│   ├── households.py   # Household CRUD
│   └── verbal_autopsies.py
```

Router file example (`api/routers/events.py`):

```python
from ninja import Router

router = Router(tags=["events"])

@router.get("/")
def list_events(request):
    ...

@router.post("/")
def create_event(request, payload: EventSchema):
    ...
```

Registration in `api/api.py`:

```python
from api.routers.events import router as events_router

api.add_router("/events/", events_router)
```

## Domain Models Available for API Exposure

The following models exist in `api/models/` but are not yet exposed via API endpoints. Refer to `references/models_and_schemas.md` for detailed field listings.

| Model | File | Key Fields |
|-------|------|------------|
| User | `models/models.py` | provinces (M2M), extends AbstractUser |
| Event | `models/events.py` | event_type, sex, health_card_seen, household FK |
| Baby | `models/events.py` | event FK, birth_weight, birth_order |
| Death | `models/events.py` | event FK, death_status, death_date |
| Household | `models/households.py` | met_status, consent, head_name, gps |
| HouseholdMember | `models/households.py` | household FK, member details |
| VerbalAutopsy | `models/verbal_autopsies.py` | cms_status, event FK |
| OdkProject | `models/models.py` | odk_id, name |
| OdkForm | `models/models.py` | odk_project FK, odk_id, name |
| EtlDocument | `models/models.py` | import tracking and mapping |

All models use the `@db_timestamps` decorator (adds `created_at`, `updated_at`) and `QueryExtensionMixin` (adds `find_by()`, `filter_by()`).

## Adding a New CRUD Endpoint

When creating a new endpoint for a domain model, follow this pattern:

1. **Define schemas** — Create request/response Pydantic schemas
2. **Write the endpoint** — Use `@api.get()`/`@api.post()` or a Router
3. **Use `auth=django_auth`** for protected endpoints
4. **Check permissions** — Use `Permissions.has_permission()` from `api/common/permissions.py` when needed

Example for a list endpoint:

```python
from ninja import Schema
from api.models import Event

class EventOut(Schema):
    id: int
    event_type: int
    created_at: str

@api.get("/events", auth=django_auth, response=list[EventOut])
def list_events(request):
    return Event.objects.all()
```

## Permissions System

Located in `api/common/permissions.py`:

```python
from api.common import Permissions

# Check permission
if Permissions.has_permission(request, Permissions.Codes.VIEW_ALL_PROVINCES):
    ...
```

Available permission codes:
- `Permissions.Codes.SCHEDULE_VA`
- `Permissions.Codes.VIEW_ASSIGNED_PROVINCES`
- `Permissions.Codes.VIEW_ALL_PROVINCES`

Groups: `Province Users`, `Central Users`, `Administrator Users`

## Resources

### references/

- `models_and_schemas.md` — Detailed model field listings, choice enumerations, and relationships for schema design

# Models & Schema Reference

Detailed field listings for domain models in `api/models/`. Use this when designing Pydantic schemas for API endpoints.

## Common Patterns

All models use:
- `@db_timestamps` decorator → adds `created_at: DateTimeField(auto_now_add)`, `updated_at: DateTimeField(auto_now)`
- `QueryExtensionMixin` → adds `find_by(**kwargs)` and `filter_by(**kwargs)` class methods

## User (`api/models/models.py`)

Extends `AbstractUser`. Custom user model (`AUTH_USER_MODEL = 'api.User'`).

| Field | Type | Notes |
|-------|------|-------|
| provinces | ManyToManyField(Province) | blank=True, related_name='assigned_users' |
| *(inherited)* | AbstractUser fields | username, email, first_name, last_name, etc. |

**Table:** `users`

## Event (`api/models/events.py`)

Core event record (births, deaths, etc.).

| Field | Type | Notes |
|-------|------|-------|
| household | ForeignKey(Household) | on_delete=CASCADE |
| event_type | IntegerField | choices: EventType |
| sex | IntegerField | choices: SexType |
| health_card_seen | IntegerField | choices: HealthCardSeen |

**Choice Enumerations:**
- `EventType` — IntegerChoices for event classification
- `SexType` — IntegerChoices for sex
- `HealthCardSeen` — IntegerChoices for health card status

**Table:** `events`

## Baby (`api/models/events.py`)

Birth details linked to an Event.

| Field | Type | Notes |
|-------|------|-------|
| event | ForeignKey(Event) | on_delete=CASCADE |
| birth_weight | FloatField | nullable |
| birth_order | IntegerField | nullable |

**Table:** `babies`

## Death (`api/models/events.py`)

Death details linked to an Event.

| Field | Type | Notes |
|-------|------|-------|
| event | ForeignKey(Event) | on_delete=CASCADE |
| death_status | IntegerField | choices: DeathStatus |
| death_date | DateField | nullable |

**Table:** `deaths`

## Household (`api/models/households.py`)

Household record for survey tracking.

| Field | Type | Notes |
|-------|------|-------|
| met_status | IntegerField | choices: MetStatusType |
| consent | IntegerField | choices: ConsentType |
| head_name | CharField | head of household |
| gps | CharField | GPS coordinates |

**Choice Enumerations:**
- `MetStatusType` — IntegerChoices for met status
- `ConsentType` — IntegerChoices for consent status

**Table:** `households`

## HouseholdMember (`api/models/households.py`)

Individual members within a household.

| Field | Type | Notes |
|-------|------|-------|
| household | ForeignKey(Household) | on_delete=CASCADE |
| *(member fields)* | various | name, age, sex, relationship, etc. |

**Table:** `household_members`

## VerbalAutopsy (`api/models/verbal_autopsies.py`)

Verbal autopsy tracking record.

| Field | Type | Notes |
|-------|------|-------|
| event | ForeignKey(Event) | on_delete=CASCADE |
| cms_status | IntegerField | choices: CmsStatusType |

**Choice Enumerations:**
- `CmsStatusType` — TextChoices for CMS workflow status

**Table:** `verbal_autopsies`

## ODK Models (`api/models/models.py`)

### OdkProject

| Field | Type | Notes |
|-------|------|-------|
| odk_id | IntegerField | ODK Central project ID |
| name | CharField | Project name |

### OdkForm

| Field | Type | Notes |
|-------|------|-------|
| odk_project | ForeignKey(OdkProject) | on_delete=CASCADE |
| odk_id | CharField | ODK form ID |
| name | CharField | Form name |

### EtlDocument

| Field | Type | Notes |
|-------|------|-------|
| *(mapping fields)* | various | Import tracking, field mappings |

## Schema Design Tips

When creating Pydantic `Schema` classes for these models:

- Use `Schema.from_orm()` compatibility — Django Ninja handles ORM→Schema conversion automatically when `response=` is set on the endpoint
- For choice fields, expose as `int` and optionally add a display label field
- For ForeignKey fields, decide between nested schema or flat ID reference
- For ManyToMany fields (e.g., User.provinces), use `list[ProvinceOut]` in the response schema
- Always include `id` in response schemas
- Omit `created_at`/`updated_at` from input schemas (they're auto-managed)

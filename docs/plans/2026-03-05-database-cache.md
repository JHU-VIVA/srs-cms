# Database Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Django database-backed caching to avoid recalculating expensive queries on every page visit, with automatic invalidation after nightly ODK imports.

**Architecture:** Use Django's built-in `DatabaseCache` backend, storing cached responses in a PostgreSQL table. Cache keys are derived from endpoint + filter parameters. The nightly `odk_import_form_submissions` command clears the entire cache after import completes.

**Tech Stack:** Django cache framework (DatabaseCache), no new dependencies.

---

### Task 1: Add Cache Backend to Django Settings

**Files:**
- Modify: `config/settings.py:108-117` (after DATABASES block)

**Step 1: Add CACHES setting**

Add after the `DATABASES` block in `config/settings.py`:

```python
# Cache
# https://docs.djangoproject.com/en/5.1/topics/cache/
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'django_cache',
        'TIMEOUT': 60 * 60,  # 1 hour default TTL (seconds)
    }
}
```

**Step 2: Create the cache table**

Run: `python manage.py createcachetable`

This creates the `django_cache` table in PostgreSQL. No migration file needed — Django handles this with `createcachetable`.

**Step 3: Verify cache works**

Run: `python manage.py shell -c "from django.core.cache import cache; cache.set('test', 'ok', 10); print(cache.get('test'))"`

Expected: `ok`

**Step 4: Commit**

```bash
git add config/settings.py
git commit -m "feat: add Django database cache backend"
```

---

### Task 2: Add Cache Helper for API Endpoints

**Files:**
- Create: `api/common/cache_utils.py`
- Modify: `api/common/__init__.py`

**Step 1: Create `api/common/cache_utils.py`**

```python
import hashlib
from django.core.cache import cache


def make_cache_key(prefix, **params):
    """Build a deterministic cache key from prefix and filter params."""
    filtered = {k: v for k, v in sorted(params.items()) if v is not None}
    raw = f"{prefix}:{filtered}"
    suffix = hashlib.md5(raw.encode()).hexdigest()
    return f"{prefix}:{suffix}"


def get_or_set_cache(key, fn, timeout=None):
    """Return cached value or call fn() and cache the result."""
    result = cache.get(key)
    if result is None:
        result = fn()
        cache.set(key, result, timeout)
    return result


def clear_all_cache():
    """Clear the entire cache. Called after ODK imports."""
    cache.clear()
```

**Step 2: Export from `api/common/__init__.py`**

Read `api/common/__init__.py` first, then add the import for `cache_utils`. Add:

```python
from api.common.cache_utils import make_cache_key, get_or_set_cache, clear_all_cache
```

**Step 3: Commit**

```bash
git add api/common/cache_utils.py api/common/__init__.py
git commit -m "feat: add cache utility helpers"
```

---

### Task 3: Cache the Deaths API List Endpoint

**Files:**
- Modify: `api/api.py:323-371` (the `list_deaths` function)

**Step 1: Add cache import at top of `api/api.py`**

Add to existing imports at top of file:

```python
from api.common import Permissions, make_cache_key, get_or_set_cache
```

**Step 2: Wrap `list_deaths` with caching**

Replace the body of `list_deaths` (lines ~334-371) with:

```python
@api.get("/deaths", auth=django_auth, response=PaginatedDeathsOut)
def list_deaths(
    request,
    status: Optional[int] = None,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    cache_key = make_cache_key("deaths_list",
        status=status, province_id=province_id,
        start_date=start_date, end_date=end_date,
        q=q, page=page, page_size=page_size)

    def fetch():
        qs = Death.objects.select_related('event', 'event__cluster', 'event__area', 'event__event_staff', 'va_staff')

        if status is not None:
            qs = qs.filter(death_status=status)
        if province_id:
            qs = qs.filter(event__cluster__province_id=province_id)
        if start_date and end_date:
            qs = qs.filter(deceased_dod__gte=parse_date(start_date), deceased_dod__lte=parse_date(end_date))
        elif start_date:
            qs = qs.filter(deceased_dod__gte=parse_date(start_date))
        elif end_date:
            qs = qs.filter(deceased_dod__lte=parse_date(end_date))
        if q and q.strip():
            query = q.strip()
            qs = qs.filter(
                Q(death_code__icontains=query) |
                Q(event__area__code__icontains=query)
            )
        qs = qs.order_by('-id')

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except (PageNotAnInteger, EmptyPage):
            page_obj = paginator.page(1)

        return PaginatedDeathsOut(
            items=[DeathOut.from_death(d) for d in page_obj.object_list],
            total=paginator.count,
            page=page_obj.number,
            page_size=page_size,
            num_pages=paginator.num_pages,
        )

    return get_or_set_cache(cache_key, fetch)
```

**Step 3: Verify manually**

Run: `make runserver`, visit the deaths list page. First load should be normal speed, second load should be faster (served from cache).

**Step 4: Commit**

```bash
git add api/api.py
git commit -m "feat: cache deaths list API endpoint"
```

---

### Task 4: Cache the Pregnancy Outcomes API List Endpoint

**Files:**
- Modify: `api/api.py:434-458` (the `list_pregnancy_outcomes` function)

**Step 1: Wrap `list_pregnancy_outcomes` with caching**

Same pattern as Task 3:

```python
@api.get("/pregnancy-outcomes", auth=django_auth, response=PaginatedPregnancyOutcomesOut)
def list_pregnancy_outcomes(
    request,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    cache_key = make_cache_key("pregnancy_outcomes_list",
        province_id=province_id, start_date=start_date,
        end_date=end_date, q=q, page=page, page_size=page_size)

    def fetch():
        qs = _filter_pregnancy_outcomes(province_id, start_date, end_date, q)
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except (PageNotAnInteger, EmptyPage):
            page_obj = paginator.page(1)

        return PaginatedPregnancyOutcomesOut(
            items=[PregnancyOutcomeOut.from_event(e) for e in page_obj.object_list],
            total=paginator.count,
            page=page_obj.number,
            page_size=page_size,
            num_pages=paginator.num_pages,
        )

    return get_or_set_cache(cache_key, fetch)
```

**Step 2: Commit**

```bash
git add api/api.py
git commit -m "feat: cache pregnancy outcomes list API endpoint"
```

---

### Task 5: Cache the Households API List Endpoint

**Files:**
- Modify: `api/api.py:515-560` (the `list_households` function)

**Step 1: Wrap `list_households` with caching**

Same pattern:

```python
@api.get("/households", auth=django_auth, response=PaginatedHouseholdsOut)
def list_households(
    request,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    cache_key = make_cache_key("households_list",
        province_id=province_id, start_date=start_date,
        end_date=end_date, q=q, page=page, page_size=page_size)

    def fetch():
        qs = Household.objects.select_related(
            'cluster', 'area', 'event_staff'
        ).prefetch_related('household_members')

        if province_id:
            qs = qs.filter(cluster__province_id=province_id)
        if start_date and end_date:
            qs = qs.filter(interview_date__gte=parse_date(start_date), interview_date__lte=parse_date(end_date))
        elif start_date:
            qs = qs.filter(interview_date__gte=parse_date(start_date))
        elif end_date:
            qs = qs.filter(interview_date__lte=parse_date(end_date))
        if q and q.strip():
            query = q.strip()
            qs = qs.filter(
                Q(household_code__icontains=query) |
                Q(cluster_code__icontains=query)
            )
        qs = qs.order_by('-id')

        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except (PageNotAnInteger, EmptyPage):
            page_obj = paginator.page(1)

        return PaginatedHouseholdsOut(
            items=[HouseholdOut.from_household(h) for h in page_obj.object_list],
            total=paginator.count,
            page=page_obj.number,
            page_size=page_size,
            num_pages=paginator.num_pages,
        )

    return get_or_set_cache(cache_key, fetch)
```

**Step 2: Commit**

```bash
git add api/api.py
git commit -m "feat: cache households list API endpoint"
```

---

### Task 6: Cache the Deaths Home Template View

**Files:**
- Modify: `client/views.py:18-113` (the `deaths_home` function)

**Step 1: Add cache imports to `client/views.py`**

Add to imports:

```python
from api.common import make_cache_key, get_or_set_cache
```

**Step 2: Wrap the expensive query + paginate section with caching**

The deaths_home view renders a template, so we cache the context data (not the full response) to keep template rendering fresh for per-user permissions. Replace the body of `deaths_home` (after the filters/permissions setup) with caching around the queryset + pagination logic:

```python
@login_required(login_url="/login/")
def deaths_home(request):
    province_id = request.GET.get('province')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    query = request.GET.get('q', '').strip()
    paging_size = TypeCaster.to_int(request.GET.get('paging_size', 10), default=10)

    provinces = Province.objects.for_user(request.user)
    can_schedule_va = Permissions.has_permission(request, Permissions.Codes.SCHEDULE_VA)
    can_view_all_provinces = Permissions.has_permission(request, Permissions.Codes.VIEW_ALL_PROVINCES)

    selected_province = None
    if province_id:
        selected_province = provinces.get(id=province_id)
    elif not can_view_all_provinces:
        selected_province = provinces.first()

    # Cache key based on filter params + pagination
    new_deaths_page = request.GET.get('new_deaths_page', 1)
    scheduled_deaths_page = request.GET.get('scheduled_deaths_page', 1)
    completed_deaths_page = request.GET.get('completed_deaths_page', 1)

    cache_key = make_cache_key("deaths_home",
        province_id=selected_province.id if selected_province else None,
        start_date=start_date, end_date=end_date, q=query,
        paging_size=paging_size,
        new_deaths_page=new_deaths_page,
        scheduled_deaths_page=scheduled_deaths_page,
        completed_deaths_page=completed_deaths_page)

    def fetch_deaths_data():
        filters = {}
        if selected_province:
            filters['event__cluster__province_id'] = selected_province
        if start_date and end_date:
            filters['deceased_dod__gte'] = parse_date(start_date)
            filters['deceased_dod__lte'] = parse_date(end_date)
        else:
            if start_date:
                filters['deceased_dod'] = parse_date(start_date)
            elif end_date:
                filters['deceased_dod'] = parse_date(end_date)

        new_deaths = Death.objects.filter(death_status=Death.DeathStatus.NEW_DEATH, **filters)
        scheduled_deaths = Death.objects.filter(death_status=Death.DeathStatus.VA_SCHEDULED, **filters)
        completed_deaths = Death.objects.filter(death_status=Death.DeathStatus.VA_COMPLETED, **filters)

        if query:
            similarity = (
                    0.5 * TrigramSimilarity(Coalesce(F('death_code'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('va_staff__code'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('event__event_staff__code'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('event__area__code'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('event__household_head_name'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('deceased_name'), Value('')), query) +
                    0.4 * TrigramSimilarity(Coalesce(F('event__respondent_name'), Value('')), query)
            )
            min_similarity = 0.05
            new_deaths = new_deaths.annotate(similarity=similarity).filter(
                similarity__gte=min_similarity).order_by('-similarity')
            scheduled_deaths = scheduled_deaths.annotate(similarity=similarity).filter(
                similarity__gte=min_similarity).order_by('-similarity')
            completed_deaths = completed_deaths.annotate(similarity=similarity).filter(
                similarity__gte=min_similarity).order_by('-similarity')

        (new_deaths, new_deaths_paginator,
         scheduled_deaths, scheduled_deaths_paginator,
         completed_deaths, completed_deaths_paginator) = paginate(
            request,
            page_keys=['new_deaths_page', 'scheduled_deaths_page', 'completed_deaths_page'],
            items=[new_deaths, scheduled_deaths, completed_deaths],
            page_size=paging_size
        )

        return {
            'new_deaths': new_deaths,
            'new_deaths_paginator': new_deaths_paginator,
            'new_deaths_total': new_deaths_paginator.count,
            'new_deaths_page_total': len(new_deaths.object_list),
            'scheduled_deaths': scheduled_deaths,
            'scheduled_deaths_paginator': scheduled_deaths_paginator,
            'scheduled_deaths_total': scheduled_deaths_paginator.count,
            'scheduled_deaths_page_total': len(scheduled_deaths.object_list),
            'completed_deaths': completed_deaths,
            'completed_deaths_paginator': completed_deaths_paginator,
            'completed_deaths_total': completed_deaths_paginator.count,
            'completed_deaths_page_total': len(completed_deaths.object_list),
        }

    deaths_data = get_or_set_cache(cache_key, fetch_deaths_data)

    return render(
        request,
        'client/death_management/home.html',
        {
            'can_schedule_va': can_schedule_va,
            'can_view_all_provinces': can_view_all_provinces,
            'provinces': provinces,
            'selected_province': selected_province,
            'start_date': start_date,
            'end_date': end_date,
            'query': query,
            'paging_size': paging_size,
            'paging_sizes': [10, 20, 50, 100],
            **deaths_data,
        }
    )
```

**Step 3: Commit**

```bash
git add client/views.py
git commit -m "feat: cache deaths home template view data"
```

---

### Task 7: Invalidate Cache After ODK Import

**Files:**
- Modify: `api/management/commands/odk_import_form_submissions.py:72-96`

**Step 1: Add cache clear after successful import**

Modify the `handle` method to clear cache after a successful import:

```python
from api.common import clear_all_cache

# ... existing code ...

def handle(self, *args, **kwargs):
    project_ids = kwargs['projects']
    form_ids = kwargs['forms']
    form_versions = kwargs['form_versions']
    importers = kwargs['importers']
    out_dir = kwargs['out_dir']
    start_date = kwargs['start_date']
    end_date = kwargs['end_date']
    verbose = kwargs['verbose']

    odk_import_result = FromSubmissionImporter(
        odk_projects=project_ids,
        odk_forms=form_ids,
        form_versions=form_versions,
        importers=importers,
        import_start_date=start_date,
        import_end_date=end_date,
        out_dir=out_dir,
        verbose=verbose
    ).execute()

    clear_all_cache()
    self.stdout.write(self.style.SUCCESS('Cache cleared.'))

    if odk_import_result.errors:
        sys.exit(1)
    else:
        sys.exit(0)
```

**Step 2: Also clear cache after death updates (api.py `update_death`)**

Since users can update death records (schedule VAs), add cache clear to `update_death` in `api/api.py:382-400`:

```python
from api.common import Permissions, make_cache_key, get_or_set_cache, clear_all_cache

# In update_death, after death.save():
    death.save()
    clear_all_cache()
    return {"success": True, "message": "Death record updated."}
```

**Step 3: Commit**

```bash
git add api/management/commands/odk_import_form_submissions.py api/api.py
git commit -m "feat: invalidate cache after ODK import and death updates"
```

---

### Task 8: Add Makefile Command for Manual Cache Clear

**Files:**
- Modify: `Makefile` (append at end)

**Step 1: Add cache clear command**

Append to `Makefile`:

```makefile
# Clear the application cache.
.PHONY: clear_cache
clear_cache:
	python manage.py shell -c "from django.core.cache import cache; cache.clear(); print('Cache cleared.')"
```

**Step 2: Commit**

```bash
git add Makefile
git commit -m "feat: add Makefile command to clear cache"
```

---

### Task 9: Verify End-to-End

**Step 1: Run tests**

Run: `pytest`

Expected: All existing tests pass (caching is transparent to tests).

**Step 2: Manual smoke test**

1. `make runserver`
2. Visit deaths list, pregnancy outcomes list, households list
3. Verify pages load correctly
4. Reload same page — should be faster (served from cache)
5. Run `make clear_cache` — verify cache clears
6. Reload — first load recalculates, subsequent loads cached again

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: database cache for expensive API queries with post-import invalidation"
```

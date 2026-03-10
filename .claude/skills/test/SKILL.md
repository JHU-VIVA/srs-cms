---
name: test
description: Run all tests for the SRS-CMS project (pytest unit/integration tests and Playwright E2E tests). This skill should be used when asked to run tests, verify code changes, validate a feature, or check for regressions. Triggers on "run tests", "test", "/test", or after implementing features/fixes.
---

# Test

## Important Reminder

> "All tests pass" only proves existing tests pass — missing tests hide bugs.
> After running tests, consider whether the current change has adequate test coverage.

## Prerequisites

> Before running tests that require the backend (API tests, Playwright E2E), check if the server is running.
> If not, start it. If the server is not available, check other options (e.g., skip E2E, run unit tests only).

### Backend server check

To verify the Django dev server is running on port 8001:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/ || echo "NOT RUNNING"
```

To start the backend if needed:

```bash
cd /Users/ericliu/projects5/srs-cms && pipenv run python manage.py runserver 8001 &
```

### Frontend dev server check

To verify the Vite dev server is running on port 3000:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "NOT RUNNING"
```

To start the frontend if needed:

```bash
cd /Users/ericliu/projects5/srs-cms/frontend && npm run dev &
```

## Test Suites

Run all test suites in order. Report results for each suite individually, then summarize.

### 1. Pytest (Unit + Integration Tests)

Django backend tests covering models, API permissions, ODK importers, reference resolver, data integrity, and factories.

```bash
cd /Users/ericliu/projects5/srs-cms && pipenv run pytest
```

**Test locations:**
- `tests/api/common/` — permissions, utils
- `tests/api/models/` — model tests
- `tests/api/odk/dev/` — reference resolver tests
- `tests/api/odk/importers/` — importer tests (households, babies, deaths, events, verbal autopsies, form submissions, data integrity)
- `tests/factories/` — factory tests

### 2. Playwright E2E Tests

Frontend integration tests running against live backend + frontend servers. Requires both servers running.

```bash
cd /Users/ericliu/projects5/srs-cms/frontend && npx playwright test
```

**Test locations:**
- `frontend/e2e/auth.spec.ts` — login, logout, redirect guards
- `frontend/e2e/dashboard.spec.ts` — metric cards, totals, navigation
- `frontend/e2e/households.spec.ts` — table, filters, search, detail view
- `frontend/e2e/deaths.spec.ts` — headers, filters, detail, pagination
- `frontend/e2e/pregnancy-outcomes.spec.ts` — table, download, detail view

**Config:** `frontend/playwright.config.ts` (headless Chromium, baseURL `http://localhost:3000`, webServer auto-start with `reuseExistingServer: true`)

## Results Summary

After running all suites, report in this format:

```
Test Results:
- Pytest: X passed / Y failed
- Playwright E2E: X passed / Y failed
- Total: X passed / Y failed
```

<!-- GROWTH NOTE: Add new test suites as sections below this line -->

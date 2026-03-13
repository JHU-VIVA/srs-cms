---
name: test
description: Run all tests for the SRS-CMS project (pytest unit/integration tests, Playwright E2E tests, and Chrome E2E visual tests). This skill should be used when asked to run tests, verify code changes, validate a feature, or check for regressions. Triggers on "run tests", "test", "/test", or after implementing features/fixes.
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

### 3. Chrome E2E Visual Tests

AI agent-driven visual testing using `claude-in-chrome` browser automation. Claude opens the real app in Chrome, navigates through all pages, and visually verifies UI rendering, data display, and layout correctness.

**Requires:** Both backend (port 8001) and frontend (port 3000) servers running, plus Chrome browser with claude-in-chrome extension.

#### Setup

1. Call `tabs_context_mcp` to get Chrome context (use `createIfEmpty: true`)
2. Create a new tab with `tabs_create_mcp`
3. Navigate to `http://localhost:3000/login`

#### Login

**Important:** This is a React app with controlled inputs. `form_input` sets DOM values but does NOT trigger React state updates. Use `javascript_tool` instead:

```javascript
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const usernameInput = document.querySelector('input[type="text"]');
const passwordInput = document.querySelector('input[type="password"]');
nativeInputValueSetter.call(usernameInput, 'admin');
usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
nativeInputValueSetter.call(passwordInput, 'admin');
passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
```

Wait 3 seconds, then verify URL changed to `/dashboard`.

#### Navigation Tips

- **Page navigation:** Use `navigate` tool with direct URLs (e.g., `http://localhost:3000/deaths`) rather than clicking header links, which may not respond reliably.
- **Detail pages:** Click "View"/"Edit"/"Schedule VA" links in tables, or navigate directly (e.g., `http://localhost:3000/households/2`).
- **Logout:** The avatar dropdown uses CSS `visibility: hidden` and requires hover. Use `javascript_tool` to click:
  ```javascript
  const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Logout');
  let el = logoutBtn; while (el) { el.style.visibility = 'visible'; el = el.parentElement; }
  logoutBtn.click();
  ```

#### Page Checkpoints

Follow this user flow, using `browser_snapshot` at each page to verify:

**Dashboard** (`/dashboard`):
- 6 metric cards visible with numeric values
- Navigation links present (Deaths, Households, Pregnancy Outcomes)
- Charts render (canvas/SVG elements)

**Deaths list** (`/deaths`) — navigate via header link:
- Section headers for death categories
- Filter controls visible (province, date range)
- Table with data rows (name, date, location, status columns)

**Death detail** (`/deaths/:id`) — click first record in the table:
- Detail page loads with death information
- Fields show real data (not undefined/null/empty)
- Back navigation works (click back or navigate to `/deaths`)

**Households list** (`/households`) — navigate via header link:
- Table with columns (household ID, head, province, cluster)
- Search input present
- Province filter dropdown present

**Household detail** (`/households/:id`) — click first record:
- Household info displays correctly
- Members table with data rows
- Back navigation works

**Pregnancy Outcomes** (`/pregnancy-outcomes`) — navigate via header link:
- Table with data rows
- Excel export/download link visible

**Pregnancy Outcome detail** (`/pregnancy-outcomes/:id`) — click first record:
- Outcome info displays correctly
- Baby records table present
- Back navigation works

**Logout** — click user avatar in header, then logout:
- Returns to login page

#### Failure Criteria

A checkpoint FAILS if:
- Page doesn't load or shows error/stuck spinner
- Expected elements missing from accessibility tree
- Data shows `undefined`, `null`, `NaN` when real data expected
- Tables show 0 rows when database has records
- Detail page navigation fails (404 or stays on list)
- CSS/layout visibly broken (overlapping, off-screen elements)

**On failure:** Take a screenshot with `browser_take_screenshot` and note the issue.

#### Chrome E2E Report Format

```
Chrome E2E Visual Results:
- Login: PASS/FAIL
- Dashboard: PASS/FAIL (details)
- Deaths list: PASS/FAIL (details)
- Death detail: PASS/FAIL (details)
- Households list: PASS/FAIL (details)
- Household detail: PASS/FAIL (details)
- Pregnancy Outcomes: PASS/FAIL (details)
- Outcome detail: PASS/FAIL (details)
- Logout: PASS/FAIL
Total: X/9 passed
```

## Results Summary

After running all suites, report in this format:

```
Test Results:
- Pytest: X passed / Y failed
- Playwright E2E: X passed / Y failed
- Chrome E2E Visual: X/9 checkpoints passed
- Total: X passed / Y failed / Z visual checkpoints
```

<!-- GROWTH NOTE: Add new test suites as sections below this line -->

# Chrome E2E Visual Testing Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add a Chrome E2E Visual Testing section to the existing `/test` skill (`.claude/skills/test/SKILL.md`). This instructs Claude Code to use the `claude-in-chrome` browser automation tools to navigate the live app in Chrome, visually inspect UI rendering, real data display, and layout correctness, and report issues.

This complements (does not replace) the existing Playwright E2E tests. Playwright tests are scripted and headless; Chrome E2E tests are agent-driven and visual — Claude sees the actual rendered UI and judges correctness.

## How It Works

1. Claude checks that both backend (port 8001) and frontend (port 3000) servers are running
2. Gets Chrome tab context via `tabs_context_mcp`, creates a new tab
3. Navigates to `http://localhost:3000/login`
4. Logs in with admin credentials (username: `admin`, password: `admin`)
5. Follows a user flow through all 8 app pages
6. At each page: takes a `browser_snapshot` (accessibility tree), verifies expected elements/data exist
7. Takes a screenshot ONLY if an issue is detected
8. Reports pass/fail per page checkpoint

## User Flow

Claude follows this natural navigation path:

```
Login → Dashboard → Deaths list → Death detail (click first record) → Back →
Households list → Household detail (click first record) → Back →
Pregnancy Outcomes list → Outcome detail (click first record) → Back →
Logout
```

## Page Checkpoints

### 1. Login Page (`/login`)
- Login form renders with username and password fields
- Submit button is present
- After login, redirects to `/dashboard`

### 2. Dashboard (`/dashboard`)
- 6 metric cards are visible with numeric values (not "0" or empty unless DB is empty)
- Navigation links present (Deaths, Households, Pregnancy Outcomes)
- Charts render (canvas or SVG elements present)
- Page title/header is correct

### 3. Deaths List (`/deaths`)
- Page has section headers for death categories
- Filter controls are visible (province, date range)
- Table displays data rows with columns (name, date, location, status)
- Pagination controls present if data exists

### 4. Death Detail (`/deaths/:id`)
- Click first available death record from the list
- Detail page loads with death information fields
- Fields display real data (name, date, location not empty/undefined)
- Form elements present (VA scheduling, staff assignment if applicable)
- Back/navigation works

### 5. Households List (`/households`)
- Table renders with columns (household ID, head of household, province, cluster)
- Search input is functional
- Province filter dropdown is present
- Data rows display real values

### 6. Household Detail (`/households/:id`)
- Click first available household from the list
- Household information displays correctly
- Members table shows household members with real data
- Back/navigation works

### 7. Pregnancy Outcomes List (`/pregnancy-outcomes`)
- Table renders with data rows
- Excel export/download link is visible
- Columns display meaningful data

### 8. Pregnancy Outcome Detail (`/pregnancy-outcomes/:id`)
- Click first available outcome from the list
- Outcome information displays correctly
- Baby records table present (if applicable)
- Back/navigation works

### 9. Logout
- Click user avatar/menu in header
- Click logout option
- Returns to login page

## Failure Criteria

A checkpoint FAILS if:
- Page does not load (blank, error, spinner stuck)
- Expected elements are missing from the accessibility tree
- Data fields show `undefined`, `null`, `NaN`, or empty when data should exist
- Tables have zero rows when the database has records
- Navigation to detail page fails (404 or stays on list)
- CSS/layout is visibly broken (elements overlapping, off-screen, invisible)

## Report Format

```
Chrome E2E Visual Results:
- Login: PASS
- Dashboard: PASS (6 metrics, charts rendered)
- Deaths list: PASS (3 sections, N records)
- Death detail: PASS (fields populated)
- Households list: PASS (N records, filters present)
- Household detail: PASS (members table with N rows)
- Pregnancy Outcomes: PASS (N records, export link visible)
- Outcome detail: PASS (baby records displayed)
- Logout: PASS
Total: 9/9 passed
```

## Integration with Test Skill

Added as "### 3. Chrome E2E Visual Tests" section in `.claude/skills/test/SKILL.md`, after the Playwright section. The results summary format is updated to include the Chrome E2E line.

## Scope Exclusions

- No responsive/mobile viewport testing
- No permission/role-based testing (only admin user)
- No form submission/save testing (read-only visual checks)
- No performance or load testing
- Screenshots only on failure, not for every page

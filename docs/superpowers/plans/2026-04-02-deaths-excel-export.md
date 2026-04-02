# Deaths Page Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Excel download button to each of the 3 death grids (New, Scheduled, Completed), following the same pattern as pregnancy-outcomes export.

**Architecture:** Extract shared filtering logic from `list_deaths()` into a `_filter_deaths()` helper (mirroring `_filter_pregnancy_outcomes()`). Add a single `/deaths/export` endpoint that accepts a `status` parameter. Frontend adds an export button per grid section, each calling the same endpoint with its status code.

**Tech Stack:** Django Ninja, openpyxl, React, TypeScript, fetch API

---

### Task 1: Extract `_filter_deaths()` helper in backend

**Files:**
- Modify: `api/api.py:329-377`

- [ ] **Step 1: Add `_filter_deaths()` helper above `list_deaths()`**

Add this function directly above `list_deaths()` (around line 328), mirroring the `_filter_pregnancy_outcomes()` pattern at line 413:

```python
def _filter_deaths(status=None, province_id=None, start_date=None, end_date=None, q=None):
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

    return qs.order_by('-id')
```

- [ ] **Step 2: Refactor `list_deaths()` to use the helper**

Replace the inline filtering in `list_deaths()` with a call to `_filter_deaths()`. The function should become:

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
    qs = _filter_deaths(status, province_id, start_date, end_date, q)

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
```

- [ ] **Step 3: Verify the existing deaths page still works**

Run the dev server, open http://localhost:3000/deaths, confirm all 3 grids load correctly with filtering. This is a refactor-only change — behavior should be identical.

- [ ] **Step 4: Commit**

```bash
git add api/api.py
git commit -m "refactor: extract _filter_deaths() helper from list_deaths()"
```

---

### Task 2: Add `/deaths/export` backend endpoint

**Files:**
- Modify: `api/api.py` (add new endpoint after `update_death`, around line 407)

- [ ] **Step 1: Add the export endpoint**

Add this endpoint after `update_death()` and before the pregnancy outcomes section comment. It follows the exact same pattern as `export_pregnancy_outcomes()` (line 467). The `status` parameter determines which columns to use — New/Scheduled get one set, Completed gets another (matching the frontend grid columns).

```python
@api.get("/deaths/export", auth=django_auth)
def export_deaths(
    request,
    status: Optional[int] = None,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
):
    qs = _filter_deaths(status, province_id, start_date, end_date, q)

    wb = openpyxl.Workbook()
    ws = wb.active

    is_completed = status == Death.DeathStatus.VA_COMPLETED

    if is_completed:
        ws.title = "Completed Deaths"
        ws.append(["Death ID", "Work Area/District", "Cluster", "Worker", "Deceased Name",
                    "Date of Death", "Household ID", "VA Interviewer", "VA Date", "VA Submitted"])
    else:
        ws.title = "Deaths"
        ws.append(["Death ID", "Work Area/District", "Cluster", "Worker", "Deceased Name",
                    "Date of Death", "Household ID", "HH Head Name", "Respondent",
                    "VA Date Requested", "Submission Date"])

    for death in qs:
        event = death.event
        event_staff = event.event_staff
        va_staff = death.va_staff
        if is_completed:
            ws.append([
                death.death_code or "",
                event.area_code or "",
                event.cluster_code or "",
                event_staff.full_name if event_staff else "",
                death.deceased_name or "",
                str(death.deceased_dod) if death.deceased_dod else "",
                event.household_code or "",
                va_staff.full_name if va_staff else "",
                str(death.va_scheduled_date) if death.va_scheduled_date else "",
                str(death.va_completed_date) if death.va_completed_date else "",
            ])
        else:
            ws.append([
                death.death_code or "",
                event.area_code or "",
                event.cluster_code or "",
                event_staff.full_name if event_staff else "",
                death.deceased_name or "",
                str(death.deceased_dod) if death.deceased_dod else "",
                event.household_code or "",
                event.household_head_name or "",
                event.respondent_name or "",
                str(death.va_proposed_date) if death.va_proposed_date else "",
                str(event.submission_date) if event.submission_date else "",
            ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    status_label = {0: "new", 1: "scheduled", 2: "completed"}.get(status, "all")
    today = date.today().strftime("%Y-%m-%d")
    response = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="deaths_{status_label}_{today}.xlsx"'
    return response
```

- [ ] **Step 2: Verify endpoint works**

With the dev server running, log in and test manually in browser devtools:
```
fetch('/api/deaths/export?status=0', {credentials: 'same-origin'}).then(r => r.blob()).then(b => console.log(b.size))
```
Should return a non-zero blob size.

- [ ] **Step 3: Commit**

```bash
git add api/api.py
git commit -m "feat: add /deaths/export endpoint for Excel download"
```

---

### Task 3: Add `exportDeaths()` frontend API function

**Files:**
- Modify: `frontend/src/api/deaths.ts`

- [ ] **Step 1: Add the export function**

Add this function at the end of `frontend/src/api/deaths.ts`, following the exact same pattern as `exportPregnancyOutcomes()` in `frontend/src/api/pregnancyOutcomes.ts:30-40`:

```typescript
export async function exportDeaths(params: Pick<DeathsParams, "status" | "province_id" | "start_date" | "end_date" | "q">) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const query = sp.toString();
  const url = `/api/deaths/export${query ? `?${query}` : ""}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/deaths.ts
git commit -m "feat: add exportDeaths() API function"
```

---

### Task 4: Add download buttons to DeathsPage

**Files:**
- Modify: `frontend/src/pages/DeathsPage.tsx`

- [ ] **Step 1: Add exporting state and handler**

In the `DeathsPage` component, add exporting state for each grid and import `exportDeaths`. The changes are:

1. Update the import line at the top:
```typescript
import { getDeaths, getProvinces, exportDeaths } from "../api/deaths";
```

2. Add exporting state after the existing state declarations (after line 28):
```typescript
const [exportingNew, setExportingNew] = useState(false);
const [exportingScheduled, setExportingScheduled] = useState(false);
const [exportingCompleted, setExportingCompleted] = useState(false);
```

3. Add a generic export handler after `handleReset()` (after line 88):
```typescript
function handleExport(status: number, setExporting: (v: boolean) => void, label: string) {
  setExporting(true);
  exportDeaths({
    status,
    province_id: provinceId,
    start_date: startDate,
    end_date: endDate,
    q: query,
  })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `deaths_${label}_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => {})
    .finally(() => setExporting(false));
}
```

- [ ] **Step 2: Pass export props to each DeathTable**

Update the three `<DeathTable>` usages to pass `onExport` and `exporting` props:

New Deaths:
```tsx
<DeathTable
  title="New Deaths"
  deaths={newDeaths}
  page={newPage}
  pageSize={pageSize}
  onPageChange={setNewPage}
  canScheduleVa={canScheduleVa}
  actionLabel="Schedule VA"
  columns="new"
  statusColor="blue"
  exporting={exportingNew}
  onExport={() => handleExport(STATUS_NEW, setExportingNew, "new")}
/>
```

VA Scheduled Deaths:
```tsx
<DeathTable
  title="VA Scheduled Deaths"
  deaths={scheduledDeaths}
  page={scheduledPage}
  pageSize={pageSize}
  onPageChange={setScheduledPage}
  canScheduleVa={canScheduleVa}
  actionLabel="Edit"
  columns="new"
  statusColor="amber"
  exporting={exportingScheduled}
  onExport={() => handleExport(STATUS_SCHEDULED, setExportingScheduled, "scheduled")}
/>
```

Completed Deaths:
```tsx
<DeathTable
  title="Completed Deaths"
  deaths={completedDeaths}
  page={completedPage}
  pageSize={pageSize}
  onPageChange={setCompletedPage}
  canScheduleVa={canScheduleVa}
  actionLabel="View"
  columns="completed"
  statusColor="emerald"
  exporting={exportingCompleted}
  onExport={() => handleExport(STATUS_COMPLETED, setExportingCompleted, "completed")}
/>
```

- [ ] **Step 3: Update DeathTable interface and component**

Add the two new props to `DeathTableProps` interface:
```typescript
interface DeathTableProps {
  title: string;
  deaths: PaginatedResponse<Death>;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  canScheduleVa: boolean;
  actionLabel: string;
  columns: "new" | "completed";
  statusColor: keyof typeof STATUS_COLORS;
  exporting: boolean;
  onExport: () => void;
}
```

Add `exporting` and `onExport` to the destructured params of `DeathTable`:
```typescript
function DeathTable({
  title,
  deaths,
  page,
  pageSize,
  onPageChange,
  canScheduleVa,
  actionLabel,
  columns,
  statusColor,
  exporting,
  onExport,
}: DeathTableProps) {
```

Add the download button inside the section header `div`, right after the `section-count` span (matching the pregnancy-outcomes button style at `PregnancyOutcomesPage.tsx:210-219`):

```tsx
<div className="section-header">
  <div className="flex items-center gap-2">
    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[statusColor]}`}></span>
    <span className="section-title">{title}</span>
    <span className="section-count">({deaths.total})</span>
    <button
      className="btn btn-xs btn-outline btn-success ml-2"
      onClick={onExport}
      disabled={exporting}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      {exporting ? "Exporting..." : "Download Excel"}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Verify in browser**

Open http://localhost:3000/deaths. Confirm:
- Each grid section has a green "Download Excel" button next to the count
- Clicking downloads an `.xlsx` file with the correct columns
- Button shows "Exporting..." while downloading
- Filters (province, date range, search) are applied to the export

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DeathsPage.tsx
git commit -m "feat: add Excel download buttons to deaths page grids"
```

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getDeaths, getProvinces } from "../api/deaths";
import { useAuth } from "../hooks/useAuth";
import type { Death, PaginatedResponse, Province } from "../types";
import Pagination from "../components/Pagination";

const PAGE_SIZES = [10, 25, 50, 100];

// Death status integers from backend
const STATUS_NEW = 0;
const STATUS_SCHEDULED = 1;
const STATUS_COMPLETED = 2;

const STATUS_COLORS = {
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
} as const;

export default function DeathsPage() {
  const { user } = useAuth();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [newDeaths, setNewDeaths] = useState<PaginatedResponse<Death> | null>(null);
  const [scheduledDeaths, setScheduledDeaths] = useState<PaginatedResponse<Death> | null>(null);
  const [completedDeaths, setCompletedDeaths] = useState<PaginatedResponse<Death> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [provinceId, setProvinceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);

  // Pagination per section
  const [newPage, setNewPage] = useState(1);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  useEffect(() => {
    getProvinces().then(setProvinces).catch(() => {});
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError("");
    const common = {
      province_id: provinceId,
      start_date: startDate,
      end_date: endDate,
      q: query,
      page_size: pageSize,
    };
    Promise.all([
      getDeaths({ ...common, status: STATUS_NEW, page: newPage }),
      getDeaths({ ...common, status: STATUS_SCHEDULED, page: scheduledPage }),
      getDeaths({ ...common, status: STATUS_COMPLETED, page: completedPage }),
    ])
      .then(([n, s, c]) => {
        setNewDeaths(n);
        setScheduledDeaths(s);
        setCompletedDeaths(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [provinceId, startDate, endDate, query, pageSize, newPage, scheduledPage, completedPage]);

  useEffect(fetchAll, [fetchAll]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setNewPage(1);
    setScheduledPage(1);
    setCompletedPage(1);
  }

  function handleReset() {
    setProvinceId("");
    setStartDate("");
    setEndDate("");
    setQuery("");
    setPageSize(25);
    setNewPage(1);
    setScheduledPage(1);
    setCompletedPage(1);
  }

  const canScheduleVa = user?.permissions.can_schedule_va ?? false;

  if (loading && !newDeaths) {
    return (
      <div className="flex justify-center py-10">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="py-6 animate-fade-in">
      <h1 className="text-2xl font-bold mb-5 text-slate-800">Death Management</h1>

      {/* Filters */}
      <div className="glass-card p-5 mb-6">
        <form onSubmit={handleSearch}>
          <div className="columns-sm">
            <div className="form-row">
              <label className="form-label w-20" htmlFor="province">
                Province:
              </label>
              <div className="form-input-wrapper">
                <select
                  id="province"
                  className="select select-bordered form-input"
                  value={provinceId}
                  onChange={(e) => {
                    setProvinceId(e.target.value);
                    setNewPage(1);
                    setScheduledPage(1);
                    setCompletedPage(1);
                  }}
                >
                  <option value="">All Provinces</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label className="form-label w-32" htmlFor="start_date">
                Date of Death:
              </label>
              <div className="form-input-wrapper">
                <input
                  type="date"
                  id="start_date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label w-10" htmlFor="end_date">
                to:
              </label>
              <div className="form-input-wrapper">
                <input
                  type="date"
                  id="end_date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="py-4">
            <input
              type="text"
              className="form-input"
              placeholder="DEATH ID OR WORK AREA"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label className="form-label w-32" htmlFor="paging_size">
              Results Count:
            </label>
            <div className="form-input-wrapper">
              <select
                id="paging_size"
                className="select select-bordered form-input w-20"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setNewPage(1);
                  setScheduledPage(1);
                  setCompletedPage(1);
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button type="submit" className="btn btn-sm btn-primary">
              Search
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* New Deaths */}
      {newDeaths && (
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
        />
      )}

      {/* VA Scheduled Deaths */}
      {scheduledDeaths && (
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
        />
      )}

      {/* Completed Deaths */}
      {completedDeaths && (
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
        />
      )}
    </div>
  );
}

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
}

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
}: DeathTableProps) {
  return (
    <div className="section-card animate-slide-up">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[statusColor]}`}></span>
          <span className="section-title">{title}</span>
          <span className="section-count">({deaths.total})</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-enhanced w-full">
          <thead>
            <tr>
              <th>Death ID</th>
              <th>Work Area/District</th>
              <th>Cluster/Worker</th>
              <th>Deceased Name</th>
              <th>Date of Death</th>
              <th>Household ID</th>
              {columns === "new" ? (
                <>
                  <th>HH Head Name</th>
                  <th>Respondent</th>
                  <th>VA Date Requested</th>
                  <th>Submission Date</th>
                </>
              ) : (
                <>
                  <th>VA Interviewer</th>
                  <th>VA Date</th>
                  <th>VA Submitted</th>
                </>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deaths.items.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs">{d.death_code}</td>
                <td>{d.area_code}</td>
                <td>
                  {d.cluster_code} / {d.worker_name}
                </td>
                <td className="font-medium">{d.deceased_name}</td>
                <td>{d.deceased_dod}</td>
                <td className="font-mono text-xs">{d.household_code}</td>
                {columns === "new" ? (
                  <>
                    <td>{d.household_head_name}</td>
                    <td>{d.respondent_name}</td>
                    <td>{d.va_proposed_date}</td>
                    <td>{d.submission_date}</td>
                  </>
                ) : (
                  <>
                    <td>{d.va_staff_name}</td>
                    <td>{d.va_scheduled_date}</td>
                    <td>{d.va_completed_date}</td>
                  </>
                )}
                <td>
                  {canScheduleVa && (
                    <Link
                      to={`/deaths/${d.id}`}
                      className="btn btn-ghost btn-xs text-primary hover:bg-primary/10"
                    >
                      {actionLabel}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2">
        <Pagination
          page={page}
          total={deaths.total}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}

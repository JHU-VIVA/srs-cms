import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getHouseholds } from "../api/households";
import { getProvinces } from "../api/deaths";
import type { Household, PaginatedResponse, Province } from "../types";
import Pagination from "../components/Pagination";

const PAGE_SIZES = [2, 10, 25, 50, 100];

export default function HouseholdsPage() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [data, setData] = useState<PaginatedResponse<Household> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [provinceId, setProvinceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    getProvinces().then(setProvinces).catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    getHouseholds({
      province_id: provinceId,
      start_date: startDate,
      end_date: endDate,
      q: query,
      page,
      page_size: pageSize,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [provinceId, startDate, endDate, query, pageSize, page]);

  useEffect(fetchData, [fetchData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function handleReset() {
    setProvinceId("");
    setStartDate("");
    setEndDate("");
    setQuery("");
    setPageSize(25);
    setPage(1);
  }

  if (loading && !data) {
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
      <h1 className="text-2xl font-bold mb-5 text-slate-800">Households</h1>

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
                    setPage(1);
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
                Interview Date:
              </label>
              <div className="form-input-wrapper flex items-center gap-2">
                <input
                  type="date"
                  id="start_date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-sm text-slate-500">to</span>
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
              placeholder="CLUSTER CODE OR HOUSEHOLD ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label className="form-label w-32" htmlFor="paging_size">
              Page Size:
            </label>
            <div className="form-input-wrapper">
              <select
                id="paging_size"
                className="select select-bordered form-input w-20"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
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

      {/* Results table */}
      {data && (
        <div className="section-card animate-slide-up">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="section-title">Households</span>
              <span className="section-count">({data.total})</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-enhanced w-full">
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th>Work Area</th>
                  <th>Interview Date</th>
                  <th>Household ID</th>
                  <th>Address Info</th>
                  <th>Members</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((h) => (
                  <tr key={h.id}>
                    <td className="font-mono text-xs">{h.cluster_code}</td>
                    <td>{h.area_code}</td>
                    <td>{h.interview_date}</td>
                    <td className="font-mono text-xs">{h.household_code}</td>
                    <td>{h.household_address}</td>
                    <td>{h.rep_member_count}</td>
                    <td>
                      <Link
                        to={`/households/${h.id}`}
                        className="btn btn-ghost btn-xs text-primary hover:bg-primary/10"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2">
            <Pagination
              page={page}
              total={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

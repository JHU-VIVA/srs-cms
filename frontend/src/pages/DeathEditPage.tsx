import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDeath, updateDeath, getStaff } from "../api/deaths";
import type { Death, Staff } from "../types";

export default function DeathEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [death, setDeath] = useState<Death | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Editable fields
  const [vaScheduledDate, setVaScheduledDate] = useState("");
  const [vaStaffId, setVaStaffId] = useState("");
  const [comment, setComment] = useState("");

  const isCompleted = death?.death_status === 2;

  useEffect(() => {
    if (!id) return;
    getDeath(Number(id))
      .then(async (d) => {
        setDeath(d);
        setVaScheduledDate(d.va_scheduled_date ?? "");
        setVaStaffId(d.va_staff_id != null ? String(d.va_staff_id) : "");
        setComment(d.comment ?? "");
        const s = await getStaff(d.province_id ?? undefined, "VA");
        setStaffList(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      await updateDeath(Number(id), {
        va_scheduled_date: vaScheduledDate || null,
        va_staff_id: vaStaffId ? Number(vaStaffId) : null,
        comment: comment || null,
      });
      navigate("/deaths");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-4">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!death) return null;

  return (
    <div className="container mx-auto py-4">
      <h1 className="text-2xl font-bold mb-5">
        Death Management - {isCompleted ? "View" : "Edit"}
      </h1>

      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        {/* Read-only fields */}
        <div className="form-row">
          <label className="form-label">Death Code:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={death.death_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Deceased Name:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={death.deceased_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Date of Death:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={death.deceased_dod ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Household:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={death.household_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">VA Proposed Date:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={death.va_proposed_date ?? ""} readOnly />
          </div>
        </div>

        {/* Editable fields */}
        <div className="form-row">
          <label className="form-label" htmlFor="va_scheduled_date">VA Scheduled Date:</label>
          <div className="form-input-wrapper">
            <input
              type="date"
              id="va_scheduled_date"
              className="form-input"
              value={vaScheduledDate}
              readOnly={isCompleted}
              onChange={(e) => setVaScheduledDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label" htmlFor="va_staff_id">VA Staff:</label>
          <div className="form-input-wrapper">
            <select
              id="va_staff_id"
              className="select select-bordered form-input"
              value={vaStaffId}
              disabled={isCompleted}
              onChange={(e) => setVaStaffId(e.target.value)}
            >
              <option value="">---------</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label" htmlFor="comment">Comment:</label>
          <div className="form-input-wrapper">
            <input
              type="text"
              id="comment"
              className="form-input"
              value={comment}
              readOnly={isCompleted}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4 space-x-2">
          {isCompleted ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/deaths")}
            >
              Back
            </button>
          ) : (
            <>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (confirm("Discard changes?")) navigate("/deaths");
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

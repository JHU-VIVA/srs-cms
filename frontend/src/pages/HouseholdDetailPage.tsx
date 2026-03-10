import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getHousehold } from "../api/households";
import type { Household } from "../types";

export default function HouseholdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getHousehold(Number(id))
      .then(setRecord)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
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

  if (!record) return null;

  return (
    <div className="py-6 animate-fade-in">
      <h1 className="text-2xl font-bold mb-5 text-slate-800">
        Household - View
      </h1>

      <div className="glass-card-solid p-6 max-w-lg">
        <div className="form-row">
          <label className="form-label">Cluster:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.cluster_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Work Area:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.area_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Interview Date:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.interview_date ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Household ID:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.household_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Address Info:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.household_address ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Members Count:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.rep_member_count ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">HH Head Name:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.household_head_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">HH Phone:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.head_phone ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Respondent:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.respondent_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Submission Date:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.submission_date ?? ""} readOnly />
          </div>
        </div>

        {/* Household Members */}
        {record.members.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-3">Household Members</h2>
            <div className="overflow-x-auto">
              <table className="table-enhanced w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sex</th>
                    <th>Age</th>
                    <th>Relation to Head</th>
                  </tr>
                </thead>
                <tbody>
                  {record.members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.full_name ?? "-"}</td>
                      <td>{m.sex === 1 ? "Male" : m.sex === 2 ? "Female" : "-"}</td>
                      <td>{m.age_in_years ?? "-"}</td>
                      <td>{m.rel_head_label ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/households")}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPregnancyOutcome } from "../api/pregnancyOutcomes";
import type { PregnancyOutcome } from "../types";

export default function PregnancyOutcomeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PregnancyOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getPregnancyOutcome(Number(id))
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

  const isMultiple = record.birth_multi != null && record.birth_multi > 0;

  return (
    <div className="py-6 animate-fade-in">
      <h1 className="text-2xl font-bold mb-5 text-slate-800">
        Pregnancy Outcome - View
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
          <label className="form-label">Outcome Date:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.preg_outcome_date ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Mother Name:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.mother_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Mother Age:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.mother_age_years ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Birth Outcome:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.birth_sing_outcome_label ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Multiple Birth:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={isMultiple ? "Yes" : "No"} readOnly />
          </div>
        </div>

        {isMultiple && (
          <>
            <div className="form-row">
              <label className="form-label">Born Alive:</label>
              <div className="form-input-wrapper">
                <input type="text" className="form-input" value={record.birth_multi_alive ?? ""} readOnly />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Stillbirths:</label>
              <div className="form-input-wrapper">
                <input type="text" className="form-input" value={record.birth_multi_still ?? ""} readOnly />
              </div>
            </div>
          </>
        )}

        <div className="form-row">
          <label className="form-label">Household:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.household_code ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">HH Head Name:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.household_head_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Respondent:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.respondent_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Worker:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.worker_name ?? ""} readOnly />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Submission Date:</label>
          <div className="form-input-wrapper">
            <input type="text" className="form-input" value={record.submission_date ?? ""} readOnly />
          </div>
        </div>

        {/* Baby records */}
        {record.babies.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-3">Baby Records</h2>
            <div className="overflow-x-auto">
              <table className="table-enhanced w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sex</th>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {record.babies.map((b) => (
                    <tr key={b.id}>
                      <td>{b.name ?? "-"}</td>
                      <td>{b.sex === 1 ? "Male" : b.sex === 2 ? "Female" : "-"}</td>
                      <td>{b.preg_outcome_date ?? "-"}</td>
                      <td>{b.weight != null ? `${b.weight} g` : "-"}</td>
                      <td>{b.is_birth_registered == null ? "-" : b.is_birth_registered ? "Yes" : "No"}</td>
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
            onClick={() => navigate("/pregnancy-outcomes")}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

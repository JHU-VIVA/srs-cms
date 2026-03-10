import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getDashboardStats } from "../api/dashboard";
import { getProvinces } from "../api/deaths";
import type { DashboardStat, Province } from "../types";

const METRICS: Record<string, string> = {
  households_total: "Households",
  household_members_total: "Household Members",
  pregnancy_outcomes_total: "Pregnancy Outcomes",
  deaths_total: "Deaths",
  babies_total: "Babies",
  verbal_autopsies_total: "Verbal Autopsies",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getProvinces()])
      .then(([s, p]) => {
        setStats(s);
        setProvinces(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const provinceMap = new Map(provinces.map((p) => [p.id, p.name]));

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(METRICS).map(([metric, label]) => {
          const metricStats = stats.filter((s) => s.metric === metric);
          const total =
            metricStats.find((s) => s.province_id === null)?.count ?? 0;
          const chartData = metricStats
            .filter((s) => s.province_id !== null)
            .map((s) => ({
              name: provinceMap.get(s.province_id!) ?? `Province ${s.province_id}`,
              count: s.count,
            }))
            .sort((a, b) => b.count - a.count);

          return (
            <div key={metric} className="glass-card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-700">
                  {label}
                </h2>
                <span className="text-2xl font-bold text-primary">
                  {total.toLocaleString()}
                </span>
              </div>
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={chartData.length * 40 + 20}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        value.toLocaleString(),
                        "Count",
                      ]}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

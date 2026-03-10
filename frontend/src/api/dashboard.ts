import { get } from "./client";
import type { DashboardStat } from "../types";

export function getDashboardStats() {
  return get<DashboardStat[]>("/dashboard-stats");
}

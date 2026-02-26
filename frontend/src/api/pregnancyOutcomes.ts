import { get } from "./client";
import type { PregnancyOutcome, PaginatedResponse } from "../types";

interface PregnancyOutcomesParams {
  province_id?: string;
  start_date?: string;
  end_date?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function toQuery(params: PregnancyOutcomesParams): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export function getPregnancyOutcomes(params: PregnancyOutcomesParams) {
  return get<PaginatedResponse<PregnancyOutcome>>(`/pregnancy-outcomes${toQuery(params)}`);
}

export function getPregnancyOutcome(id: number) {
  return get<PregnancyOutcome>(`/pregnancy-outcomes/${id}`);
}

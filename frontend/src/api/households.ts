import { get } from "./client";
import type { Household, PaginatedResponse } from "../types";

interface HouseholdsParams {
  province_id?: string;
  start_date?: string;
  end_date?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function toQuery(params: HouseholdsParams): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export function getHouseholds(params: HouseholdsParams) {
  return get<PaginatedResponse<Household>>(`/households${toQuery(params)}`);
}

export function getHousehold(id: number) {
  return get<Household>(`/households/${id}`);
}

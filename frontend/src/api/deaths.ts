import { get, put } from "./client";
import type { Death, PaginatedResponse, Province, Staff } from "../types";

interface DeathsParams {
  status?: number;
  province_id?: string;
  start_date?: string;
  end_date?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function toQuery(params: DeathsParams): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export function getDeaths(params: DeathsParams) {
  return get<PaginatedResponse<Death>>(`/deaths${toQuery(params)}`);
}

export function getDeath(id: number) {
  return get<Death>(`/deaths/${id}`);
}

export interface DeathUpdateData {
  va_scheduled_date?: string | null;
  va_staff_id?: number | null;
  comment?: string | null;
}

export function updateDeath(id: number, data: DeathUpdateData) {
  return put<{ success: boolean; message: string }>(`/deaths/${id}`, data);
}

export function getProvinces() {
  return get<Province[]>("/provinces");
}

export function getStaff(provinceId?: number, staffType?: string) {
  const sp = new URLSearchParams();
  if (provinceId) sp.set("province_id", String(provinceId));
  if (staffType) sp.set("staff_type", staffType);
  const str = sp.toString();
  return get<Staff[]>(`/staff${str ? `?${str}` : ""}`);
}

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

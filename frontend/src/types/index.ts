export interface UserPermissions {
  can_schedule_va: boolean;
  can_view_all_provinces: boolean;
}

export interface User {
  is_authenticated: boolean;
  username: string;
  email: string;
  permissions: UserPermissions;
}

export interface Province {
  id: number;
  code: string;
  name: string;
}

export interface Staff {
  id: number;
  code: string | null;
  full_name: string | null;
  staff_type: string;
}

export interface Death {
  id: number;
  death_code: string | null;
  death_status: number | null;
  death_status_label: string | null;
  deceased_name: string | null;
  deceased_sex: number | null;
  deceased_dob: string | null;
  deceased_dod: string | null;
  deceased_age: number | null;
  va_proposed_date: string | null;
  va_scheduled_date: string | null;
  va_completed_date: string | null;
  va_staff_id: number | null;
  va_staff_code: string | null;
  va_staff_name: string | null;
  comment: string | null;
  province_id: number | null;
  cluster_code: string | null;
  area_code: string | null;
  household_code: string | null;
  staff_code: string | null;
  worker_name: string | null;
  household_head_name: string | null;
  respondent_name: string | null;
  submission_date: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  num_pages: number;
}

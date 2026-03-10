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

export interface Baby {
  id: number;
  name: string | null;
  sex: number | null;
  preg_outcome_date: string | null;
  weight: number | null;
  is_birth_registered: boolean | null;
}

export interface HouseholdMember {
  id: number;
  full_name: string | null;
  sex: number | null;
  age_in_years: number | null;
  rel_head: number | null;
  rel_head_label: string | null;
}

export interface Household {
  id: number;
  cluster_code: string | null;
  area_code: string | null;
  interview_date: string | null;
  household_code: string | null;
  household_address: string | null;
  rep_member_count: string | null;
  household_head_name: string | null;
  respondent_name: string | null;
  head_phone: string | null;
  submission_date: string | null;
  province_id: number | null;
  members: HouseholdMember[];
}

export interface DashboardStat {
  metric: string;
  province_id: number | null;
  count: number;
}

export interface PregnancyOutcome {
  id: number;
  cluster_code: string | null;
  area_code: string | null;
  preg_outcome_date: string | null;
  mother_name: string | null;
  mother_age_years: number | null;
  birth_sing_outcome: number | null;
  birth_sing_outcome_label: string | null;
  birth_multi: number | null;
  birth_multi_alive: number | null;
  birth_multi_still: number | null;
  household_code: string | null;
  household_head_name: string | null;
  head_phone: string | null;
  respondent_name: string | null;
  staff_code: string | null;
  worker_name: string | null;
  submission_date: string | null;
  province_id: number | null;
  babies: Baby[];
}

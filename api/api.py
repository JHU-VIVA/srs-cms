from ninja import NinjaAPI, Schema
from ninja.security import django_auth
from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.contrib.postgres.search import TrigramSimilarity
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import F, Q, Value
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date
from typing import Optional
from datetime import date
from io import BytesIO
import openpyxl

from api.models import Death, Event, Province, Staff
from api.models.households import Household, HouseholdMember
from api.common import Permissions

api = NinjaAPI(csrf=True)


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class AuthSchema(Schema):
    username: str
    password: str


class DeathOut(Schema):
    id: int
    death_code: Optional[str] = None
    death_status: Optional[int] = None
    death_status_label: Optional[str] = None
    deceased_name: Optional[str] = None
    deceased_sex: Optional[int] = None
    deceased_dob: Optional[date] = None
    deceased_dod: Optional[date] = None
    deceased_age: Optional[int] = None
    va_proposed_date: Optional[date] = None
    va_scheduled_date: Optional[date] = None
    va_completed_date: Optional[date] = None
    va_staff_id: Optional[int] = None
    va_staff_code: Optional[str] = None
    va_staff_name: Optional[str] = None
    comment: Optional[str] = None
    # From related event
    province_id: Optional[int] = None
    cluster_code: Optional[str] = None
    area_code: Optional[str] = None
    household_code: Optional[str] = None
    staff_code: Optional[str] = None
    worker_name: Optional[str] = None
    household_head_name: Optional[str] = None
    respondent_name: Optional[str] = None
    submission_date: Optional[date] = None

    @staticmethod
    def from_death(death):
        event = death.event
        va_staff = death.va_staff
        event_staff = event.event_staff
        return DeathOut(
            id=death.id,
            death_code=death.death_code,
            death_status=death.death_status,
            death_status_label=Death.DeathStatus(death.death_status).label if death.death_status is not None else None,
            deceased_name=death.deceased_name,
            deceased_sex=death.deceased_sex,
            deceased_dob=death.deceased_dob,
            deceased_dod=death.deceased_dod,
            deceased_age=death.deceased_age,
            va_proposed_date=death.va_proposed_date,
            va_scheduled_date=death.va_scheduled_date,
            va_completed_date=death.va_completed_date,
            va_staff_id=death.va_staff_id,
            va_staff_code=va_staff.code if va_staff else death.va_staff_code,
            va_staff_name=va_staff.full_name if va_staff else None,
            comment=death.comment,
            province_id=event.cluster.province_id if event.cluster else None,
            cluster_code=event.cluster_code,
            area_code=event.area_code,
            household_code=event.household_code,
            staff_code=event.staff_code,
            worker_name=event_staff.full_name if event_staff else None,
            household_head_name=event.household_head_name,
            respondent_name=event.respondent_name,
            submission_date=event.submission_date,
        )


class DeathUpdateSchema(Schema):
    va_scheduled_date: Optional[date] = None
    va_staff_id: Optional[int] = None
    comment: Optional[str] = None


class ProvinceOut(Schema):
    id: int
    code: str
    name: str


class StaffOut(Schema):
    id: int
    code: Optional[str] = None
    full_name: Optional[str] = None
    staff_type: str


class PaginatedDeathsOut(Schema):
    items: list[DeathOut]
    total: int
    page: int
    page_size: int
    num_pages: int


class BabyOut(Schema):
    id: int
    name: Optional[str] = None
    sex: Optional[int] = None
    preg_outcome_date: Optional[date] = None
    weight: Optional[float] = None
    is_birth_registered: Optional[bool] = None


class PregnancyOutcomeOut(Schema):
    id: int
    cluster_code: Optional[str] = None
    area_code: Optional[str] = None
    preg_outcome_date: Optional[date] = None
    mother_name: Optional[str] = None
    mother_age_years: Optional[int] = None
    birth_sing_outcome: Optional[int] = None
    birth_sing_outcome_label: Optional[str] = None
    birth_multi: Optional[int] = None
    birth_multi_alive: Optional[int] = None
    birth_multi_still: Optional[int] = None
    household_code: Optional[str] = None
    household_head_name: Optional[str] = None
    head_phone: Optional[str] = None
    respondent_name: Optional[str] = None
    staff_code: Optional[str] = None
    worker_name: Optional[str] = None
    submission_date: Optional[date] = None
    province_id: Optional[int] = None
    babies: list[BabyOut] = []

    @staticmethod
    def from_event(event):
        event_staff = event.event_staff
        return PregnancyOutcomeOut(
            id=event.id,
            cluster_code=event.cluster_code,
            area_code=event.area_code,
            preg_outcome_date=event.preg_outcome_date,
            mother_name=event.mother_name,
            mother_age_years=event.mother_age_years,
            birth_sing_outcome=event.birth_sing_outcome,
            birth_sing_outcome_label=Event.BirthOutcomeType(event.birth_sing_outcome).label if event.birth_sing_outcome is not None else None,
            birth_multi=event.birth_multi,
            birth_multi_alive=event.birth_multi_alive,
            birth_multi_still=event.birth_multi_still,
            household_code=event.household_code,
            household_head_name=event.household_head_name,
            head_phone=event.head_phone,
            respondent_name=event.respondent_name,
            staff_code=event.staff_code,
            worker_name=event_staff.full_name if event_staff else None,
            submission_date=event.submission_date,
            province_id=event.cluster.province_id if event.cluster else None,
            babies=[
                BabyOut(
                    id=b.id,
                    name=b.name,
                    sex=b.sex,
                    preg_outcome_date=b.preg_outcome_date,
                    weight=b.weight,
                    is_birth_registered=b.is_birth_registered,
                )
                for b in event.babies.all()
            ],
        )


class PaginatedPregnancyOutcomesOut(Schema):
    items: list[PregnancyOutcomeOut]
    total: int
    page: int
    page_size: int
    num_pages: int


class HouseholdMemberOut(Schema):
    id: int
    full_name: Optional[str] = None
    sex: Optional[int] = None
    age_in_years: Optional[int] = None
    rel_head: Optional[int] = None
    rel_head_label: Optional[str] = None


class HouseholdOut(Schema):
    id: int
    cluster_code: Optional[str] = None
    area_code: Optional[str] = None
    interview_date: Optional[date] = None
    household_code: Optional[str] = None
    household_address: Optional[str] = None
    rep_member_count: Optional[str] = None
    household_head_name: Optional[str] = None
    respondent_name: Optional[str] = None
    head_phone: Optional[str] = None
    submission_date: Optional[date] = None
    province_id: Optional[int] = None
    members: list[HouseholdMemberOut] = []

    @staticmethod
    def from_household(h):
        return HouseholdOut(
            id=h.id,
            cluster_code=h.cluster_code,
            area_code=h.area_code,
            interview_date=h.interview_date,
            household_code=h.household_code,
            household_address=h.household_address,
            rep_member_count=h.rep_member_count,
            household_head_name=h.household_head_name,
            respondent_name=h.respondent_name,
            head_phone=h.head_phone,
            submission_date=h.submission_date,
            province_id=h.cluster.province_id if h.cluster else None,
            members=[
                HouseholdMemberOut(
                    id=m.id,
                    full_name=m.full_name,
                    sex=m.sex,
                    age_in_years=m.age_in_years,
                    rel_head=m.rel_head,
                    rel_head_label=HouseholdMember.RelationHeadType(m.rel_head).label if m.rel_head is not None else None,
                )
                for m in h.household_members.all()
            ],
        )


class PaginatedHouseholdsOut(Schema):
    items: list[HouseholdOut]
    total: int
    page: int
    page_size: int
    num_pages: int


class DashboardStatOut(Schema):
    metric: str
    province_id: Optional[int] = None
    count: int


# ──────────────────────────────────────────────
# Auth endpoints
# ──────────────────────────────────────────────

@api.post("/auth/login")
def login_view(request, payload: AuthSchema):
    user = authenticate(request, username=payload.username, password=payload.password)
    if user is not None:
        login(request, user)
        return {"success": True, "message": "Logged in successfully."}
    else:
        return {"success": False, "message": "Invalid credentials."}


@api.post("/auth/logout")
def logout_view(request):
    logout(request)
    return {"success": True, "message": "Logged out successfully."}


@api.get("/auth/user")
def get_user(request):
    get_token(request)  # Ensure CSRF cookie is set
    if request.user.is_authenticated:
        permissions = {
            "can_schedule_va": Permissions.has_permission(request.user, Permissions.Codes.SCHEDULE_VA),
            "can_view_all_provinces": Permissions.has_permission(request.user, Permissions.Codes.VIEW_ALL_PROVINCES),
        }
        return {
            "is_authenticated": True,
            "username": request.user.username,
            "email": request.user.email,
            "permissions": permissions,
        }
    else:
        return {"is_authenticated": False}


# ──────────────────────────────────────────────
# Province endpoints
# ──────────────────────────────────────────────

@api.get("/provinces", auth=django_auth, response=list[ProvinceOut])
def list_provinces(request):
    return Province.objects.for_user(request.user).order_by('name')


# ──────────────────────────────────────────────
# Staff endpoints
# ──────────────────────────────────────────────

@api.get("/staff", auth=django_auth, response=list[StaffOut])
def list_staff(request, province_id: Optional[int] = None, staff_type: Optional[str] = None):
    qs = Staff.objects.all()
    if province_id:
        qs = qs.filter(province_id=province_id)
    if staff_type:
        qs = qs.filter(staff_type=staff_type)
    return qs.order_by('full_name')


# ──────────────────────────────────────────────
# Death endpoints
# ──────────────────────────────────────────────

@api.get("/deaths", auth=django_auth, response=PaginatedDeathsOut)
def list_deaths(
    request,
    status: Optional[int] = None,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    qs = Death.objects.select_related('event', 'event__cluster', 'event__area', 'event__event_staff', 'va_staff')

    if status is not None:
        qs = qs.filter(death_status=status)

    if province_id:
        qs = qs.filter(event__cluster__province_id=province_id)

    if start_date and end_date:
        qs = qs.filter(deceased_dod__gte=parse_date(start_date), deceased_dod__lte=parse_date(end_date))
    elif start_date:
        qs = qs.filter(deceased_dod__gte=parse_date(start_date))
    elif end_date:
        qs = qs.filter(deceased_dod__lte=parse_date(end_date))

    # Partial match search on death code or work area/district
    if q and q.strip():
        query = q.strip()
        qs = qs.filter(
            Q(death_code__icontains=query) |
            Q(event__area__code__icontains=query)
        )

    qs = qs.order_by('-id')

    paginator = Paginator(qs, page_size)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    return PaginatedDeathsOut(
        items=[DeathOut.from_death(d) for d in page_obj.object_list],
        total=paginator.count,
        page=page_obj.number,
        page_size=page_size,
        num_pages=paginator.num_pages,
    )


@api.get("/deaths/{death_id}", auth=django_auth, response=DeathOut)
def get_death(request, death_id: int):
    death = Death.objects.select_related(
        'event', 'event__cluster', 'event__area', 'event__event_staff', 'va_staff'
    ).get(id=death_id)
    return DeathOut.from_death(death)


@api.put("/deaths/{death_id}", auth=django_auth)
def update_death(request, death_id: int, payload: DeathUpdateSchema):
    death = Death.objects.select_related('event').get(id=death_id)

    if death.death_status == Death.DeathStatus.VA_COMPLETED:
        return api.create_response(request, {"success": False, "message": "Cannot edit a completed VA."}, status=400)

    if payload.va_scheduled_date is not None:
        death.va_scheduled_date = payload.va_scheduled_date
    if payload.va_staff_id is not None:
        death.va_staff_id = payload.va_staff_id
    if payload.comment is not None:
        death.comment = payload.comment

    if death.death_status != Death.DeathStatus.VA_SCHEDULED:
        death.death_status = Death.DeathStatus.VA_SCHEDULED

    death.save()
    return {"success": True, "message": "Death record updated."}


# ──────────────────────────────────────────────
# Pregnancy Outcome endpoints
# ──────────────────────────────────────────────

def _filter_pregnancy_outcomes(province_id=None, start_date=None, end_date=None, q=None):
    qs = Event.objects.filter(
        event_type=Event.EventType.PREGNANCY_OUTCOME
    ).select_related(
        'cluster', 'area', 'event_staff'
    ).prefetch_related('babies')

    if province_id:
        qs = qs.filter(cluster__province_id=province_id)

    if start_date and end_date:
        qs = qs.filter(preg_outcome_date__gte=parse_date(start_date), preg_outcome_date__lte=parse_date(end_date))
    elif start_date:
        qs = qs.filter(preg_outcome_date__gte=parse_date(start_date))
    elif end_date:
        qs = qs.filter(preg_outcome_date__lte=parse_date(end_date))

    if q and q.strip():
        query = q.strip()
        qs = qs.filter(
            Q(cluster_code__icontains=query) |
            Q(mother_name__icontains=query)
        )

    return qs.order_by('-id')


@api.get("/pregnancy-outcomes", auth=django_auth, response=PaginatedPregnancyOutcomesOut)
def list_pregnancy_outcomes(
    request,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    qs = _filter_pregnancy_outcomes(province_id, start_date, end_date, q)

    paginator = Paginator(qs, page_size)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    return PaginatedPregnancyOutcomesOut(
        items=[PregnancyOutcomeOut.from_event(e) for e in page_obj.object_list],
        total=paginator.count,
        page=page_obj.number,
        page_size=page_size,
        num_pages=paginator.num_pages,
    )


@api.get("/pregnancy-outcomes/export", auth=django_auth)
def export_pregnancy_outcomes(
    request,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
):
    qs = _filter_pregnancy_outcomes(province_id, start_date, end_date, q)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pregnancy Outcomes"
    ws.append(["Key", "Cluster Code", "Work Area", "Outcome Date", "Mother Name", "Baby Count", "Outcome Type"])

    ws_babies = wb.create_sheet("Babies")
    ws_babies.append(["Key", "Name", "Sex", "Outcome Date", "Weight", "Registered"])

    sex_map = {1: "Male", 2: "Female"}

    for event in qs:
        outcome_label = Event.BirthOutcomeType(event.birth_sing_outcome).label if event.birth_sing_outcome is not None else ""
        baby_count = event.babies.count()
        ws.append([
            event.id,
            event.cluster_code or "",
            event.area_code or "",
            str(event.preg_outcome_date) if event.preg_outcome_date else "",
            event.mother_name or "",
            baby_count,
            outcome_label,
        ])
        for baby in event.babies.all():
            ws_babies.append([
                event.id,
                baby.name or "",
                sex_map.get(baby.sex, ""),
                str(baby.preg_outcome_date) if baby.preg_outcome_date else "",
                baby.weight if baby.weight is not None else "",
                "Yes" if baby.is_birth_registered else "No" if baby.is_birth_registered is not None else "",
            ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = HttpResponse(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    today = date.today().strftime("%Y-%m-%d")
    response["Content-Disposition"] = f'attachment; filename="pregnancy_outcomes_{today}.xlsx"'
    return response


@api.get("/pregnancy-outcomes/{event_id}", auth=django_auth, response=PregnancyOutcomeOut)
def get_pregnancy_outcome(request, event_id: int):
    event = Event.objects.filter(
        event_type=Event.EventType.PREGNANCY_OUTCOME
    ).select_related(
        'cluster', 'area', 'event_staff'
    ).prefetch_related('babies').get(id=event_id)
    return PregnancyOutcomeOut.from_event(event)


# ──────────────────────────────────────────────
# Household endpoints
# ──────────────────────────────────────────────

@api.get("/households", auth=django_auth, response=PaginatedHouseholdsOut)
def list_households(
    request,
    province_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
):
    qs = Household.objects.select_related(
        'cluster', 'area', 'event_staff'
    ).prefetch_related('household_members')

    if province_id:
        qs = qs.filter(cluster__province_id=province_id)

    if start_date and end_date:
        qs = qs.filter(interview_date__gte=parse_date(start_date), interview_date__lte=parse_date(end_date))
    elif start_date:
        qs = qs.filter(interview_date__gte=parse_date(start_date))
    elif end_date:
        qs = qs.filter(interview_date__lte=parse_date(end_date))

    if q and q.strip():
        query = q.strip()
        qs = qs.filter(
            Q(household_code__icontains=query) |
            Q(cluster_code__icontains=query)
        )

    qs = qs.order_by('-id')

    paginator = Paginator(qs, page_size)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    return PaginatedHouseholdsOut(
        items=[HouseholdOut.from_household(h) for h in page_obj.object_list],
        total=paginator.count,
        page=page_obj.number,
        page_size=page_size,
        num_pages=paginator.num_pages,
    )


@api.get("/households/{household_id}", auth=django_auth, response=HouseholdOut)
def get_household(request, household_id: int):
    h = Household.objects.select_related(
        'cluster', 'area', 'event_staff'
    ).prefetch_related('household_members').get(id=household_id)
    return HouseholdOut.from_household(h)


# ──────────────────────────────────────────────
# Dashboard endpoints
# ──────────────────────────────────────────────

@api.get("/dashboard-stats", auth=django_auth, response=list[DashboardStatOut])
def get_dashboard_stats(request):
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT metric, province_id, count FROM dashboard_stats")
        rows = cursor.fetchall()
    return [{"metric": r[0], "province_id": r[1], "count": r[2]} for r in rows]

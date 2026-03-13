"""
Tests for Django data migrations.

Covers migration 0002_dashboard_stats_view:
- Materialized view dashboard_stats existence and correctness
- Custom indexes on events table
- Migration reversibility
"""
import pytest
from django.db import connection
from django.core.management import call_command
from api.models import (
    DashboardStat, Province, Event, Death, Baby,
    Household, HouseholdMember, VerbalAutopsy,
)
from tests.factories.factories import (
    ProvinceFactory, ClusterFactory, AreaFactory, StaffFactory,
    EventFactory, DeathFactory,
)


@pytest.fixture
def refresh_dashboard_stats():
    """Refresh the dashboard_stats materialized view."""
    def _refresh():
        with connection.cursor() as cursor:
            cursor.execute("REFRESH MATERIALIZED VIEW dashboard_stats")
    return _refresh


def _view_exists():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM pg_matviews WHERE matviewname = 'dashboard_stats'"
        )
        return cursor.fetchone()[0] > 0


def _index_exists(index_name):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM pg_indexes WHERE indexname = %s",
            [index_name]
        )
        return cursor.fetchone()[0] > 0


@pytest.mark.django_db
def test_dashboard_stats_view_exists():
    assert _view_exists(), "dashboard_stats materialized view does not exist"


@pytest.mark.django_db
def test_dashboard_stats_view_returns_correct_metrics(refresh_dashboard_stats):
    province = ProvinceFactory()
    cluster = ClusterFactory(province=province)
    area = AreaFactory(cluster=cluster)
    staff = StaffFactory(cluster=cluster, province=province)

    EventFactory.create_batch(2, cluster=cluster, area=area, event_staff=staff,
                              event_type=Event.EventType.PREGNANCY_OUTCOME)
    death_event = EventFactory(cluster=cluster, area=area, event_staff=staff,
                               event_type=Event.EventType.DEATH)
    DeathFactory(event=death_event)
    hh = Household.objects.create(
        key='test-hh-1', cluster=cluster, area=area, event_staff=staff,
        form_version='1',
    )
    HouseholdMember.objects.create(
        key='test-hm-1', household=hh,
    )
    baby_event = EventFactory(cluster=cluster, area=area, event_staff=staff,
                              event_type=Event.EventType.PREGNANCY_OUTCOME)
    Baby.objects.create(key='test-baby-1', event=baby_event)
    VerbalAutopsy.objects.create(
        key='test-va-1', cluster=cluster, area=area,
        form_version='1',
    )

    refresh_dashboard_stats()

    stats = {s.metric: s.count for s in DashboardStat.objects.filter(province_id__isnull=True)}
    assert stats['pregnancy_outcomes_total'] == 3  # 2 explicit + 1 baby_event
    assert stats['deaths_total'] == 1
    assert stats['households_total'] == 1
    assert stats['household_members_total'] == 1
    assert stats['babies_total'] == 1
    assert stats['verbal_autopsies_total'] == 1


@pytest.mark.django_db
def test_dashboard_stats_view_province_breakdown(refresh_dashboard_stats):
    province_a = ProvinceFactory()
    province_b = ProvinceFactory()
    cluster_a = ClusterFactory(province=province_a)
    cluster_b = ClusterFactory(province=province_b)
    area_a = AreaFactory(cluster=cluster_a)
    area_b = AreaFactory(cluster=cluster_b)
    staff_a = StaffFactory(cluster=cluster_a, province=province_a)
    staff_b = StaffFactory(cluster=cluster_b, province=province_b)

    Household.objects.create(key='hh-a1', cluster=cluster_a, area=area_a, event_staff=staff_a, form_version='1')
    Household.objects.create(key='hh-a2', cluster=cluster_a, area=area_a, event_staff=staff_a, form_version='1')
    Household.objects.create(key='hh-b1', cluster=cluster_b, area=area_b, event_staff=staff_b, form_version='1')

    refresh_dashboard_stats()

    stats_a = DashboardStat.objects.filter(metric='households_total', province_id=province_a.id).first()
    stats_b = DashboardStat.objects.filter(metric='households_total', province_id=province_b.id).first()
    assert stats_a is not None and stats_a.count == 2
    assert stats_b is not None and stats_b.count == 1

    total = DashboardStat.objects.filter(metric='households_total', province_id__isnull=True).first()
    assert total is not None and total.count == 3


@pytest.mark.django_db
def test_dashboard_stats_view_refresh_updates_counts(refresh_dashboard_stats):
    province = ProvinceFactory()
    cluster = ClusterFactory(province=province)
    area = AreaFactory(cluster=cluster)
    staff = StaffFactory(cluster=cluster, province=province)

    Household.objects.create(key='hh-r1', cluster=cluster, area=area, event_staff=staff, form_version='1')
    refresh_dashboard_stats()

    count_before = DashboardStat.objects.filter(
        metric='households_total', province_id__isnull=True
    ).first().count
    assert count_before == 1

    Household.objects.create(key='hh-r2', cluster=cluster, area=area, event_staff=staff, form_version='1')
    refresh_dashboard_stats()

    count_after = DashboardStat.objects.filter(
        metric='households_total', province_id__isnull=True
    ).first().count
    assert count_after == 2


@pytest.mark.django_db
def test_migration_0002_indexes_exist():
    assert _index_exists('idx_events_type_outcome_date'), \
        "Index idx_events_type_outcome_date does not exist"
    assert _index_exists('idx_events_type_id_desc'), \
        "Index idx_events_type_id_desc does not exist"


@pytest.mark.django_db(transaction=True)
def test_migration_reverse_drops_view_and_indexes():
    assert _view_exists()
    assert _index_exists('idx_events_type_outcome_date')

    try:
        call_command('migrate', 'api', '0001', verbosity=0)
        assert not _view_exists(), "View should not exist after rollback"
        assert not _index_exists('idx_events_type_outcome_date')
        assert not _index_exists('idx_events_type_id_desc')
    finally:
        call_command('migrate', 'api', verbosity=0)

    assert _view_exists(), "View should exist after re-applying migration"
    assert _index_exists('idx_events_type_outcome_date')
    assert _index_exists('idx_events_type_id_desc')

"""
Data integrity tests for the ODK import pipeline.

Verifies that after import:
- FK relationships are consistent (Event→Cluster→Province chain)
- Auto-created reference data forms valid hierarchies
- Child records (Death, Baby, HouseholdMember) correctly link to parents
- No orphaned records exist
- Duplicate imports don't create orphaned references
"""
import pytest
from api.models import (
    Event, Death, Baby,
    Household, HouseholdMember,
    VerbalAutopsy,
    Province, Cluster, Area, Staff,
)
from api.odk.importers.form_submissions.form_submission_importer import FromSubmissionImporter
from tests.factories.factories import (
    OdkProjectFactory, FormSubmissionFactory, ProvinceFactory, DeathFactory,
)


@pytest.fixture
def setup_full_pipeline(mock_get_table_dynamic):
    """Sets up a full import pipeline with all form types."""

    def _m(submission_count=2, use_existing_codes=True,
           cluster_code=None, area_code=None, staff_code=None):
        province = ProvinceFactory(with_clusters=True,
                                   with_clusters__with_areas=True,
                                   with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        # Get importer references
        from api.odk.importers.form_submissions.form_submission_importer_factory import FromSubmissionImporterFactory
        event_form = odk_project.odk_forms.filter(name='Events').first()
        event_importer = event_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_EVENTS_IMPORTER_NAME)
        death_importer = event_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_DEATHS_IMPORTER_NAME)
        baby_importer = event_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_BABIES_IMPORTER_NAME)

        household_form = odk_project.odk_forms.filter(name='Households').first()
        household_importer = household_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_HOUSEHOLDS_IMPORTER_NAME)
        hh_member_importer = household_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_HOUSEHOLD_MEMBERS_IMPORTER_NAME)

        va_form = odk_project.odk_forms.filter(name='Verbal Autopsies').first()
        va_importer = va_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_VERBALAUTOPSY_IMPORTER_NAME)

        # Build form submissions
        _cluster = province.clusters.first()
        _area = _cluster.areas.first()
        _staff = _cluster.staff.first()

        kwargs = {}
        if cluster_code:
            kwargs['cluster_id'] = cluster_code
        if area_code:
            kwargs['area_id'] = area_code
        if staff_code:
            kwargs['staff_id'] = staff_code

        events, deaths, babies = [], [], []
        for _ in range(submission_count):
            events.append(FormSubmissionFactory.create_event(
                event_importer.etl_document,
                _province=province, _cluster=_cluster, _area=_area, _staff=_staff,
                **kwargs))
            deaths.append(FormSubmissionFactory.create_event(
                event_importer.etl_document,
                for_death=death_importer.etl_document,
                _province=province, _cluster=_cluster, _area=_area, _staff=_staff,
                **kwargs))
            babies.append(FormSubmissionFactory.create_event(
                event_importer.etl_document,
                for_baby=baby_importer.etl_document,
                _province=province, _cluster=_cluster, _area=_area, _staff=_staff,
                **kwargs))

        households, hh_members = [], []
        for _ in range(submission_count):
            households.append(FormSubmissionFactory.create_household(
                household_importer.etl_document,
                _province=province, _cluster=_cluster, _area=_area, _staff=_staff))
            hh_members.append(FormSubmissionFactory.create_household(
                household_importer.etl_document,
                for_member=hh_member_importer.etl_document,
                _province=province, _cluster=_cluster, _area=_area, _staff=_staff))

        va_submissions = []
        va_deaths = DeathFactory.create_batch(submission_count)
        for i in range(submission_count):
            va_submissions.append(FormSubmissionFactory.create_verbal_autopsy(
                va_importer.etl_document, va_deaths[i]))

        mock_get_table_dynamic(
            events=events, deaths=deaths, babies=babies,
            households=households, household_members=hh_members,
            verbal_autopsies=va_submissions)

        return odk_project

    yield _m


# ─────────────────────────────────────────────────────────────────────────────
# FK Relationship Integrity
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_event_fk_chain_is_consistent(setup_full_pipeline):
    """Every imported Event's area.cluster must equal event.cluster, and cluster.province must exist."""
    setup_full_pipeline()
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    imported_events = [m for m in result.imported_models if isinstance(m, Event)]
    assert len(imported_events) > 0, "No events were imported"

    for event in imported_events:
        event.refresh_from_db()
        # Event → Cluster → Province chain
        assert event.cluster is not None, f"Event {event.key} has no cluster"
        assert event.cluster.province is not None, f"Cluster {event.cluster.code} has no province"

        # Event → Area → Cluster consistency
        assert event.area is not None, f"Event {event.key} has no area"
        assert event.area.cluster_id == event.cluster_id, (
            f"Event {event.key}: area.cluster ({event.area.cluster_id}) "
            f"!= event.cluster ({event.cluster_id})"
        )

        # Event → Staff → Cluster consistency
        assert event.event_staff is not None, f"Event {event.key} has no staff"


@pytest.mark.django_db
def test_household_fk_chain_is_consistent(setup_full_pipeline):
    """Every Household's area.cluster must equal household.cluster."""
    setup_full_pipeline()
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    for hh in Household.objects.all():
        assert hh.cluster is not None, f"Household {hh.key} has no cluster"
        assert hh.area is not None, f"Household {hh.key} has no area"
        assert hh.area.cluster_id == hh.cluster_id, (
            f"Household {hh.key}: area.cluster ({hh.area.cluster_id}) "
            f"!= household.cluster ({hh.cluster_id})"
        )


@pytest.mark.django_db
def test_death_links_to_parent_event(setup_full_pipeline):
    """Every Death must link to an existing Event."""
    setup_full_pipeline()
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    for death in Death.objects.all():
        assert death.event is not None, f"Death {death.key} has no parent event"
        assert Event.objects.filter(id=death.event_id).exists(), (
            f"Death {death.key} references non-existent event {death.event_id}"
        )


@pytest.mark.django_db
def test_baby_links_to_parent_event(setup_full_pipeline):
    """Every Baby must link to an existing Event."""
    setup_full_pipeline()
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    for baby in Baby.objects.all():
        assert baby.event is not None, f"Baby {baby.key} has no parent event"
        assert Event.objects.filter(id=baby.event_id).exists(), (
            f"Baby {baby.key} references non-existent event {baby.event_id}"
        )


@pytest.mark.django_db
def test_household_member_links_to_parent_household(setup_full_pipeline):
    """Every HouseholdMember must link to an existing Household."""
    setup_full_pipeline()
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    for member in HouseholdMember.objects.all():
        assert member.household is not None, f"HouseholdMember {member.key} has no parent"
        assert Household.objects.filter(id=member.household_id).exists(), (
            f"HouseholdMember {member.key} references non-existent household"
        )


# ─────────────────────────────────────────────────────────────────────────────
# ReferenceResolver Data Integrity (auto-created records)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_auto_created_cluster_has_valid_province(setup_full_pipeline, monkeypatch):
    """Auto-created clusters via ReferenceResolver must have a valid province FK."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    setup_full_pipeline(
        cluster_code='NEWCLUST01',
        area_code='NEWAREA01',
        staff_code='NEWSTAFF01',
    )
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    cluster = Cluster.objects.get(code='NEWCLUST01')
    assert cluster.province is not None, "Auto-created cluster has no province"
    assert Province.objects.filter(id=cluster.province_id).exists(), (
        "Auto-created cluster references non-existent province"
    )


@pytest.mark.django_db
def test_auto_created_area_belongs_to_correct_cluster(setup_full_pipeline, monkeypatch):
    """Auto-created area must FK to the same cluster as the event."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    setup_full_pipeline(
        cluster_code='INTCLUST02',
        area_code='INTAREA02',
        staff_code='INTSTAFF02',
    )
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    area = Area.objects.get(code='INTAREA02')
    cluster = Cluster.objects.get(code='INTCLUST02')
    assert area.cluster_id == cluster.id, (
        f"Auto-created area's cluster ({area.cluster_id}) != expected cluster ({cluster.id})"
    )


@pytest.mark.django_db
def test_auto_created_staff_belongs_to_correct_cluster(setup_full_pipeline, monkeypatch):
    """Auto-created staff must FK to the same cluster used in the event."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    setup_full_pipeline(
        cluster_code='INTCLUST03',
        area_code='INTAREA03',
        staff_code='INTSTAFF03',
    )
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    staff = Staff.objects.get(code='INTSTAFF03')
    cluster = Cluster.objects.get(code='INTCLUST03')
    assert staff.cluster_id == cluster.id, (
        f"Auto-created staff's cluster ({staff.cluster_id}) != expected cluster ({cluster.id})"
    )
    assert staff.staff_type == Staff.StaffType.CSA, (
        f"Auto-created staff type should be CSA, got {staff.staff_type}"
    )


@pytest.mark.django_db
def test_repeated_import_does_not_duplicate_auto_created_references(setup_full_pipeline, monkeypatch):
    """Running import twice with the same missing codes should not create duplicate reference records."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    setup_full_pipeline(
        cluster_code='DUPCLUST01',
        area_code='DUPAREA01',
        staff_code='DUPSTAFF01',
    )

    # First import
    result1 = FromSubmissionImporter().execute()
    assert not result1.errors, f"First import errors: {result1.errors}"

    cluster_count_after_first = Cluster.objects.filter(code='DUPCLUST01').count()
    area_count_after_first = Area.objects.filter(code='DUPAREA01').count()
    staff_count_after_first = Staff.objects.filter(code='DUPSTAFF01').count()

    # Second import (same data, should be deduplicated)
    result2 = FromSubmissionImporter().execute()

    assert Cluster.objects.filter(code='DUPCLUST01').count() == cluster_count_after_first, \
        "Duplicate clusters created on re-import"
    assert Area.objects.filter(code='DUPAREA01').count() == area_count_after_first, \
        "Duplicate areas created on re-import"
    assert Staff.objects.filter(code='DUPSTAFF01').count() == staff_count_after_first, \
        "Duplicate staff created on re-import"


# ─────────────────────────────────────────────────────────────────────────────
# End-to-End Pipeline Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_full_pipeline_creates_all_model_types(setup_full_pipeline):
    """A full import run should create Events, Deaths, Babies, Households, HouseholdMembers, and VAs."""
    setup_full_pipeline(submission_count=2)
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    imported_types = {m.__class__ for m in result.imported_models}
    expected_types = {Event, Death, Baby, Household, HouseholdMember, VerbalAutopsy}
    assert expected_types == imported_types, (
        f"Missing model types: {expected_types - imported_types}"
    )


@pytest.mark.django_db
def test_full_pipeline_imported_counts(setup_full_pipeline):
    """Verify the expected number of records per model type."""
    count = 2
    setup_full_pipeline(submission_count=count)
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    type_counts = {}
    for m in result.imported_models:
        klass = m.__class__.__name__
        type_counts[klass] = type_counts.get(klass, 0) + 1

    # Events: count normal + count deaths + count babies = 3 * count
    assert type_counts.get('Event', 0) == count * 3, \
        f"Expected {count * 3} events, got {type_counts.get('Event', 0)}"
    assert type_counts.get('Death', 0) == count, \
        f"Expected {count} deaths, got {type_counts.get('Death', 0)}"
    assert type_counts.get('Baby', 0) == count, \
        f"Expected {count} babies, got {type_counts.get('Baby', 0)}"
    assert type_counts.get('Household', 0) == count * 2, \
        f"Expected {count * 2} households, got {type_counts.get('Household', 0)}"
    assert type_counts.get('HouseholdMember', 0) == count, \
        f"Expected {count} household members, got {type_counts.get('HouseholdMember', 0)}"
    assert type_counts.get('VerbalAutopsy', 0) == count, \
        f"Expected {count} verbal autopsies, got {type_counts.get('VerbalAutopsy', 0)}"


@pytest.mark.django_db
def test_full_pipeline_with_auto_create_missing_refs(setup_full_pipeline, monkeypatch):
    """End-to-end: import with unknown cluster/area/staff codes should succeed
    when DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True and create valid hierarchies."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    setup_full_pipeline(
        submission_count=2,
        cluster_code='E2ECLUST',
        area_code='E2EAREA',
        staff_code='E2ESTAFF',
    )
    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    # Verify auto-created references exist
    assert Cluster.objects.filter(code='E2ECLUST').exists()
    assert Area.objects.filter(code='E2EAREA').exists()
    assert Staff.objects.filter(code='E2ESTAFF').exists()

    # Verify imported events use the auto-created references
    for event in Event.objects.filter(cluster__code='E2ECLUST'):
        assert event.area.code == 'E2EAREA'
        assert event.event_staff.code == 'E2ESTAFF'
        # Verify the full hierarchy chain
        assert event.cluster.province is not None
        assert event.area.cluster == event.cluster


@pytest.mark.django_db
def test_full_pipeline_without_auto_create_rejects_unknown_codes(setup_full_pipeline):
    """Without DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING, unknown codes should produce errors."""
    setup_full_pipeline(
        submission_count=1,
        cluster_code='UNKNOWN01',
        area_code='UNKNOWN02',
        staff_code='UNKNOWN03',
    )
    result = FromSubmissionImporter().execute()

    # Should have errors for unknown reference codes
    assert len(result.errors) > 0, "Expected errors for unknown reference codes"

    # The unknown cluster/area/staff should NOT be created
    assert not Cluster.objects.filter(code='UNKNOWN01').exists()
    assert not Area.objects.filter(code='UNKNOWN02').exists()
    assert not Staff.objects.filter(code='UNKNOWN03').exists()


@pytest.mark.django_db
def test_db_record_counts_match_import_result(setup_full_pipeline):
    """The number of records in the DB should match what the import result reports."""
    setup_full_pipeline(submission_count=2)

    # Capture counts AFTER setup (factories create some records) but BEFORE import
    initial_event_count = Event.objects.count()
    initial_death_count = Death.objects.count()
    initial_household_count = Household.objects.count()

    result = FromSubmissionImporter().execute()
    assert not result.errors, f"Import errors: {result.errors}"

    imported_event_count = sum(1 for m in result.imported_models if isinstance(m, Event))
    imported_death_count = sum(1 for m in result.imported_models if isinstance(m, Death))
    imported_household_count = sum(1 for m in result.imported_models if isinstance(m, Household))

    assert Event.objects.count() == initial_event_count + imported_event_count
    assert Death.objects.count() == initial_death_count + imported_death_count
    assert Household.objects.count() == initial_household_count + imported_household_count

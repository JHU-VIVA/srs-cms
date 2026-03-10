import pytest
from api.odk.importers.form_submissions.households_importer import HouseholdsImporter
from api.odk.importers.form_submissions.form_submission_importer_factory import FromSubmissionImporterFactory
from api.models import Household, Cluster, Area, Staff
from tests.factories.factories import OdkProjectFactory, FormSubmissionFactory, ProvinceFactory

DEFAULT_FORM_SUBMISSION_COUNT = 3


@pytest.fixture
def setup(mock_get_table):
    def _m(form_submission_count=DEFAULT_FORM_SUBMISSION_COUNT, form_submissions=[]):
        ProvinceFactory(with_clusters=True,
                        with_clusters__with_areas=True,
                        with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        household_odk_form = odk_project.odk_forms.filter(name=OdkProjectFactory.ODK_FORM_NAME_FOR_HOUSEHOLDS).first()
        household_odk_form_importer = household_odk_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_HOUSEHOLDS_IMPORTER_NAME
        )
        household_etl_document = household_odk_form_importer.etl_document

        household_form_submissions = form_submissions or []
        for _ in range(form_submission_count):
            household_form_submissions.append(
                FormSubmissionFactory.create_household(household_etl_document)
            )

        mock_get_table(household_form_submissions)
        return household_odk_form, household_odk_form_importer, household_form_submissions

    yield _m


@pytest.mark.django_db
def test_it_imports_households(setup, expect_odk_form_submission_import_result):
    odk_form, odk_form_importer, event_form_submissions = setup()

    importer = HouseholdsImporter(odk_form, odk_form_importer)
    result = importer.execute()
    expect_odk_form_submission_import_result(result, imported_models_count=DEFAULT_FORM_SUBMISSION_COUNT)

    imported_household = result.imported_models[0]
    assert isinstance(imported_household, Household)
    actual_model = Household.objects.get(id=imported_household.id)
    assert actual_model == imported_household


@pytest.mark.django_db
def test_it_does_not_import_duplicate_households(setup, expect_odk_form_submission_import_result):
    odk_form, odk_form_importer, event_form_submissions = setup()

    importer = HouseholdsImporter(odk_form, odk_form_importer)
    result = importer.execute()
    expect_odk_form_submission_import_result(result, imported_models_count=DEFAULT_FORM_SUBMISSION_COUNT)

    # Import the same records again
    importer = HouseholdsImporter(odk_form, odk_form_importer)
    result = importer.execute()
    expect_odk_form_submission_import_result(result, imported_models_count=0)


@pytest.mark.django_db
def test_it_auto_creates_missing_references(setup, expect_odk_form_submission_import_result, monkeypatch):
    """When DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING=True, missing cluster/area/staff are auto-created."""
    monkeypatch.setenv('DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING', 'True')

    nonexistent_cluster_code = 'NEWCLUSTER99'
    nonexistent_area_code = 'NEWAREA99'
    nonexistent_staff_code = 'NEWSTAFF99'

    # Create form submissions with codes that don't exist in DB
    form_submissions = []
    odk_form, odk_form_importer, form_submissions = setup(
        form_submission_count=0,
        form_submissions=form_submissions,
    )
    household_etl_document = odk_form_importer.etl_document

    submission = FormSubmissionFactory.create_household(
        household_etl_document,
        grp_cluster={"cluster_id": nonexistent_cluster_code},
        grp_area={"area_id": nonexistent_area_code, "worker_id": nonexistent_staff_code},
    )
    form_submissions.append(submission)

    importer = HouseholdsImporter(odk_form, odk_form_importer)
    result = importer.execute()
    expect_odk_form_submission_import_result(result, imported_models_count=1)

    # Verify the references were auto-created
    assert Cluster.objects.filter(code=nonexistent_cluster_code).exists()
    assert Area.objects.filter(code=nonexistent_area_code).exists()
    assert Staff.objects.filter(code=nonexistent_staff_code).exists()

    # Verify the imported household is linked to the auto-created records
    imported_household = result.imported_models[0]
    assert imported_household.cluster.code == nonexistent_cluster_code
    assert imported_household.area.code == nonexistent_area_code
    assert imported_household.event_staff.code == nonexistent_staff_code

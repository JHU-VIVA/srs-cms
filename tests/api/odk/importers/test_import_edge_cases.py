"""
Edge case and error handling tests for the ODK import pipeline.

Covers: missing required fields, invalid types, empty batches, null optionals,
malformed GPS, duplicate keys, disabled projects/forms.
"""
import pytest
from api.models import Event, OdkProject, OdkForm
from api.odk.importers.form_submissions.events_importer import EventsImporter
from api.odk.importers.form_submissions.form_submission_importer import FromSubmissionImporter
from api.odk.importers.form_submissions.form_submission_importer_factory import FromSubmissionImporterFactory
from tests.factories.factories import (
    OdkProjectFactory, FormSubmissionFactory, ProvinceFactory,
)


DEFAULT_FORM_SUBMISSION_COUNT = 3


@pytest.fixture
def setup_events(mock_get_table):
    """Setup for single-form event import tests."""
    def _m(form_submissions=None):
        ProvinceFactory(with_clusters=True,
                        with_clusters__with_areas=True,
                        with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        event_odk_form = odk_project.odk_forms.filter(
            name=OdkProjectFactory.ODK_FORM_NAME_FOR_EVENTS
        ).first()
        event_odk_form_importer = event_odk_form.get_odk_form_importer(
            importer=FromSubmissionImporterFactory.ODK_EVENTS_IMPORTER_NAME
        )
        event_etl_document = event_odk_form_importer.etl_document

        if form_submissions is None:
            form_submissions = []

        mock_get_table(form_submissions)
        return event_odk_form, event_odk_form_importer, event_etl_document, form_submissions

    yield _m


@pytest.fixture
def setup_full_pipeline(mock_get_table_dynamic):
    """Setup for full pipeline tests (disabled project/form)."""
    def _m():
        ProvinceFactory(with_clusters=True,
                        with_clusters__with_areas=True,
                        with_clusters__with_staff=True)

        odk_project = OdkProjectFactory(with_forms=True,
                                        with_forms__importers=True,
                                        with_forms__with_etl=True)

        mock_get_table_dynamic(events=[], deaths=[], babies=[],
                               households=[], household_members=[],
                               verbal_autopsies=[])
        return odk_project

    yield _m


@pytest.mark.django_db
def test_import_with_missing_required_field(setup_events):
    """A submission missing a required mapped field should produce an error."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    # Delete a required field (cluster_id is required in event ETL mappings)
    del submission['cluster_id']
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.errors) > 0
    assert any('does not have a field named' in e for e in result.errors)


@pytest.mark.django_db
def test_import_with_invalid_field_type(setup_events):
    """A string where int is expected -- TypeCaster handles coercion."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    submission['cluster_id'] = 12345  # normally a string code
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    # The TypeCaster itself should not crash
    assert all('Error executing' not in e for e in result.errors)


@pytest.mark.django_db
def test_import_with_empty_submission_batch(setup_events):
    """An empty submission list should produce 0 imports and no errors."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 0
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_null_optional_fields(setup_events):
    """Submissions with null optional fields should still import."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    submission['resp_name'] = None
    submission['hh_address'] = None
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 1
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_malformed_gps_data(setup_events):
    """GPS dict missing coordinates key -- import should still succeed."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    submission['gps'] = {"type": "Point"}  # missing coordinates and properties
    form_submissions.append(submission)

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 1
    assert len(result.errors) == 0


@pytest.mark.django_db
def test_import_with_duplicate_keys_in_batch(setup_events):
    """Two submissions with the same __id -- first imports, second is skipped."""
    odk_form, odk_form_importer, etl_doc, form_submissions = setup_events()

    submission = FormSubmissionFactory.create_event(etl_doc)
    form_submissions.append(submission)
    form_submissions.append(submission.copy())

    importer = EventsImporter(odk_form, odk_form_importer)
    result = importer.execute()

    assert len(result.imported_models) == 1
    # Second one is skipped with info message, not an error
    assert any('already exists' in msg for msg in result.info_log)


@pytest.mark.django_db
def test_disabled_project_not_imported(setup_full_pipeline):
    """A disabled OdkProject should produce an error, not import."""
    odk_project = setup_full_pipeline()
    odk_project.is_enabled = False
    odk_project.save()

    importer = FromSubmissionImporter(odk_projects=odk_project)
    result = importer.execute()

    assert any('not enabled' in e for e in result.errors)
    assert len(result.imported_models) == 0


@pytest.mark.django_db
def test_disabled_form_not_imported(setup_full_pipeline):
    """A disabled OdkForm should produce an error, not import."""
    odk_project = setup_full_pipeline()
    odk_form = odk_project.odk_forms.first()
    odk_form.is_enabled = False
    odk_form.save()

    importer = FromSubmissionImporter(odk_forms=[odk_form])
    result = importer.execute()

    assert any('not enabled' in e or 'not not enabled' in e for e in result.errors)
    assert len(result.imported_models) == 0

"""
Tests for VaPreloadExporter.

Covers: export of VA_SCHEDULED deaths, validation, JSON output, ODK merge call.
All tests mock the OdkConfig/pyodk client chain.
"""
import os
import tempfile
import pytest
from api.models import Death, OdkEntityListExporter
from api.odk.exporters.entity_lists.va_preload_exporter import VaPreloadExporter
from tests.factories.factories import (
    DeathFactory, EtlMappingFactory,
    OdkEntityListExporterModelFactory,
)


@pytest.fixture
def mock_odk_client(mocker):
    """Mock the OdkConfig chain to return a mock client with entities.merge."""
    mock_client = mocker.MagicMock()
    mock_config = mocker.patch('api.odk.exporters.entity_lists.va_preload_exporter.OdkConfig.from_env')
    mock_config.return_value.client.return_value = mock_client
    return mock_client


@pytest.fixture
def exporter_with_mappings(mock_odk_client):
    """Create an OdkEntityListExporter with ETL mappings for Death fields."""
    odk_exporter = OdkEntityListExporterModelFactory()
    etl_doc = odk_exporter.etl_document

    # Primary key mapping: death_code
    EtlMappingFactory(
        etl_document=etl_doc,
        source_name='death_code',
        target_name='death_code',
        target_type='str',
        is_primary_key=True,
        is_required=True,
    )
    # Non-PK mapping: deceased_name
    EtlMappingFactory(
        etl_document=etl_doc,
        source_name='deceased_name',
        target_name='deceased_name',
        target_type='str',
        is_primary_key=False,
        is_required=False,
    )
    return odk_exporter, mock_odk_client


@pytest.mark.django_db
def test_export_scheduled_deaths(exporter_with_mappings):
    """VA_SCHEDULED deaths should appear in exported_models."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory.create_batch(2, death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    result = exporter.execute()

    assert len(result.exported_models) == 2
    assert not result.errors


@pytest.mark.django_db
def test_export_skips_non_scheduled_deaths(exporter_with_mappings):
    """Deaths with NEW_DEATH status should not be exported."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory.create_batch(2, death_status=Death.DeathStatus.NEW_DEATH)
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    result = exporter.execute()

    assert len(result.exported_models) == 1


@pytest.mark.django_db
def test_export_validation_fails_without_etl_document(mock_odk_client):
    """Validation fails when etl_document is None."""
    odk_exporter = OdkEntityListExporterModelFactory(etl_document=None)

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('ETL Document not set' in e for e in exporter.result.errors)


@pytest.mark.django_db
def test_export_validation_fails_without_etl_mappings(mock_odk_client):
    """Validation fails when etl_document has no enabled mappings."""
    odk_exporter = OdkEntityListExporterModelFactory()

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('ETL Document Mappings not set' in e for e in exporter.result.errors)


@pytest.mark.django_db
def test_export_validation_fails_without_primary_key(mock_odk_client):
    """Validation fails when mappings exist but none is primary key."""
    odk_exporter = OdkEntityListExporterModelFactory()
    EtlMappingFactory(
        etl_document=odk_exporter.etl_document,
        source_name='deceased_name',
        target_name='deceased_name',
        target_type='str',
        is_primary_key=False,
    )

    exporter = VaPreloadExporter(odk_exporter)
    is_valid = exporter.validate_before_execute()

    assert is_valid is False
    assert any('primary key' in e for e in exporter.result.errors)


@pytest.mark.django_db
def test_export_saves_json_to_out_dir(exporter_with_mappings):
    """When out_dir is set, an entity list JSON file is written."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)
    out_dir = tempfile.mkdtemp()

    exporter = VaPreloadExporter(odk_exporter, out_dir=out_dir)
    exporter.execute()

    expected_file = os.path.join(
        out_dir,
        f'entity-list-{odk_exporter.odk_entity_list.name}.json'
    )
    assert os.path.isfile(expected_file)


@pytest.mark.django_db
def test_export_calls_odk_entities_merge(exporter_with_mappings):
    """The exporter should call entities.merge with correct parameters."""
    odk_exporter, mock_client = exporter_with_mappings
    DeathFactory(death_status=Death.DeathStatus.VA_SCHEDULED)

    exporter = VaPreloadExporter(odk_exporter)
    exporter.execute()

    mock_client.entities.merge.assert_called_once()
    call_kwargs = mock_client.entities.merge.call_args
    assert call_kwargs.kwargs['update_matched'] is True
    assert call_kwargs.kwargs['delete_not_matched'] is True
    assert call_kwargs.kwargs['entity_list_name'] == odk_exporter.odk_entity_list.name

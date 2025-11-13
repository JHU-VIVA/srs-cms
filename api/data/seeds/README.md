# Seed Data

## Production

1. Populate the following CSV files with their respective data.
    - [production/areas.csv](production/areas.csv)
    - [production/clusters.csv](production/clusters.csv)
    - [production/provinces.csv](production/provinces.csv)
    - [production/staff.csv](production/staff.csv)
2. Configure the ODK Project and ETL Mappings in these files.
    - [production/odk_projects.json](production/odk_projects.json)
        - Set `project_id` and all occurrences of `version` and the version in `etl_document`.
    - [production/etl_mappings_events.json](production/etl_mappings_events.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_deaths.json](production/etl_mappings_deaths.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_babies.json](production/etl_mappings_babies.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_households.json](production/etl_mappings_households.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_household_members.json](production/etl_mappings_household_members.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_va_preload.json](production/etl_mappings_va_preload.json)
        - Set all occurrences of `version`.
    - [production/etl_mappings_verbal_autopsies.json](production/etl_mappings_verbal_autopsies.json)
        - Set all occurrences of `version`.

3. Import or update the database from the seed files: `python manage.py init_database --env production --seed`

# CSV Files

## areas.csv

| Column Name         | Description                       |
|---------------------|-----------------------------------|
| `code`              | Code for the area                 |
| `cluster_code`      | Cluster code this area belongs to |
| `adm0_code`         |                                   |
| `adm0_name`         |                                   |
| `prov_text_code`    |                                   |
| `adm1_code`         |                                   |
| `adm1_name`         |                                   |
| `adm2_code`         |                                   |
| `adm2_name`         |                                   |
| `adm3_code`         |                                   |
| `adm3_name`         |                                   |
| `adm4_code`         |                                   |
| `adm4_name`         |                                   |
| `adm5_code`         |                                   |
| `adm5_name`         |                                   |
| `urban_rural`       |                                   |
| `carto_house_count` |                                   |
| `carto_pop_count`   |                                   |
| `import_code`       |                                   |
| `status`            |                                   |
| `comment`           |                                   |

## clusters.csv

| Column Name     | Description                           |
|-----------------|---------------------------------------|
| `code`          | Cluster code                          |
| `name`          | Cluster name                          |
| `province_code` | Province code this cluster belongs to |

## provinces.csv

| Column Name | Description   |
|-------------|---------------|
| `code`      | Province code |
| `name`      | Province name |

## staff.csv

| Column Name     | Description                         |
|-----------------|-------------------------------------|
| `code`          | Staff code                          |
| `cluster_code`  | Cluster code this staff belongs to  |
| `province_code` | Province code this staff belongs to |
| `staff_type_id` | `CSA` or `VA`                       |
| `full_name`     |                                     |
| `title`         |                                     |
| `mobile_per`    |                                     |
| `email`         |                                     |
| `cms_status`    |                                     |
| `comment`       |                                     |

Staff Types:

| Code  | Name                             |
|-------|----------------------------------|
| `CSA` | Community Surveillance Assistant |
| `VA`  | Verbal Autopsy Interviewer       |

# JSON Files

## odk_projects.json

This file defines ODK Projects, ODK Forms (and importers), ODK Entity Lists (and exporters).

### Top-Level Structure

These files define the ETL mappings for form submissions and entity list exporters.

```json
[
  {
    "name": "string",
    "project_id": number,
    "is_enabled": boolean,
    "odk_entity_lists": [
      EntityListObject
    ],
    "odk_forms": [
      ODKFormObject
    ]
  }
]
```

### ODK Project Object

| Field              | Type              | Description                                    |
|--------------------|-------------------|------------------------------------------------|
| `name`             | string            | Name of the project (e.g., `SRS-CMS`)          |
| `project_id`       | number            | ODK Central project ID                         |
| `is_enabled`       | boolean           | Controls whether the project is active         |
| `odk_entity_lists` | array<EntityList> | ODK Entity Lists and exporters for the project |
| `odk_forms`        | array<ODKForm>    | ODK Forms and importers for the project        |

### Entity Lists

EntityList Object

| Field                       | Type                      | Description                       |
|-----------------------------|---------------------------|-----------------------------------|
| `name`                      | string                    | Name of the entity list           |
| `is_enabled`                | boolean                   | Whether the entity list is active |
| `odk_entity_list_exporters` | array<EntityListExporter> | Exporters for the Entity List     |

EntityListExporter Object

| Field          | Type    | Description                                                       |
|----------------|---------|-------------------------------------------------------------------|
| `exporter`     | string  | Name of the exporter class to use                                 |
| `is_enabled`   | boolean | Controls if the exporter runs                                     |
| `etl_document` | string  | ETL document identifier formatted as `ETL-Document-Name\|Version` |

### ODK Forms

ODKForm Object

| Field                | Type                | Description                 |
|----------------------|---------------------|-----------------------------|
| `name`               | string              | Display name of the form    |
| `xml_form_id`        | string              | ODK Central XML Form ID     |
| `version`            | string              | ODK Central Version         |
| `is_enabled`         | boolean             | Whether the form is enabled |
| `odk_form_importers` | array<FormImporter> | Importers for the form      |

FormImporter Object

| Field          | Type    | Description                                                       |
|----------------|---------|-------------------------------------------------------------------|
| `import_order` | number  | Execution order for importers                                     |
| `importer`     | string  | Class name of the Importer                                        |
| `is_enabled`   | boolean | Whether this importer is active                                   |
| `etl_document` | string  | ETL document identifier formatted as `ETL-Document-Name\|Version` |

## etl_mappings_*.json

### Top-Level Structure

```json
[
  {
    "name": "string",
    "version": "string",
    "source_root": "string|null",
    "mappings": [
      MappingObject
    ]
  }
]
```

### ETL Document Object

| Field         | Type           | Description                                                                |
|---------------|----------------|----------------------------------------------------------------------------|
| `name`        | string         | Name of the ETL Document. Usually the same as the form name (e.g., Events) |
| `version`     | string         | The ODK Form version is ETL Document handles.                              |
| `source_root` | string\|null   | Optional root prefix for source fields                                     |
| `mappings`    | array<Mapping> | List of mapped fields                                                      |

### Mapping Object

| Field            | Type            | Description                                                                          |
|------------------|-----------------|--------------------------------------------------------------------------------------|
| `source_name`    | string          | Source field path to map from.                                                       |
| `target_name`    | string          | Name of the target field/column                                                      |
| `target_type`    | string          | Target data type (`int`, `float`, `str`, `bool`, `dict`, `list`, `date`, `datetime`) |
| `default`        | any             | Value to use if none provided                                                        |
| `transform`      | Transform\|null | Transformation applied to source_value                                               | 
| `is_primary_key` | boolean         | Indicates if this field is part of the primary key(s)                                |
| `is_enabled`     | boolean         | Whether this mapping is active                                                       |
| `is_required`    | boolean         | Whether this field must be present in the data being processed                       |

### Transform Object

| Field    | Type         | Description                                        |
|----------|--------------|----------------------------------------------------|
| `name`   | string       | Transform operation name (`replace` or `strftime`) |
| `args`   | array\|null  | Positional arguments for transform                 |
| `kwargs` | object\|null | Keyword arguments for transform                    |

#### Transforms

##### `replace`

Calls `str.replace` with the given args.

```json
{
  "transform": {
    "name": "replace",
    "args": [
      "search-string",
      "replace-string"
    ],
    "kwargs": null
  }
}
```

##### `strftime`

Calls `strftime` with the given args.

```json
{
  "transform": {
    "name": "strftime",
    "args": null,
    "kwargs": {
      "format": "%Y-%m-%d"
    }
  }
}
```
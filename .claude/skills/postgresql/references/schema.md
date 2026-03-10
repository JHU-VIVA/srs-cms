# SRS-CMS Database Schema Reference

Complete field definitions for all tables. Use this when writing queries, creating migrations, or designing API schemas.

## Geographic Tables

### provinces
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| code | CharField(2) | NOT NULL |
| name | CharField(100) | NOT NULL |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `code` (gin_trgm_ops)

### clusters
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| province_id | ForeignKey(Province) | NOT NULL, ON DELETE RESTRICT |
| code | CharField(12) | NOT NULL, UNIQUE |
| name | CharField(255) | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `code` (gin_trgm_ops)

### areas
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| cluster_id | ForeignKey(Cluster) | NOT NULL, ON DELETE RESTRICT |
| code | CharField(12) | NOT NULL, UNIQUE |
| province_code | CharField(20) | nullable |
| adm0_code | CharField(100) | nullable |
| adm0_name | CharField(100) | nullable |
| adm1_code | CharField(100) | nullable |
| adm1_name | CharField(100) | nullable |
| adm2_code | CharField(100) | nullable |
| adm2_name | CharField(100) | nullable |
| adm3_code | CharField(100) | nullable |
| adm3_name | CharField(100) | nullable |
| adm4_code | CharField(100) | nullable |
| adm4_name | CharField(100) | nullable |
| adm5_code | CharField(100) | nullable |
| adm5_name | CharField(100) | nullable |
| urban_rural | CharField(20) | nullable |
| carto_house_count | IntegerField | nullable |
| carto_pop_count | IntegerField | nullable |
| import_code | CharField(20) | nullable |
| status | IntegerField | nullable |
| comment | CharField(255) | nullable |
| created_by | IntegerField | nullable |
| updated_by | IntegerField | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `code` (gin_trgm_ops)

## Staff

### staff
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| cluster_id | ForeignKey(Cluster) | nullable, ON DELETE SET_NULL |
| province_id | ForeignKey(Province) | nullable, ON DELETE SET_NULL |
| code | CharField(12) | nullable |
| staff_type | CharField(12) | NOT NULL, choices: CSA/VA |
| full_name | CharField(100) | nullable |
| title | CharField(100) | nullable |
| mobile_per | CharField(9) | nullable |
| email | CharField(100) | nullable |
| cms_status | IntegerField | nullable, choices: NORMAL=1, DUPLICATE=2 |
| comment | CharField(255) | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Constraints:** CHECK `(staff_type='CSA' AND cluster_id IS NOT NULL) OR (staff_type='VA' AND province_id IS NOT NULL)`
**Indexes:** GIN on `code` (gin_trgm_ops)

## Event Tables

### events
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| cluster_id | ForeignKey(Cluster) | NOT NULL, ON DELETE RESTRICT |
| area_id | ForeignKey(Area) | NOT NULL, ON DELETE RESTRICT |
| event_staff_id | ForeignKey(Staff) | NOT NULL, ON DELETE RESTRICT |
| key | CharField(80) | NOT NULL, UNIQUE |
| cluster_code | CharField(255) | nullable |
| area_code | CharField(255) | nullable |
| staff_code | CharField(255) | nullable |
| event_type | IntegerField | nullable, choices: NO_EVENT=0, PREGNANCY=1, PREGNANCY_OUTCOME=2, DEATH=3 |
| event_register | IntegerField | nullable |
| consent | IntegerField | nullable, choices: YES=1, NO=2 |
| visit_type | IntegerField | nullable, choices: ROUTINE=1, SPECIAL=2 |
| consent_type | IntegerField | nullable |
| visit_method | IntegerField | nullable |
| household_code | CharField(255) | nullable |
| address | CharField(255) | nullable |
| head_name | CharField(255) | nullable |
| gps_latitude | DecimalField(38,10) | nullable |
| gps_longitude | DecimalField(38,10) | nullable |
| gps_altitude | DecimalField(38,10) | nullable |
| gps_accuracy | DecimalField(38,10) | nullable |
| respondent_name | CharField(255) | nullable |
| lmp_date | DateField | nullable |
| preg_ga_months | CharField(255) | nullable |
| edd_date | DateField | nullable |
| deceased_person_name | CharField(255) | nullable |
| death_date | DateField | nullable |
| deceased_sex | IntegerField | nullable, choices: MALE=1, FEMALE=2 |
| deceased_age | IntegerField | nullable |
| age_unit | CharField | nullable, choices: YEARS/MONTHS/DAYS |
| dob_known | DateField | nullable |
| dob_date | DateField | nullable |
| is_neonatal | BooleanField | nullable |
| is_child | BooleanField | nullable |
| is_adult | BooleanField | nullable |
| deceased_preg | IntegerField | nullable |
| woman_died_birth | IntegerField | nullable |
| woman_died_2mpp | IntegerField | nullable |
| va_proposed_date | DateField | nullable |
| va_contact_name | CharField(255) | nullable |
| va_contact_tel | CharField(255) | nullable |
| birth_sing_outcome | IntegerField | nullable |
| birth_multi | IntegerField | nullable |
| birth_multi_alive | IntegerField | nullable |
| birth_multi_still | IntegerField | nullable |
| baby_ct | CharField(255) | nullable |
| baby_rep_count | CharField(255) | nullable |
| head_phone_cell | IntegerField | nullable |
| head_phone_allow | IntegerField | nullable |
| head_phone | CharField(255) | nullable |
| head_phone_confirm | CharField(255) | nullable |
| res_phone_cell | IntegerField | nullable |
| res_phone_allow | IntegerField | nullable |
| res_phone | CharField(255) | nullable |
| any_phone_cell | IntegerField | nullable |
| any_phone_allow | IntegerField | nullable |
| any_phone_name | CharField(255) | nullable |
| any_phone | CharField(255) | nullable |
| any_phone_confirm | CharField(255) | nullable |
| start_datetime | DateTimeField | nullable |
| end_datetime | DateTimeField | nullable |
| today_date | DateField | nullable |
| device_code | CharField(255) | nullable |
| instance_code | CharField(255) | nullable |
| instance_name | CharField(255) | nullable |
| submitter_id | IntegerField | nullable |
| submitter_name | CharField(255) | nullable |
| form_version | CharField(255) | nullable |
| cms_status | IntegerField | nullable |
| comment | CharField(255) | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `household_head_name`, `deceased_person_name`, `respondent_name` (gin_trgm_ops)

### babies
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| event_id | ForeignKey(Event) | NOT NULL, ON DELETE CASCADE |
| key | CharField(80) | NOT NULL, UNIQUE |
| name | CharField(255) | nullable |
| sex | IntegerField | nullable, choices: MALE=1, FEMALE=2 |
| preg_outcome_date | DateField | nullable |
| weight | FloatField | nullable |
| is_birth_registered | BooleanField | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

### deaths
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| event_id | ForeignKey(Event) | NOT NULL, ON DELETE CASCADE |
| va_staff_id | ForeignKey(Staff) | nullable, ON DELETE RESTRICT |
| key | CharField(80) | NOT NULL, UNIQUE |
| death_type | IntegerField | nullable, choices: NORMAL=2, STILLBIRTH=3 |
| death_code | CharField(20) | nullable, UNIQUE |
| death_status | IntegerField | nullable, choices: NEW_DEATH=0, VA_SCHEDULED=1, VA_COMPLETED=2, VA_ON_HOLD=3 |
| deceased_name | CharField(255) | nullable |
| deceased_sex | IntegerField | nullable, choices: MALE=1, FEMALE=2 |
| deceased_dob | DateField | nullable |
| deceased_dod | DateField | nullable |
| deceased_age | IntegerField | nullable |
| deceased_mother_name | CharField(255) | nullable |
| deceased_father_name | CharField(255) | nullable |
| va_key | CharField(80) | nullable |
| va_proposed_date | DateField | nullable |
| va_scheduled_date | DateField | nullable |
| va_completed_date | DateField | nullable |
| va_max_date | DateTimeField | nullable |
| va_staff_code | CharField(12) | nullable |
| comment | CharField(2000) | nullable |
| match_err | IntegerField | nullable |
| created_by | IntegerField | nullable |
| updated_by | IntegerField | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `death_code`, `deceased_name` (gin_trgm_ops)

### pregnancies
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| event_id | ForeignKey(Event) | NOT NULL, ON DELETE CASCADE |
| staff_id | ForeignKey(Staff) | NOT NULL, ON DELETE RESTRICT |
| code | CharField(20) | nullable, UNIQUE |
| outcome_key | CharField(80) | nullable |
| edd_date | DateTimeField | nullable |
| preg_staff_code | CharField(12) | nullable |
| outcome_staff_code | CharField(12) | nullable |
| outcome_status | IntegerField | nullable |
| comment | CharField(2000) | nullable |
| match_err | IntegerField | nullable |
| created_by | IntegerField | nullable |
| updated_by | IntegerField | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Indexes:** GIN on `code` (gin_trgm_ops)

## Household Tables

### households
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| cluster_id | ForeignKey(Cluster) | NOT NULL, ON DELETE RESTRICT |
| area_id | ForeignKey(Area) | NOT NULL, ON DELETE RESTRICT |
| event_staff_id | ForeignKey(Staff) | NOT NULL, ON DELETE RESTRICT |
| key | CharField(80) | NOT NULL, UNIQUE |
| submission_date | DateField | nullable |
| interview_date | DateField | nullable |
| cluster_code | CharField(255) | nullable |
| area_code | CharField(255) | nullable |
| staff_code | CharField(255) | nullable |
| met_status | IntegerField | nullable, choices: YES=1, MOVED=3, ABSENT=4, DESTROYED=5 |
| consent | IntegerField | nullable, choices: YES=1, NO=2, MOVED=3, ABSENT=4, DESTROYED=5 |
| household_code | CharField(255) | nullable |
| address | CharField(255) | nullable |
| head_name | CharField(255) | nullable |
| gps_latitude | DecimalField(38,10) | nullable |
| gps_longitude | DecimalField(38,10) | nullable |
| gps_altitude | DecimalField(38,10) | nullable |
| gps_accuracy | DecimalField(38,10) | nullable |
| respondent_name | CharField(255) | nullable |
| residence_count | CharField(255) | nullable |
| visitor_count | CharField(255) | nullable |
| rep_member_count | CharField(255) | nullable |
| *(phone fields)* | various | same pattern as events |
| start_datetime | DateTimeField | nullable |
| end_datetime | DateTimeField | nullable |
| today_date | DateField | nullable |
| device_code | CharField(255) | nullable |
| instance_code | CharField(255) | nullable |
| instance_name | CharField(255) | nullable |
| submitter_id | IntegerField | nullable |
| submitter_name | CharField(255) | nullable |
| status | CharField(255) | nullable |
| review_state | CharField(255) | nullable |
| edits | IntegerField | nullable |
| form_version | CharField(255) | nullable |
| cms_status | IntegerField | nullable |
| comment | CharField(255) | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

### household_members
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| household_id | ForeignKey(Household) | NOT NULL, ON DELETE CASCADE |
| key | CharField(80) | NOT NULL, UNIQUE |
| full_name | CharField(255) | nullable |
| member_type | IntegerField | nullable, choices: RESIDENT=1, VISITOR=2 |
| sex | IntegerField | nullable, choices: MALE=1, FEMALE=2 |
| age_in_years | IntegerField | nullable |
| rel_head | IntegerField | nullable, choices: HEAD=1, SPOUSE=2, BIO_CHILD=3, PARENT=4, NONBIO_CHILD=5, ADOPTED=6, INLAW=7, GRANDCHILD=8, OTHER=9, NONE=10 |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

## Verbal Autopsies

### verbal_autopsies
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| cluster_id | ForeignKey(Cluster) | NOT NULL, ON DELETE RESTRICT |
| area_id | ForeignKey(Area) | NOT NULL, ON DELETE RESTRICT |
| death_id | OneToOneField(Death) | nullable, ON DELETE RESTRICT, related_name="verbal_autopsy" |
| key | CharField(80) | NOT NULL, UNIQUE |
| submission_date | DateField | nullable |
| deceased_list | CharField(80) | NOT NULL, UNIQUE |
| death_code | CharField(255) | nullable |
| cluster_code | CharField(255) | nullable |
| area_code | CharField(255) | nullable |
| household_id | CharField(255) | nullable |
| id10002 - id10481 | CharField(255) / DateField / IntegerField | nullable (WHO VA form fields) |
| *(metadata fields)* | various | same pattern as events/households |
| cms_status | IntegerField | nullable |
| comment | CharField(255) | nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Note:** Fields `id10002` through `id10481` follow the WHO Verbal Autopsy instrument field naming convention. Most are CharField(255), with select date fields (id10011, id10021, id10023, id10023_a, id10060, id10071, id10481) as DateField and age/display fields as IntegerField.

## ODK Configuration Tables

### odk_projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| name | CharField | NOT NULL |
| project_id | IntegerField | ODK Central project ID |
| is_enabled | BooleanField | |

### odk_forms
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| odk_project_id | ForeignKey(OdkProject) | NOT NULL, ON DELETE CASCADE |
| name | CharField | NOT NULL |
| xml_form_id | CharField | NOT NULL |
| version | CharField | NOT NULL |
| is_enabled | BooleanField | |

**Constraints:** UNIQUE(odk_project, xml_form_id, version)

### odk_form_importers
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| odk_form_id | ForeignKey(OdkForm) | NOT NULL, ON DELETE CASCADE |
| importer | CharField | importer class path |
| import_order | IntegerField | |
| is_enabled | BooleanField | |

**Constraints:** UNIQUE(odk_form, importer), UNIQUE(odk_form, import_order)

### etl_documents
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| name | CharField | NOT NULL |
| version | CharField | |
| source_root | CharField | |

### etl_mappings
| Column | Type | Constraints |
|--------|------|-------------|
| id | BigAutoField | PK |
| etl_document_id | ForeignKey(EtlDocument) | NOT NULL, ON DELETE CASCADE |
| source_name | CharField | source field path |
| target_name | CharField | target model field |
| target_type | CharField | TypeCode choice |
| transform | CharField | nullable |
| is_primary_key | BooleanField | |
| is_enabled | BooleanField | |
| is_required | BooleanField | |

## Relationship Summary

```
Province 1──* Cluster 1──* Area
                      1──* Staff (CSA)
Province 1──* Staff (VA)

Cluster + Area + Staff ──* Event
Event 1──* Baby (CASCADE)
Event 1──* Death (CASCADE)
Event 1──* Pregnancy (CASCADE)
Death 1──1 VerbalAutopsy

Cluster + Area + Staff ──* Household
Household 1──* HouseholdMember (CASCADE)

OdkProject 1──* OdkForm 1──* OdkFormImporter 1──* OdkFormImporterJob
OdkForm 1──* EtlDocument 1──* EtlMapping
OdkEntityList 1──* OdkEntityListExporter 1──* OdkEntityListExporterJob
```

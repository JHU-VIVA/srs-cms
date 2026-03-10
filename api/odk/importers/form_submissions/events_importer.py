from api.odk.importers.form_submissions.form_submission_importer_base import FromSubmissionImporterBase
from api.odk.dev.reference_resolver import ReferenceResolver
from api.models import Event, Cluster, Area, Staff
from config.env import Env


class EventsImporter(FromSubmissionImporterBase):
    def __init__(self, odk_form, odk_form_importer, **kwargs):
        super().__init__(odk_form, odk_form_importer, **kwargs)

    def execute(self):
        try:
            if self.validate_before_execute():
                self.import_submissions(Event)
        except Exception as ex:
            self.result.error('Error executing {}.'.format(self.__class__.__name__), error=ex, console=True)
        return self.result

    def on_before_save_model(self, new_event, etl_record, form_submission):
        use_existing_if_missing = Env.get("DEV_ODK_IMPORT_USE_EXISTING_IF_MISSING", cast=bool, default=False)
        try:
            cluster = Cluster.find_by(code=new_event.cluster_code)
            area = Area.find_by(code=new_event.area_code)
            event_staff = Staff.find_by(code=new_event.staff_code)

            if use_existing_if_missing:
                if not cluster:
                    cluster = ReferenceResolver.resolve_cluster(new_event.cluster_code)
                if not area:
                    area = ReferenceResolver.resolve_area(new_event.area_code, cluster)
                if not event_staff:
                    event_staff = ReferenceResolver.resolve_staff(new_event.staff_code, cluster)

            errors = []
            if cluster is None:
                errors.append(f"Cluster not found: {new_event.cluster_code or 'NULL'}")
            if area is None:
                errors.append(f"Area not found: {new_event.area_code or 'NULL'}")
            if event_staff is None:
                errors.append(f"Staff not found: {new_event.staff_code or 'NULL'}")

            if not errors:
                new_event.cluster = cluster
                new_event.area = area
                new_event.event_staff = event_staff
                return True
            else:
                self.result.error(f"Event: {new_event.key}, " + ", ".join(errors))
                return False
        except Exception as ex:
            self.result.error('Error executing {}.on_before_save_model.'.format(self.__class__.__name__),
                              error=ex, console=True)
            return False

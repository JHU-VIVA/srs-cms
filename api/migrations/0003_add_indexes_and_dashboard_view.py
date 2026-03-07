from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_add_gin_index_mother_name'),
    ]

    operations = [
        migrations.RunSQL(
            sql='CREATE INDEX idx_events_type_outcome_date ON events (event_type, preg_outcome_date);',
            reverse_sql='DROP INDEX IF EXISTS idx_events_type_outcome_date;',
        ),
        migrations.RunSQL(
            sql='CREATE INDEX idx_events_type_id_desc ON events (event_type, id DESC);',
            reverse_sql='DROP INDEX IF EXISTS idx_events_type_id_desc;',
        ),
    ]

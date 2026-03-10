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
        migrations.RunSQL(
            sql="""
                CREATE MATERIALIZED VIEW dashboard_stats AS

                SELECT 'pregnancy_outcomes_total' AS metric, c.province_id, COUNT(*) AS count
                FROM events e JOIN clusters c ON e.cluster_id = c.id
                WHERE e.event_type = 2
                GROUP BY c.province_id
                UNION ALL
                SELECT 'pregnancy_outcomes_total', NULL, COUNT(*)
                FROM events WHERE event_type = 2

                UNION ALL

                SELECT 'deaths_total', c.province_id, COUNT(*)
                FROM deaths d JOIN events e ON d.event_id = e.id JOIN clusters c ON e.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'deaths_total', NULL, COUNT(*) FROM deaths

                UNION ALL

                SELECT 'households_total', c.province_id, COUNT(*)
                FROM households h JOIN clusters c ON h.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'households_total', NULL, COUNT(*) FROM households

                UNION ALL

                SELECT 'household_members_total', c.province_id, COUNT(*)
                FROM household_members hm JOIN households h ON hm.household_id = h.id JOIN clusters c ON h.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'household_members_total', NULL, COUNT(*) FROM household_members

                UNION ALL

                SELECT 'babies_total', c.province_id, COUNT(*)
                FROM babies b JOIN events e ON b.event_id = e.id JOIN clusters c ON e.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'babies_total', NULL, COUNT(*) FROM babies

                UNION ALL

                SELECT 'verbal_autopsies_total', c.province_id, COUNT(*)
                FROM verbal_autopsies va JOIN clusters c ON va.cluster_id = c.id
                GROUP BY c.province_id
                UNION ALL
                SELECT 'verbal_autopsies_total', NULL, COUNT(*) FROM verbal_autopsies;
            """,
            reverse_sql='DROP MATERIALIZED VIEW IF EXISTS dashboard_stats;',
        ),
    ]

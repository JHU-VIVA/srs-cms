from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Refresh the dashboard_stats materialized view'

    def handle(self, *args, **kwargs):
        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW dashboard_stats;')
        self.stdout.write(self.style.SUCCESS('dashboard_stats refreshed'))

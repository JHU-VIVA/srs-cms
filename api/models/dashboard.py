from django.db import models


class DashboardStat(models.Model):
    metric = models.CharField(max_length=50, primary_key=True)
    province_id = models.IntegerField(null=True)
    count = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'dashboard_stats'

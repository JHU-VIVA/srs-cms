from api.models import Province, Cluster, Area, Staff


class ReferenceResolver:
    DEFAULT_PROVINCE_CODE = "IM"
    DEFAULT_PROVINCE_NAME = "Imported"

    @classmethod
    def resolve_cluster(cls, code):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        cluster = Cluster.find_by(code=code)
        if cluster:
            return cluster
        province = cls._get_or_create_province()
        cluster = Cluster.objects.create(
            code=code,
            name=f"Imported-{code}",
            province=province,
        )
        return cluster

    @classmethod
    def resolve_area(cls, code, cluster):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        area = Area.find_by(code=code)
        if area:
            return area
        if not cluster:
            return None
        area = Area.objects.create(code=code, cluster=cluster)
        return area

    @classmethod
    def resolve_staff(cls, code, cluster):
        if not code or not str(code).strip():
            return None
        code = str(code).strip()
        staff = Staff.find_by(code=code)
        if staff:
            return staff
        if not cluster:
            return None
        staff = Staff.objects.create(
            code=code,
            staff_type=Staff.StaffType.CSA,
            full_name=f"Imported-{code}",
            cluster=cluster,
        )
        return staff

    @classmethod
    def _get_or_create_province(cls):
        if Province.objects.count() == 1:
            return Province.objects.first()
        province = Province.find_by(code=cls.DEFAULT_PROVINCE_CODE)
        if not province:
            province = Province.objects.create(
                code=cls.DEFAULT_PROVINCE_CODE,
                name=cls.DEFAULT_PROVINCE_NAME,
            )
        return province

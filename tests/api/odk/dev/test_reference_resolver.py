import pytest
from api.odk.dev.reference_resolver import ReferenceResolver
from api.models import Province, Cluster, Area, Staff


@pytest.mark.django_db
class TestReferenceResolver:

    def test_resolve_cluster_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", name="Cluster 1", province=province)
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved == cluster

    def test_resolve_cluster_creates_missing(self):
        assert not Cluster.objects.filter(code="CL001").exists()
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved is not None
        assert resolved.code == "CL001"
        assert resolved.province is not None
        assert Province.objects.filter(code="IM").exists()

    def test_resolve_cluster_uses_existing_province_if_only_one(self):
        province = Province.objects.create(code="P1", name="Province 1")
        resolved = ReferenceResolver.resolve_cluster("CL001")
        assert resolved.province == province

    def test_resolve_cluster_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_cluster(None) is None
        assert ReferenceResolver.resolve_cluster("") is None

    def test_resolve_area_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        area = Area.objects.create(code="AR001", cluster=cluster)
        resolved = ReferenceResolver.resolve_area("AR001", cluster)
        assert resolved == area

    def test_resolve_area_creates_missing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_area("AR001", cluster)
        assert resolved is not None
        assert resolved.code == "AR001"
        assert resolved.cluster == cluster

    def test_resolve_area_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_area(None, None) is None

    def test_resolve_staff_finds_existing(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        staff = Staff.objects.create(code="ST001", staff_type=Staff.StaffType.CSA, cluster=cluster)
        resolved = ReferenceResolver.resolve_staff("ST001", cluster)
        assert resolved == staff

    def test_resolve_staff_creates_missing_csa(self):
        province = Province.objects.create(code="P1", name="Province 1")
        cluster = Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_staff("ST001", cluster)
        assert resolved is not None
        assert resolved.code == "ST001"
        assert resolved.staff_type == Staff.StaffType.CSA
        assert resolved.cluster == cluster

    def test_resolve_staff_returns_none_for_empty_code(self):
        assert ReferenceResolver.resolve_staff(None, None) is None

    def test_resolve_cluster_strips_whitespace(self):
        province = Province.objects.create(code="P1", name="Province 1")
        Cluster.objects.create(code="CL001", province=province)
        resolved = ReferenceResolver.resolve_cluster("  CL001  ")
        assert resolved.code == "CL001"

    def test_resolve_cluster_idempotent(self):
        resolved1 = ReferenceResolver.resolve_cluster("CL001")
        resolved2 = ReferenceResolver.resolve_cluster("CL001")
        assert resolved1.id == resolved2.id
        assert Cluster.objects.filter(code="CL001").count() == 1

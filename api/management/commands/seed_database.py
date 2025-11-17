from django.core.management.base import BaseCommand
from api.data.seeds.seed_loader import SeedLoader
from config.env import Env


class Command(BaseCommand):
    help = 'Seed the Database.'

    def add_arguments(self, parser):
        parser.add_argument('-s', '--stage',
                            default=Env.app_stage() or SeedLoader.DEV,
                            choices=SeedLoader.STAGES,
                            help='Which application stage files to use.')

        parser.add_argument('--with-test-data',
                            default=False,
                            action='store_true',
                            help='Load test data.')

    def handle(self, *args, **kwargs):
        stage = kwargs['stage']
        with_test_data = kwargs['with_test_data']
        SeedLoader(stage=stage).seed_all(with_test_data=with_test_data)

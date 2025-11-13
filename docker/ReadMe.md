# Initial Setup

- Git clone the `srs-cms` repository or download the code.
- Change to the project directory: `cd srs-cms`
- Copy the production docker environment file: `cp docker/production/env.template docker/production/env`
- Edit `docker/production/env` and set the variables for your environment.
- Edit `docker/production/nginx.config` for your environment.
- Configure the seed data files in: `api/data/seeds/production/`.
    - See [api/data/seeds/README.md](../api/data/seeds/README.md) for details.
- Build the docker image: `make docker_compose_build`
- Start the app: `make docker_compose_up`
- Create a superuser: `make docker_createsuperuser`

# Start/Stop the App

- Start: `make docker_compose_up`
    - App URL: [http://localhost](http://localhost)
- Stop: `make docker_compose_down`

# Misc. Commands

- Get a shell in the `web` container: `make docker_bash`
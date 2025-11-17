# Initial Setup

> Replace `$APP_STAGE` below with `staging` or `production`

- Git clone the `srs-cms` repository or download the code.
- Change to the project docker directory: `cd srs-cms/docker`
- Copy the docker environment file: `cp .env.template .env.$APP_STAGE`
- Copy the nginx config file: `cp nginx.template.conf nginx.$APP_STAGE.conf`
- Edit `.env.$APP_STAGE` and set the variables for your environment.
- Edit `nginx.$APP_STAGE.config` for your environment.
- Configure the seed data files in: `api/data/seeds/$APP_STAGE`.
    - See [api/data/seeds/README.md](../api/data/seeds/README.md) for details.
- Build the docker image: `make build`
- Start the app: `make up`
- Create a superuser: `make createsuperuser`

# Start/Stop the App

- Start: `make up`
    - App URL: [http://localhost](http://localhost)
- Stop: `make down`

# Misc. Commands

- Import Form Submissions: `make odk_import_form_submissions`
- Export Entity Lists: `make odk_export_entity_lists`
- Get a shell in the `web` container: `make bash`

# Target a different configuration

- Override `$APP_STAGE` when calling the make commands:
    - `make build APP_STAGE=staging`
    - `make up APP_STAGE=staging`
    - `make down APP_STAGE=staging`
    - `make odk_import_form_submissions APP_STAGE=staging`
    - `make odk_export_entity_lists APP_STAGE=staging`
    - `make bash APP_STAGE=staging`
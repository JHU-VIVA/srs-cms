###################################################################################################
# Docker
###################################################################################################
APP_STAGE ?= production
ENV_FILE ?= .env.$(APP_STAGE)

# Build docker image.
.PHONY: ps
ps:
	docker ps

# Build docker image.
.PHONY: build
build:
ifeq ($(OS),Windows_NT)
	PowerShell -ExecutionPolicy Bypass -File ..\scripts\run_with_env.ps1 $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) build
else
	../scripts/run_with_env.sh $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) build
endif


# Start docker.
.PHONY: up
up:
ifeq ($(OS),Windows_NT)
	PowerShell -ExecutionPolicy Bypass -File ..\scripts\run_with_env.ps1 $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) up -d
else
	../scripts/run_with_env.sh $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) up -d
endif


# Stop docker.
.PHONY: down
down:
ifeq ($(OS),Windows_NT)
	PowerShell -ExecutionPolicy Bypass -File ..\scripts\run_with_env.ps1 $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) down
else
	../scripts/run_with_env.sh $(ENV_FILE) docker compose -f docker-compose.yml --project-name srs-cms-$(APP_STAGE) down
endif


# Run docker migrations.
.PHONY: migrate
migrate:
	docker exec -it $(APP_STAGE)-srs-cms-web make migrate


# Create super user in docker.
.PHONY: createsuperuser
createsuperuser:
	docker exec -it $(APP_STAGE)-srs-cms-web make createsuperuser


# Import docker Form Submissions from ODK starting from the last imported date.
.PHONY: odk_import_form_submissions
odk_import_form_submissions:
	docker exec -it $(APP_STAGE)-srs-cms-web make odk_import_form_submissions


# Export docker Entity Lists to ODK.
.PHONY: odk_export_entity_lists
odk_export_entity_lists:
	docker exec -it $(APP_STAGE)-srs-cms-web make odk_export_entity_lists


# Connect to web container in docker.
.PHONY: bash
bash:
	docker exec -it $(APP_STAGE)-srs-cms-web bash

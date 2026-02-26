# SRS-CMS — Sample Registration System Content Management System

This is a **death surveillance and verbal autopsy management system** built with Django + React, designed for field data collection workflows integrated with **ODK Central** (Open Data Kit).

## Purpose

Manages the lifecycle of death records collected by field workers:

1. **Field workers** collect death/household data via ODK mobile forms
2. **Data imports** from ODK Central into Django via scheduled cron jobs
3. **Web interface** lets staff review new deaths, schedule verbal autopsy (VA) interviews, and track completion

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, Django 5.2.8, Django Ninja (REST API) |
| **Frontend (SPA)** | React 19, TypeScript, Vite, TailwindCSS + DaisyUI |
| **Frontend (legacy)** | Django templates with TailwindCSS + DaisyUI |
| **Database** | PostgreSQL 16 with trigram search |
| **Infrastructure** | Docker Compose (web, db, nginx, cron) |
| **Data Collection** | pyODK integration with ODK Central |

## Key Modules

- **`api/`** — Django app with models (Death, Event, Household, VerbalAutopsy, etc.), Django Ninja REST API, ODK importers/exporters, and ETL pipeline
- **`frontend/`** — React SPA with pages for login, dashboard, death records management (filtering, search, pagination, VA scheduling)
- **`client/`** — Traditional Django template-based views (older UI)
- **`config/`** — Django project settings
- **`docker/`** — Multi-container deployment (web + db + nginx + cron)

## Core Workflow

**Deaths flow through statuses:** New Death → VA Scheduled → VA Completed → VA On Hold

The API supports paginated, filterable death listings with **trigram similarity search** across names, codes, and areas. A permission system controls access by province assignment.

## Data Model Highlights

- **Geographic hierarchy:** Province → Cluster → Area
- **Staff** (field workers) assigned to clusters
- **Events** capture field visits (pregnancies, births, deaths)
- **ODK integration** via configurable importers/exporters with ETL mapping documents

## Infrastructure

Docker Compose orchestrates 4 services: PostgreSQL, Django/Gunicorn, Nginx reverse proxy, and a cron container for scheduled ODK imports/exports. The Makefile provides commands for database ops, ODK syncing, and deployment.

# FYP Software Monorepo

This repository contains the complete Final Year Project system in one place:

- `Backend/`: Go + Python microservices (ingestion, routing, AQI scraper, Redis, TimescaleDB)
- `weighted-routing-app/`: React frontend

## What Was Fixed

The frontend was previously linked as a nested Git repository (gitlink/submodule-like behavior). It is now structured to be tracked as normal files inside this single repo, so cloning this repository gives the full project.

## Prerequisites

- Git
- Docker Desktop (recommended path)
- Node.js 18+ and npm

## Quick Start (Recommended)

1. Clone this repo:

```bash
git clone https://github.com/<your-username>/FYP-software.git
cd FYP-software
```

2. Start backend services:

```bash
cd Backend
docker compose up --build -d
cd ..
```

3. Start frontend:

```bash
cd weighted-routing-app
# create .env from .env.example (set API keys if needed)
npm install
npm start
```

4. Open app:

- Frontend: `http://localhost:3000`
- Routing API: `http://localhost:8000`
- Ingestion API: `http://localhost:8080`
- AQI Scraper API: `http://localhost:8082`

## Minimal Frontend Environment

Create `weighted-routing-app/.env` from `weighted-routing-app/.env.example` and verify these values:

```env
REACT_APP_ROUTING_API_URL=http://localhost:8000
REACT_APP_INGESTION_API_URL=http://localhost:8080
REACT_APP_AQI_SCRAPER_URL=http://localhost:8082
REACT_APP_ROUTING_MODE=backend
REACT_APP_ORS_API_KEY=your_api_key_here
```

## Project Docs

- Backend docs: `Backend/README.md`
- Frontend docs: `weighted-routing-app/README.md`
- Full system description: `FYP_SUPER_MASTER_SYSTEM_DESCRIPTION.txt`

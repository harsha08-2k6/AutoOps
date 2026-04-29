# AutoOps

AutoOps is a real-time DevOps dashboard that monitors and manages Docker containers using:
- React frontend
- Node.js/Express backend
- Socket.IO live updates
- Docker API through `dockerode`
- Rule-based automation and optional email alerts

## Project Structure

- `client/`: React app and dashboard components
- `server/`: API, Docker integration, rule engine, websocket emitter
- `docker-compose.yml`: Local multi-service setup
- `.env.example`: Required environment variables

## Quick Start

1. Copy env template:
   - `cp .env.example .env` (Linux/macOS) or duplicate manually on Windows.
2. Install all dependencies:
   - `npm install`
   - `npm install --prefix server`
   - `npm install --prefix client`
3. Run locally:
   - `npm run dev`
4. Open dashboard:
   - `http://localhost:5173`

Server API default:
- `http://localhost:4000/api/services`

## API Endpoints

- `GET /api/services` - list Docker containers
- `GET /api/logs/:id` - fetch container logs
- `GET /api/stats/:id` - fetch one-shot container CPU/memory stats
- `GET /api/rules` - get active rule config
- `PUT /api/rules` - update rule config

## Socket Events

- `containers:update` - periodic container payload updates
- `containers:error` - polling/runtime errors

## Rule Engine Behavior

- Auto-restarts containers in `exited` state when enabled.
- Uses cooldown (`restartCooldownMs`) to prevent flapping restart loops.
- Triggers email alerts when auto-restart actions occur.
- Rule settings are persisted in `server/.data/rules.json`.

## Email Alerts

Configure SMTP values in `.env`:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `ALERT_EMAIL_FROM`
- `ALERT_EMAIL_TO`

If SMTP settings are absent, alert sending is skipped safely.

## Docker Compose

Run:
- `docker compose up`

Notes:
- Server mounts Docker socket at `/var/run/docker.sock`.
- On Windows, Docker Desktop + WSL integration may be required for socket access.

## Steps To Make The Project Better

1. Add authentication and role-based access
   - Protect API and Socket.IO endpoints with JWT/session auth.
   - Add admin/operator roles for rule changes and restart actions.

2. Persist rules and history
   - Store rule config in a database (SQLite/PostgreSQL) instead of memory.
   - Save action history (restarts, alerts, failures) for auditability.

3. Improve observability
   - Add structured logging (`pino`/`winston`) with request IDs.
   - Expose health and metrics endpoints (`/health`, `/metrics` with Prometheus format).
   - Add dashboard cards for restart counts and recent failures.

4. Harden runtime safety
   - Add retry and timeout wrappers around Docker calls.
   - Add circuit-breaker/rate limits for noisy containers.
   - Validate API inputs with a schema validator (e.g. `zod`/`joi`).

5. Add automated tests
   - Unit tests for `ruleEngine`, `alertService`, and API handlers.
   - Integration tests for socket update pipeline and rule execution.
   - Frontend component tests for `RuleBuilder`, `LogsViewer`, and event handling.

6. Productionize deployment
   - Add multi-stage Dockerfiles for client and server.
   - Add CI pipeline for lint, test, build, image publish.
   - Add environment-specific config and secrets management.

7. Improve UX and reliability in UI
   - Add loading/error empty states for services, logs, and stats panels.
   - Add auto-refresh indicators and connection status.
   - Add filters/search for containers and better logs pagination.

# Reporting

CyberSim supports structured training exports in JSON and CSV.

## JSON export

Endpoint: `GET /api/report/export/json`

Includes:

- generation timestamp
- current readiness score
- totals (events, sessions, completions, passes)
- full instructor session data
- full event data

Use this for archival, analytics pipelines, or custom dashboards.

## CSV export

Endpoint: `GET /api/report/export/csv?scope=<sessions|events>`

Scopes:

- `scope=sessions`: instructor session summary
- `scope=events`: event timeline with serialized details

Use this for spreadsheet review and quick audit trails.

## Recommended reporting workflow

1. Run a full lab cycle.
2. Evaluate and close the instructor session.
3. Export JSON for evidence storage.
4. Export CSV for management review.

## One-click download behavior

The UI export buttons now immediately download files:

- `cybersim-report-<timestamp>.json`
- `cybersim-sessions.csv`
- `cybersim-events.csv`

In GitHub Pages mode, exports are generated from browser-local simulation state.

# CyberSim Sandbox

Advanced local cybersecurity training lab for defensive teams.

by Influence

## Why this is different

This project is built to teach, not just simulate attacks.

Each simulation returns:

- Analyst debrief narrative
- Risk level and MITRE ATT&CK mapping
- Defensive control recommendations
- Analyst reflection prompts
- Live readiness score impact

## Core systems

- Fake login panel and auth API: `/api/auth/login`
- Fake lookup API with injection guard: `/api/users`
- Brute force simulation + debrief: `/api/simulate/bruteforce`
- Phishing campaign simulation + debrief: `/api/simulate/phishing`
- Injection simulation + debrief: `/api/simulate/injection`
- Guided module catalog: `/api/learning/modules`
- Instructor lab definitions: `/api/instructor/labs`
- Instructor rubric config: `/api/instructor/rubric`
- Instructor session control: `/api/instructor/session/start`, `/api/instructor/sessions`
- Instructor grading: `/api/instructor/session/:sessionId/evaluate`
- Report export (JSON/CSV): `/api/report/export/json`, `/api/report/export/csv`
- Event feed: `/api/events`
- Live scorecard: `/api/status`

## Learning model

The lab currently teaches three tracks:

- Brute force defense engineering
- Phishing exposure and response
- Injection detection and hardening

Each track includes telemetry expectations, success criteria, and ATT&CK context.

## Safety

- Local-only operation
- Fake systems and fake identities
- No payload execution framework
- No persistence, beaconing, or lateral movement
- Intended for legal defensive training and SOC readiness practice

## Run

```bash
npm install
npm start
```

Open http://localhost:3000

## GitHub Pages support

This project now works in two runtime modes:

- `Server API Mode` (Node/Express)
- `Local Browser Mode` (no backend, GitHub Pages compatible)

On GitHub Pages, the app auto-detects missing backend endpoints and runs the full simulator client-side with browser `localStorage` persistence.

The workflow file [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) deploys the [public/index.html](public/index.html) app.

## Rubric and Downloads

- Instructor rubric editor controls checkpoint weight, time bonus, pass threshold, and lockout threshold.
- Export buttons now generate immediate file downloads:
  - JSON report
  - CSV sessions
  - CSV events

## Fake credentials

- admin / P@ssw0rd!
- analyst / BlueTeam123
- guest / guest

## Documentation

- [docs/TRAINING_GUIDE.md](docs/TRAINING_GUIDE.md)
- [docs/SCENARIO_PLAYBOOK.md](docs/SCENARIO_PLAYBOOK.md)
- [docs/INSTRUCTOR_MODE.md](docs/INSTRUCTOR_MODE.md)
- [docs/REPORTING.md](docs/REPORTING.md)
- [docs/CREDITS.md](docs/CREDITS.md)

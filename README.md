# CyberSim Sandbox

Advanced local cybersecurity training lab for defensive teams.

by Influence

## Platform update (v2 experience)

CyberSim now includes a complete challenge platform UX with:

- Red Team / Blue Team mode switching
- Learning paths and level progression
- XP + badges + weak-area tracking
- Beginner-friendly CTF-style tasks in realistic simulations

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

## New challenge modules

- Fake terminal attack scenarios
- Vulnerable login lab (SQLi, weak password, no rate-limit simulation)
- Vulnerable mini-web labs (XSS, CSRF, upload bypass)
- File system explorer
- Phishing detection game
- Password cracking simulator
- Basic network scan and attack-choice panel
- Payload playground
- Progress tracker and challenge levels

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
- [docs/LEARNING_PATHS.md](docs/LEARNING_PATHS.md)
- [docs/CHALLENGE_MODULES.md](docs/CHALLENGE_MODULES.md)
- [docs/CREDITS.md](docs/CREDITS.md)

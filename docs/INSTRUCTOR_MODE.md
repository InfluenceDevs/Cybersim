# Instructor Mode

Instructor Mode turns CyberSim into a timed lab platform with checkpoint-based grading.

## Endpoints

- `GET /api/instructor/labs`: list available lab templates
- `GET /api/instructor/rubric`: get active grading rubric
- `POST /api/instructor/rubric`: update grading rubric
- `POST /api/instructor/session/start`: start a timed session
- `GET /api/instructor/sessions`: list active and completed sessions
- `POST /api/instructor/session/:sessionId/evaluate`: grade checkpoint pass/fail
- `POST /api/instructor/session/:sessionId/close`: close a session

## Session model

Each session contains:

- Lab metadata (id, title, scenario)
- Analyst name
- Start time and duration
- Checkpoint list with pass status
- Score and pass/fail result
- Time state (`elapsedMinutes`, `remainingMinutes`, `expired`)

## Scoring rubric

- 30 points per passed checkpoint
- 10-point time bonus when completed within duration
- Pass is threshold-based (`passThreshold`)

Rubric fields:

- `checkpointWeight`
- `timeBonus`
- `passThreshold`
- `lockoutThreshold`

## Suggested facilitation pattern

1. Start session with defined analyst team.
2. Let trainees run relevant simulations.
3. Evaluate at checkpoints every 5 minutes.
4. Debrief score and missed checkpoints.
5. Close session and export report.

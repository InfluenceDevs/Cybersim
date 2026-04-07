# Training Guide

CyberSim is designed as a blue-team learning environment.

## Training workflow

1. Start with scorecard baseline using `/api/status`.
2. Run one simulation type.
3. Read the returned `debrief` object.
4. Identify control gaps and remediation choices.
5. Re-run the simulation and compare readiness score.

## Debrief fields

- `lesson`: one-line objective for the defender
- `attackNarrative`: plain-language summary of activity
- `riskLevel`: LOW, MEDIUM, HIGH
- `mitre`: ATT&CK mapping for detection engineering context
- `analystPrompts`: reflection questions for analysts
- `recommendedControls`: actionable hardening steps

## Suggested classroom use

- Pair analysts in attacker/defender roles.
- Require a written triage summary per run.
- Grade by: detection quality, prioritization, and remediation quality.

## Outcome expectations

By the end of a session, learners should be able to:

- Explain why controls failed or succeeded.
- Map events to ATT&CK techniques.
- Propose practical hardening actions with verification steps.

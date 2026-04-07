# Scenario Playbook

## Scenario 1: Credential Stuffing Pressure

Goal: Validate lockout and adaptive controls.

1. Run brute force simulation against `admin` with high attempts.
2. Confirm lock state and risk output in debrief.
3. Discuss false-positive and account denial risks.

Success signal: attack interrupted before successful compromise.

## Scenario 2: Social Engineering Drift

Goal: Measure behavioral exposure.

1. Launch phishing simulation with 8-20 fake targets.
2. Inspect click and credential capture rates.
3. Assign containment actions based on highest-risk users.

Success signal: clear response sequence for compromised credentials.

## Scenario 3: Input Validation Validation

Goal: Ensure payloads are classified and blocked.

1. Test SQLi payloads and then XSS payloads.
2. Verify classification and block behavior in response.
3. Record which control layer blocked the request.

Success signal: no unsafe payload reaches business logic.

## Analyst checklist

- Did we collect enough telemetry to prove what happened?
- Can we map findings to ATT&CK for reporting consistency?
- What control change has the highest risk-reduction value?
- How will we test that fix in CI or staging?

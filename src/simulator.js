function createEvent(type, details) {
  return {
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type,
    details,
    timestamp: new Date().toISOString(),
  };
}

function shouldLockAccount(currentFailures, threshold = 5) {
  return currentFailures >= threshold;
}

function pickPassword(attempt) {
  const list = [
    "123456",
    "password",
    "admin",
    "letmein",
    "qwerty",
    "P@ssw0rd!",
    "BlueTeam123",
  ];
  return list[(attempt - 1) % list.length];
}

function smallHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function evaluatePhishingTarget(email, lureType) {
  const hash = smallHash(`${email}:${lureType}`);
  const clicked = hash % 100 < 55;
  const submittedCredentials = clicked && hash % 100 < 28;

  return {
    email,
    clicked,
    submittedCredentials,
    riskScore: (hash % 100) + 1,
  };
}

function detectInjectionType(payload) {
  const value = payload.toLowerCase();

  const sql = /('|"|`)?\s*(or|and)\s+\d+=\d+|union\s+select|drop\s+table|--|;/.test(value);
  if (sql) {
    return "SQLI";
  }

  const xss = /<script|onerror=|onload=|javascript:/.test(value);
  if (xss) {
    return "XSS";
  }

  const cmd = /\|\||&&|\b(cat|ls|curl|wget|powershell|cmd\.exe)\b/.test(value);
  if (cmd) {
    return "CMD_INJECTION";
  }

  return "NONE";
}

function getLearningModules() {
  return [
    {
      id: "bruteforce-defense",
      title: "Brute Force Defense Engineering",
      attackType: "Brute Force",
      mitre: ["T1110", "Credential Access"],
      objectives: [
        "Tune lockout and rate-limiting thresholds.",
        "Correlate failed logins with source behavior.",
        "Design a low-noise SIEM detection rule.",
      ],
      telemetry: [
        "auth.failed_count_per_user",
        "auth.failed_count_per_source",
        "auth.lockout_events",
      ],
      successCriteria: [
        "Attack is interrupted before credential success.",
        "Lockouts are reversible via approved workflow.",
        "Analyst can explain why alert severity changed.",
      ],
    },
    {
      id: "phishing-response",
      title: "Phishing Exposure and Response",
      attackType: "Phishing",
      mitre: ["T1566", "Initial Access"],
      objectives: [
        "Measure click-through and credential submission risk.",
        "Prioritize users for awareness coaching.",
        "Build containment playbooks for compromised accounts.",
      ],
      telemetry: [
        "mail.link_click_events",
        "idp.suspicious_login",
        "helpdesk.credential_reset_requests",
      ],
      successCriteria: [
        "High-risk users are identified with evidence.",
        "Response actions are sequenced and documented.",
        "Post-incident controls reduce replay risk.",
      ],
    },
    {
      id: "injection-hardening",
      title: "Injection Detection and Hardening",
      attackType: "Injection",
      mitre: ["T1190", "Initial Access"],
      objectives: [
        "Differentiate SQLi, XSS, and command injection indicators.",
        "Validate WAF/input-validation effectiveness.",
        "Define patch and verification workflow.",
      ],
      telemetry: [
        "waf.block_events",
        "api.bad_request_signatures",
        "app.validation_failures",
      ],
      successCriteria: [
        "Payload blocked before reaching business logic.",
        "Detection includes payload class and vector.",
        "Fix recommendation maps to secure coding control.",
      ],
    },
  ];
}

function buildBruteforceDebrief(username, summary, sequence) {
  const lockoutWorked = summary.locked;
  const credentialCompromise = summary.success;
  const lastAttempt = sequence[sequence.length - 1];

  return {
    lesson: "Brute force resilience improves when lockout and detection move together.",
    attackNarrative: `A password guessing sequence targeted ${username} for ${summary.totalAttempted} attempts.`,
    defensiveOutcome: lockoutWorked
      ? "Lockout control interrupted repeated credential guessing."
      : "No lockout observed during this run.",
    riskLevel: credentialCompromise ? "HIGH" : lockoutWorked ? "LOW" : "MEDIUM",
    mitre: ["T1110", "Credential Access"],
    analystPrompts: [
      "Would adaptive MFA trigger after abnormal failure velocity?",
      "Do lockouts create a denial-of-service risk for valid users?",
      "Is alerting based on user, IP, and ASN dimensions?",
    ],
    recommendedControls: [
      "Progressive delay and IP/device rate limiting.",
      "Conditional MFA when failure velocity spikes.",
      "SIEM correlation across account and source entities.",
    ],
    finalAttemptCode: lastAttempt ? lastAttempt.code : "NO_ATTEMPTS",
  };
}

function buildPhishingDebrief(result) {
  const clickRate = result.sent ? result.clicked / result.sent : 0;
  const captureRate = result.sent ? result.credentialsCaptured / result.sent : 0;

  return {
    lesson: "Phishing defense depends on behavior analytics plus rapid credential containment.",
    attackNarrative: `Campaign \"${result.campaign}\" used lure \"${result.lureType}\" across ${result.sent} recipients.`,
    metrics: {
      clickRate,
      credentialCaptureRate: captureRate,
    },
    riskLevel: captureRate >= 0.2 ? "HIGH" : clickRate >= 0.5 ? "MEDIUM" : "LOW",
    mitre: ["T1566", "Initial Access"],
    analystPrompts: [
      "Which users need immediate password reset and token revocation?",
      "Was impossible-travel or anomalous login detection triggered?",
      "What preventive control could reduce this lure's success?",
    ],
    recommendedControls: [
      "Phishing-resistant MFA and conditional access.",
      "Secure email gateway with URL rewriting and detonation.",
      "Targeted awareness follow-up for high-risk users.",
    ],
  };
}

function buildInjectionDebrief(result) {
  return {
    lesson: "Injection defense is strongest when validation, encoding, and execution boundaries are all enforced.",
    attackNarrative: `Payload tested against vector \"${result.vector}\" and classified as ${result.payloadType}.`,
    riskLevel: result.blocked ? "LOW" : result.payloadType === "NONE" ? "LOW" : "HIGH",
    mitre: ["T1190", "Initial Access"],
    analystPrompts: [
      "If WAF failed, what server-side validation still blocks payload execution?",
      "Are parameterized queries enforced for all database paths?",
      "Can this vector be covered by fuzz tests in CI?",
    ],
    recommendedControls: [
      "Centralized input schema validation.",
      "Prepared statements and strict query parameterization.",
      "Output encoding for browser-rendered content.",
    ],
  };
}

function calculateReadinessScore(events) {
  const recent = events.slice(0, 50);
  let score = 50;

  for (const event of recent) {
    if (event.type === "injection_simulation") {
      score += event.details.blocked ? 8 : -12;
    }

    if (event.type === "bruteforce_simulation") {
      score += event.details.locked ? 8 : -8;
      score += event.details.success ? -10 : 6;
    }

    if (event.type === "phishing_simulation") {
      const sent = Math.max(Number(event.details.sent || 0), 1);
      const captureRatio = Number(event.details.credentialsCaptured || 0) / sent;
      score += captureRatio >= 0.2 ? -12 : captureRatio > 0 ? -6 : 5;
    }
  }

  const bounded = Math.max(0, Math.min(100, score));
  const tier = bounded >= 80 ? "HARDENED" : bounded >= 60 ? "IMPROVING" : "AT_RISK";
  return { score: bounded, tier, samples: recent.length };
}

module.exports = {
  createEvent,
  shouldLockAccount,
  pickPassword,
  evaluatePhishingTarget,
  detectInjectionType,
  getLearningModules,
  buildBruteforceDebrief,
  buildPhishingDebrief,
  buildInjectionDebrief,
  calculateReadinessScore,
};

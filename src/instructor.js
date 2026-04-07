function getLabDefinitions() {
  return [
    {
      id: "lab-bruteforce",
      title: "Lab 1: Credential Attack Containment",
      durationMinutes: 15,
      scenario: "Validate that brute-force activity is detected and interrupted without credential compromise.",
      checkpoints: [
        {
          id: "cp-bf-run",
          title: "Run brute force simulation",
          description: "At least one brute force simulation event is present.",
          evaluate: (events) => events.some((event) => event.type === "bruteforce_simulation"),
        },
        {
          id: "cp-bf-lock",
          title: "Lockout or throttling observed",
          description: "At least one brute force run shows lockout behavior.",
          evaluate: (events) =>
            events.some(
              (event) => event.type === "bruteforce_simulation" && Boolean(event.details.locked)
            ),
        },
        {
          id: "cp-bf-contain",
          title: "No successful compromise",
          description: "Latest brute force run does not succeed.",
          evaluate: (events) => {
            const latest = events.find((event) => event.type === "bruteforce_simulation");
            return latest ? !latest.details.success : false;
          },
        },
      ],
    },
    {
      id: "lab-phishing",
      title: "Lab 2: Phishing Incident Response",
      durationMinutes: 20,
      scenario: "Analyze campaign impact and practice containment prioritization.",
      checkpoints: [
        {
          id: "cp-ph-run",
          title: "Run phishing simulation",
          description: "At least one phishing simulation event is present.",
          evaluate: (events) => events.some((event) => event.type === "phishing_simulation"),
        },
        {
          id: "cp-ph-metrics",
          title: "Exposure metrics captured",
          description: "Campaign includes sent and clicked metrics.",
          evaluate: (events) => {
            const latest = events.find((event) => event.type === "phishing_simulation");
            return latest
              ? Number.isFinite(Number(latest.details.sent)) && Number.isFinite(Number(latest.details.clicked))
              : false;
          },
        },
        {
          id: "cp-ph-contain",
          title: "Credential capture controlled",
          description: "Credential capture rate remains below 20%.",
          evaluate: (events) => {
            const latest = events.find((event) => event.type === "phishing_simulation");
            if (!latest) {
              return false;
            }
            const sent = Math.max(Number(latest.details.sent || 0), 1);
            const ratio = Number(latest.details.credentialsCaptured || 0) / sent;
            return ratio < 0.2;
          },
        },
      ],
    },
    {
      id: "lab-injection",
      title: "Lab 3: Injection Hardening Validation",
      durationMinutes: 15,
      scenario: "Verify payload classification and blocking behavior before business logic execution.",
      checkpoints: [
        {
          id: "cp-inj-run",
          title: "Run injection simulation",
          description: "At least one injection simulation event is present.",
          evaluate: (events) => events.some((event) => event.type === "injection_simulation"),
        },
        {
          id: "cp-inj-class",
          title: "Payload classified",
          description: "Latest injection event includes payload type classification.",
          evaluate: (events) => {
            const latest = events.find((event) => event.type === "injection_simulation");
            return latest ? latest.details.payloadType && latest.details.payloadType !== "NONE" : false;
          },
        },
        {
          id: "cp-inj-block",
          title: "Malicious payload blocked",
          description: "Latest malicious payload is blocked by simulated defense.",
          evaluate: (events) => {
            const latest = events.find((event) => event.type === "injection_simulation");
            return latest ? Boolean(latest.details.blocked) : false;
          },
        },
      ],
    },
  ];
}

function getDefaultRubric() {
  return {
    checkpointWeight: 30,
    timeBonus: 10,
    passThreshold: 100,
    lockoutThreshold: 5,
  };
}

function sanitizeRubric(input = {}) {
  const defaults = getDefaultRubric();
  return {
    checkpointWeight: Math.max(5, Math.min(50, Number(input.checkpointWeight || defaults.checkpointWeight))),
    timeBonus: Math.max(0, Math.min(30, Number(input.timeBonus || defaults.timeBonus))),
    passThreshold: Math.max(20, Math.min(100, Number(input.passThreshold || defaults.passThreshold))),
    lockoutThreshold: Math.max(2, Math.min(12, Number(input.lockoutThreshold || defaults.lockoutThreshold))),
  };
}

function createLabSession(lab, analyst, durationMinutes) {
  const startedAt = new Date().toISOString();
  const effectiveDuration = Number(durationMinutes) > 0 ? Number(durationMinutes) : lab.durationMinutes;

  return {
    id: `session-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    labId: lab.id,
    labTitle: lab.title,
    analyst,
    scenario: lab.scenario,
    startedAt,
    durationMinutes: effectiveDuration,
    checkpoints: lab.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      title: checkpoint.title,
      description: checkpoint.description,
      passed: false,
      checkedAt: null,
    })),
    status: "ACTIVE",
    score: 0,
    pass: false,
    notes: [],
  };
}

function getSessionEvents(events, session) {
  const startedMs = new Date(session.startedAt).getTime();
  return events.filter((event) => new Date(event.timestamp).getTime() >= startedMs);
}

function evaluateLabSession(session, lab, events, rubric = getDefaultRubric()) {
  const sessionEvents = getSessionEvents(events, session);
  const activeRubric = sanitizeRubric(rubric);

  let passedCount = 0;
  const checkpoints = session.checkpoints.map((checkpointState) => {
    const definition = lab.checkpoints.find((checkpoint) => checkpoint.id === checkpointState.id);
    const passed = definition ? Boolean(definition.evaluate(sessionEvents)) : false;
    if (passed) {
      passedCount += 1;
    }

    return {
      ...checkpointState,
      passed,
      checkedAt: new Date().toISOString(),
    };
  });

  const maxScore = lab.checkpoints.length * activeRubric.checkpointWeight + activeRubric.timeBonus;
  const elapsedMinutes = (Date.now() - new Date(session.startedAt).getTime()) / (1000 * 60);
  const onTimeBonus = elapsedMinutes <= session.durationMinutes ? activeRubric.timeBonus : 0;
  const score = Math.min(maxScore, passedCount * activeRubric.checkpointWeight + onTimeBonus);
  const pass = score >= activeRubric.passThreshold;

  return {
    ...session,
    checkpoints,
    score,
    pass,
    status: pass ? "COMPLETED" : "ACTIVE",
    evaluatedAt: new Date().toISOString(),
    notes: [
      `Passed ${passedCount}/${lab.checkpoints.length} checkpoints.`,
      onTimeBonus > 0 ? "Time bonus awarded." : "No time bonus awarded.",
      `Pass threshold: ${activeRubric.passThreshold}.`,
    ],
    rubric: activeRubric,
  };
}

function getTimeState(session) {
  const durationMs = session.durationMinutes * 60 * 1000;
  const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  return {
    elapsedMinutes: Number((elapsedMs / 60000).toFixed(2)),
    remainingMinutes: Number((remainingMs / 60000).toFixed(2)),
    expired: remainingMs === 0,
  };
}

module.exports = {
  getLabDefinitions,
  getDefaultRubric,
  sanitizeRubric,
  createLabSession,
  evaluateLabSession,
  getSessionEvents,
  getTimeState,
};

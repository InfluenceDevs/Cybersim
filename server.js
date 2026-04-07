const express = require("express");
const path = require("path");
const {
  createEvent,
  detectInjectionType,
  evaluatePhishingTarget,
  pickPassword,
  shouldLockAccount,
  getLearningModules,
  buildBruteforceDebrief,
  buildPhishingDebrief,
  buildInjectionDebrief,
  calculateReadinessScore,
} = require("./src/simulator");
const {
  getLabDefinitions,
  getDefaultRubric,
  sanitizeRubric,
  createLabSession,
  evaluateLabSession,
  getTimeState,
} = require("./src/instructor");
const {
  buildTrainingReport,
  buildSessionSummaryCsv,
  buildEventCsv,
} = require("./src/reporting");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const users = [
  { username: "admin", password: "P@ssw0rd!", role: "admin" },
  { username: "analyst", password: "BlueTeam123", role: "analyst" },
  { username: "guest", password: "guest", role: "guest" },
];

const securityState = {
  failedAttempts: {},
  events: [],
  instructorSessions: [],
  rubric: getDefaultRubric(),
};

function pushEvent(event) {
  securityState.events.unshift(event);
  if (securityState.events.length > 150) {
    securityState.events = securityState.events.slice(0, 150);
  }
}

function recordAttempt(username, success) {
  if (!securityState.failedAttempts[username]) {
    securityState.failedAttempts[username] = { count: 0, lastFailure: null };
  }

  if (success) {
    securityState.failedAttempts[username] = { count: 0, lastFailure: null };
    return;
  }

  securityState.failedAttempts[username].count += 1;
  securityState.failedAttempts[username].lastFailure = new Date().toISOString();
}

function loginCheck(username, password) {
  const target = users.find((user) => user.username === username);

  if (!target) {
    return {
      success: false,
      code: "UNKNOWN_USER",
      message: "User not found in this fake system.",
    };
  }

  if (
    shouldLockAccount(
      securityState.failedAttempts[username]?.count || 0,
      securityState.rubric.lockoutThreshold
    )
  ) {
    return {
      success: false,
      code: "ACCOUNT_LOCKED",
      message: "Account is locked in simulation due to repeated failures.",
    };
  }

  const success = target.password === password;
  recordAttempt(username, success);

  if (!success) {
    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "Credentials rejected by fake auth gateway.",
    };
  }

  return {
    success: true,
    code: "LOGIN_OK",
    message: `Welcome ${target.username} (${target.role})`,
  };
}

function getLabById(labId) {
  return getLabDefinitions().find((lab) => lab.id === labId);
}

function upsertSession(updatedSession) {
  const index = securityState.instructorSessions.findIndex((session) => session.id === updatedSession.id);
  if (index === -1) {
    securityState.instructorSessions.unshift(updatedSession);
  } else {
    securityState.instructorSessions[index] = updatedSession;
  }

  if (securityState.instructorSessions.length > 80) {
    securityState.instructorSessions = securityState.instructorSessions.slice(0, 80);
  }

  return updatedSession;
}

function hydrateSession(session) {
  return {
    ...session,
    time: getTimeState(session),
  };
}

app.get("/api/status", (req, res) => {
  const readiness = calculateReadinessScore(securityState.events);

  res.json({
    ok: true,
    app: "CyberSim Sandbox",
    users: users.map((u) => ({ username: u.username, role: u.role })),
    recentEvents: securityState.events.slice(0, 8),
    readiness,
  });
});

app.get("/api/learning/modules", (req, res) => {
  res.json({
    ok: true,
    modules: getLearningModules(),
    readiness: calculateReadinessScore(securityState.events),
  });
});

app.get("/api/instructor/labs", (req, res) => {
  res.json({ ok: true, labs: getLabDefinitions() });
});

app.get("/api/instructor/rubric", (req, res) => {
  res.json({ ok: true, rubric: securityState.rubric });
});

app.post("/api/instructor/rubric", (req, res) => {
  const next = sanitizeRubric(req.body || {});
  securityState.rubric = next;

  pushEvent(
    createEvent("rubric_updated", {
      rubric: next,
    })
  );

  res.json({ ok: true, rubric: next });
});

app.get("/api/instructor/sessions", (req, res) => {
  res.json({
    ok: true,
    sessions: securityState.instructorSessions.map((session) => hydrateSession(session)),
  });
});

app.post("/api/instructor/session/start", (req, res) => {
  const labId = String(req.body.labId || "").trim();
  const analyst = String(req.body.analyst || "Instructor Team").trim();
  const durationMinutes = Number(req.body.durationMinutes || 0);

  if (!labId) {
    return res.status(400).json({ ok: false, error: "labId is required" });
  }

  const lab = getLabById(labId);
  if (!lab) {
    return res.status(404).json({ ok: false, error: "Lab not found" });
  }

  const session = createLabSession(lab, analyst || "Instructor Team", durationMinutes);
  upsertSession(session);

  pushEvent(
    createEvent("instructor_session_started", {
      sessionId: session.id,
      labId: session.labId,
      analyst: session.analyst,
      durationMinutes: session.durationMinutes,
    })
  );

  return res.json({ ok: true, session: hydrateSession(session) });
});

app.post("/api/instructor/session/:sessionId/evaluate", (req, res) => {
  const sessionId = String(req.params.sessionId || "").trim();
  const session = securityState.instructorSessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const lab = getLabById(session.labId);
  if (!lab) {
    return res.status(500).json({ ok: false, error: "Lab definition missing" });
  }

  const evaluated = evaluateLabSession(session, lab, securityState.events, securityState.rubric);
  upsertSession(evaluated);

  pushEvent(
    createEvent("instructor_session_evaluated", {
      sessionId: evaluated.id,
      labId: evaluated.labId,
      score: evaluated.score,
      pass: evaluated.pass,
      status: evaluated.status,
    })
  );

  return res.json({ ok: true, session: hydrateSession(evaluated) });
});

app.post("/api/instructor/session/:sessionId/close", (req, res) => {
  const sessionId = String(req.params.sessionId || "").trim();
  const session = securityState.instructorSessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const closed = {
    ...session,
    status: session.pass ? "COMPLETED" : "CLOSED",
    closedAt: new Date().toISOString(),
  };
  upsertSession(closed);

  pushEvent(
    createEvent("instructor_session_closed", {
      sessionId: closed.id,
      labId: closed.labId,
      status: closed.status,
    })
  );

  return res.json({ ok: true, session: hydrateSession(closed) });
});

app.get("/api/report/export/json", (req, res) => {
  const readiness = calculateReadinessScore(securityState.events);
  const report = buildTrainingReport({
    events: securityState.events,
    readiness,
    sessions: securityState.instructorSessions.map((session) => hydrateSession(session)),
    rubric: securityState.rubric,
  });

  res.json({ ok: true, report });
});

app.get("/api/report/export/csv", (req, res) => {
  const scope = String(req.query.scope || "sessions").trim().toLowerCase();
  const csv =
    scope === "events"
      ? buildEventCsv(securityState.events)
      : buildSessionSummaryCsv(securityState.instructorSessions);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(csv);
});

app.get("/api/events", (req, res) => {
  res.json({ ok: true, events: securityState.events.slice(0, 30) });
});

app.get("/api/users", (req, res) => {
  const query = String(req.query.query || "").trim();
  const payloadType = detectInjectionType(query);

  if (payloadType !== "NONE") {
    pushEvent(
      createEvent("injection_probe", {
        vector: "users_query",
        payload: query,
        payloadType,
        blocked: true,
      })
    );

    return res.status(400).json({
      ok: false,
      error: "Input blocked by simulated WAF",
      payloadType,
    });
  }

  const result = users.filter((u) => u.username.includes(query)).map((u) => ({
    username: u.username,
    role: u.role,
  }));

  res.json({ ok: true, result });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      error: "username and password are required",
    });
  }

  const outcome = loginCheck(username, password);
  pushEvent(
    createEvent("login_attempt", {
      username,
      success: outcome.success,
      code: outcome.code,
      simulated: false,
    })
  );

  return res.status(outcome.success ? 200 : 401).json({
    ok: outcome.success,
    ...outcome,
  });
});

app.post("/api/simulate/bruteforce", (req, res) => {
  const username = String(req.body.username || "").trim();
  const totalAttempts = Number(req.body.totalAttempts || 20);

  if (!username) {
    return res.status(400).json({ ok: false, error: "username is required" });
  }

  const sequence = [];
  let successAt = null;

  for (let i = 1; i <= totalAttempts; i += 1) {
    const candidate = pickPassword(i);
    const outcome = loginCheck(username, candidate);
    sequence.push({ attempt: i, password: candidate, code: outcome.code });

    if (outcome.success) {
      successAt = i;
      break;
    }

    if (outcome.code === "ACCOUNT_LOCKED") {
      break;
    }
  }

  const summary = {
    success: successAt !== null,
    successAt,
    totalAttempted: sequence.length,
    locked: sequence.some((x) => x.code === "ACCOUNT_LOCKED"),
  };

  const debrief = buildBruteforceDebrief(username, summary, sequence);

  pushEvent(
    createEvent("bruteforce_simulation", {
      username,
      ...summary,
      riskLevel: debrief.riskLevel,
    })
  );

  return res.json({
    ok: true,
    summary,
    sequence,
    debrief,
    readiness: calculateReadinessScore(securityState.events),
  });
});

app.post("/api/simulate/phishing", (req, res) => {
  const campaign = String(req.body.campaign || "Quarterly Access Review");
  const lureType = String(req.body.lureType || "credential_reset");
  const targets = Array.isArray(req.body.targets) ? req.body.targets : [];

  if (!targets.length) {
    return res.status(400).json({ ok: false, error: "targets array is required" });
  }

  const details = targets.map((target) => evaluatePhishingTarget(String(target), lureType));
  const captured = details.filter((x) => x.clicked && x.submittedCredentials);

  const result = {
    campaign,
    lureType,
    sent: targets.length,
    clicked: details.filter((x) => x.clicked).length,
    credentialsCaptured: captured.length,
    details,
  };

  const debrief = buildPhishingDebrief(result);

  pushEvent(
    createEvent("phishing_simulation", {
      campaign,
      lureType,
      sent: result.sent,
      clicked: result.clicked,
      credentialsCaptured: result.credentialsCaptured,
      riskLevel: debrief.riskLevel,
    })
  );

  res.json({
    ok: true,
    result,
    debrief,
    readiness: calculateReadinessScore(securityState.events),
  });
});

app.post("/api/simulate/injection", (req, res) => {
  const vector = String(req.body.vector || "search");
  const payload = String(req.body.payload || "");

  if (!payload) {
    return res.status(400).json({ ok: false, error: "payload is required" });
  }

  const payloadType = detectInjectionType(payload);
  const blocked = payloadType !== "NONE";

  const result = {
    vector,
    payload,
    payloadType,
    blocked,
    vulnerableIfUnpatched: payloadType !== "NONE",
    notes: blocked
      ? "Simulated defense blocked this payload."
      : "Payload considered safe in this simulation.",
  };

  const debrief = buildInjectionDebrief(result);

  pushEvent(
    createEvent("injection_simulation", {
      ...result,
      riskLevel: debrief.riskLevel,
    })
  );

  return res.json({
    ok: true,
    result,
    debrief,
    readiness: calculateReadinessScore(securityState.events),
  });
});

app.listen(PORT, () => {
  console.log(`CyberSim Sandbox running on http://localhost:${PORT}`);
});

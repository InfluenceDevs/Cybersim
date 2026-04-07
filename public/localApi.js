(function () {
  const STORAGE_KEY = "cybersim-local-state-v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function createEvent(type, details) {
    return {
      id: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type,
      details,
      timestamp: nowIso(),
    };
  }

  function shouldLockAccount(currentFailures, threshold) {
    return currentFailures >= threshold;
  }

  function pickPassword(attempt) {
    const list = ["123456", "password", "admin", "letmein", "qwerty", "P@ssw0rd!", "BlueTeam123"];
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
    const value = String(payload || "").toLowerCase();

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
        telemetry: ["auth.failed_count_per_user", "auth.failed_count_per_source", "auth.lockout_events"],
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
        telemetry: ["mail.link_click_events", "idp.suspicious_login", "helpdesk.credential_reset_requests"],
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
        telemetry: ["waf.block_events", "api.bad_request_signatures", "app.validation_failures"],
        successCriteria: [
          "Payload blocked before reaching business logic.",
          "Detection includes payload class and vector.",
          "Fix recommendation maps to secure coding control.",
        ],
      },
    ];
  }

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

  function createLabSession(lab, analyst, durationMinutes) {
    const startedAt = nowIso();
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

  function evaluateLabSession(session, lab, events, rubric) {
    const activeRubric = sanitizeRubric(rubric);
    const sessionEvents = getSessionEvents(events, session);

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
        checkedAt: nowIso(),
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
      evaluatedAt: nowIso(),
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

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\n") || text.includes('"')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function toCsv(rows) {
    return rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n");
  }

  function buildSessionSummaryCsv(sessions) {
    const rows = [
      ["session_id", "lab_id", "lab_title", "analyst", "status", "score", "pass", "started_at", "duration_minutes"],
    ];

    for (const session of sessions) {
      rows.push([
        session.id,
        session.labId,
        session.labTitle,
        session.analyst,
        session.status,
        session.score,
        session.pass,
        session.startedAt,
        session.durationMinutes,
      ]);
    }

    return toCsv(rows);
  }

  function buildEventCsv(events) {
    const rows = [["event_id", "timestamp", "type", "risk_level", "details_json"]];
    for (const event of events) {
      rows.push([
        event.id,
        event.timestamp,
        event.type,
        event.details.riskLevel || "",
        JSON.stringify(event.details),
      ]);
    }
    return toCsv(rows);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [
            { username: "admin", password: "P@ssw0rd!", role: "admin" },
            { username: "analyst", password: "BlueTeam123", role: "analyst" },
            { username: "guest", password: "guest", role: "guest" },
          ],
          failedAttempts: parsed.failedAttempts || {},
          events: parsed.events || [],
          instructorSessions: parsed.instructorSessions || [],
          rubric: sanitizeRubric(parsed.rubric || getDefaultRubric()),
        };
      }
    } catch (error) {
      console.warn("Failed to load local mode state", error);
    }

    return {
      users: [
        { username: "admin", password: "P@ssw0rd!", role: "admin" },
        { username: "analyst", password: "BlueTeam123", role: "analyst" },
        { username: "guest", password: "guest", role: "guest" },
      ],
      failedAttempts: {},
      events: [],
      instructorSessions: [],
      rubric: getDefaultRubric(),
    };
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function buildTrainingReport(state) {
    const readiness = calculateReadinessScore(state.events);
    return {
      generatedAt: nowIso(),
      readiness,
      rubric: state.rubric,
      totals: {
        events: state.events.length,
        sessions: state.instructorSessions.length,
        completedSessions: state.instructorSessions.filter((session) => session.status === "COMPLETED").length,
        passedSessions: state.instructorSessions.filter((session) => session.pass).length,
      },
      sessions: state.instructorSessions,
      events: state.events,
    };
  }

  function normalizeEndpoint(rawUrl) {
    const parsed = new URL(rawUrl, window.location.href);
    const marker = "/api/";
    const index = parsed.pathname.indexOf(marker);
    const endpointPath = index >= 0 ? parsed.pathname.slice(index) : parsed.pathname;
    return {
      endpointPath,
      searchParams: parsed.searchParams,
    };
  }

  function createLocalApi() {
    const state = loadState();

    function pushEvent(event) {
      state.events.unshift(event);
      if (state.events.length > 150) {
        state.events = state.events.slice(0, 150);
      }
      saveState(state);
    }

    function recordAttempt(username, success) {
      if (!state.failedAttempts[username]) {
        state.failedAttempts[username] = { count: 0, lastFailure: null };
      }

      if (success) {
        state.failedAttempts[username] = { count: 0, lastFailure: null };
        return;
      }

      state.failedAttempts[username].count += 1;
      state.failedAttempts[username].lastFailure = nowIso();
    }

    function loginCheck(username, password) {
      const target = state.users.find((user) => user.username === username);
      if (!target) {
        return { success: false, code: "UNKNOWN_USER", message: "User not found in this fake system." };
      }

      if (shouldLockAccount(state.failedAttempts[username]?.count || 0, state.rubric.lockoutThreshold)) {
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

      return { success: true, code: "LOGIN_OK", message: `Welcome ${target.username} (${target.role})` };
    }

    function getLabById(labId) {
      return getLabDefinitions().find((lab) => lab.id === labId);
    }

    function upsertSession(updatedSession) {
      const index = state.instructorSessions.findIndex((session) => session.id === updatedSession.id);
      if (index === -1) {
        state.instructorSessions.unshift(updatedSession);
      } else {
        state.instructorSessions[index] = updatedSession;
      }

      if (state.instructorSessions.length > 80) {
        state.instructorSessions = state.instructorSessions.slice(0, 80);
      }

      saveState(state);
      return updatedSession;
    }

    function hydrateSession(session) {
      return {
        ...session,
        time: getTimeState(session),
      };
    }

    function getBody(options) {
      if (!options || !options.body) {
        return {};
      }
      try {
        return JSON.parse(options.body);
      } catch {
        return {};
      }
    }

    function json(status, data) {
      return Promise.resolve({ status, data, text: JSON.stringify(data, null, 2) });
    }

    function text(status, dataText) {
      return Promise.resolve({ status, data: { ok: status < 400 }, text: dataText });
    }

    async function request(url, options = {}) {
      const method = String(options.method || "GET").toUpperCase();
      const { endpointPath, searchParams } = normalizeEndpoint(url);
      const body = getBody(options);

      if (endpointPath === "/api/status" && method === "GET") {
        return json(200, {
          ok: true,
          app: "CyberSim Sandbox",
          users: state.users.map((u) => ({ username: u.username, role: u.role })),
          recentEvents: state.events.slice(0, 8),
          readiness: calculateReadinessScore(state.events),
          runtimeMode: "local",
        });
      }

      if (endpointPath === "/api/learning/modules" && method === "GET") {
        return json(200, {
          ok: true,
          modules: getLearningModules(),
          readiness: calculateReadinessScore(state.events),
        });
      }

      if (endpointPath === "/api/events" && method === "GET") {
        return json(200, { ok: true, events: state.events.slice(0, 30) });
      }

      if (endpointPath === "/api/users" && method === "GET") {
        const query = String(searchParams.get("query") || "").trim();
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

          return json(400, { ok: false, error: "Input blocked by simulated WAF", payloadType });
        }

        const result = state.users
          .filter((user) => user.username.includes(query))
          .map((user) => ({ username: user.username, role: user.role }));
        return json(200, { ok: true, result });
      }

      if (endpointPath === "/api/auth/login" && method === "POST") {
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!username || !password) {
          return json(400, { ok: false, error: "username and password are required" });
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

        saveState(state);
        return json(outcome.success ? 200 : 401, { ok: outcome.success, ...outcome });
      }

      if (endpointPath === "/api/simulate/bruteforce" && method === "POST") {
        const username = String(body.username || "").trim();
        const totalAttempts = Number(body.totalAttempts || 20);

        if (!username) {
          return json(400, { ok: false, error: "username is required" });
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

        saveState(state);
        return json(200, {
          ok: true,
          summary,
          sequence,
          debrief,
          readiness: calculateReadinessScore(state.events),
        });
      }

      if (endpointPath === "/api/simulate/phishing" && method === "POST") {
        const campaign = String(body.campaign || "Quarterly Access Review");
        const lureType = String(body.lureType || "credential_reset");
        const targets = Array.isArray(body.targets) ? body.targets : [];

        if (!targets.length) {
          return json(400, { ok: false, error: "targets array is required" });
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

        saveState(state);
        return json(200, {
          ok: true,
          result,
          debrief,
          readiness: calculateReadinessScore(state.events),
        });
      }

      if (endpointPath === "/api/simulate/injection" && method === "POST") {
        const vector = String(body.vector || "search");
        const payload = String(body.payload || "");

        if (!payload) {
          return json(400, { ok: false, error: "payload is required" });
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
        pushEvent(createEvent("injection_simulation", { ...result, riskLevel: debrief.riskLevel }));

        saveState(state);
        return json(200, {
          ok: true,
          result,
          debrief,
          readiness: calculateReadinessScore(state.events),
        });
      }

      if (endpointPath === "/api/instructor/labs" && method === "GET") {
        return json(200, { ok: true, labs: getLabDefinitions() });
      }

      if (endpointPath === "/api/instructor/rubric" && method === "GET") {
        return json(200, { ok: true, rubric: state.rubric });
      }

      if (endpointPath === "/api/instructor/rubric" && method === "POST") {
        const next = sanitizeRubric(body || {});
        state.rubric = next;
        saveState(state);

        pushEvent(createEvent("rubric_updated", { rubric: next }));
        return json(200, { ok: true, rubric: next });
      }

      if (endpointPath === "/api/instructor/sessions" && method === "GET") {
        return json(200, {
          ok: true,
          sessions: state.instructorSessions.map((session) => hydrateSession(session)),
        });
      }

      if (endpointPath === "/api/instructor/session/start" && method === "POST") {
        const labId = String(body.labId || "").trim();
        const analyst = String(body.analyst || "Instructor Team").trim();
        const durationMinutes = Number(body.durationMinutes || 0);

        if (!labId) {
          return json(400, { ok: false, error: "labId is required" });
        }

        const lab = getLabById(labId);
        if (!lab) {
          return json(404, { ok: false, error: "Lab not found" });
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

        saveState(state);
        return json(200, { ok: true, session: hydrateSession(session) });
      }

      const evalMatch = endpointPath.match(/^\/api\/instructor\/session\/([^/]+)\/evaluate$/);
      if (evalMatch && method === "POST") {
        const sessionId = decodeURIComponent(evalMatch[1]);
        const session = state.instructorSessions.find((entry) => entry.id === sessionId);
        if (!session) {
          return json(404, { ok: false, error: "Session not found" });
        }

        const lab = getLabById(session.labId);
        if (!lab) {
          return json(500, { ok: false, error: "Lab definition missing" });
        }

        const evaluated = evaluateLabSession(session, lab, state.events, state.rubric);
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

        saveState(state);
        return json(200, { ok: true, session: hydrateSession(evaluated) });
      }

      const closeMatch = endpointPath.match(/^\/api\/instructor\/session\/([^/]+)\/close$/);
      if (closeMatch && method === "POST") {
        const sessionId = decodeURIComponent(closeMatch[1]);
        const session = state.instructorSessions.find((entry) => entry.id === sessionId);
        if (!session) {
          return json(404, { ok: false, error: "Session not found" });
        }

        const closed = {
          ...session,
          status: session.pass ? "COMPLETED" : "CLOSED",
          closedAt: nowIso(),
        };
        upsertSession(closed);
        pushEvent(
          createEvent("instructor_session_closed", {
            sessionId: closed.id,
            labId: closed.labId,
            status: closed.status,
          })
        );

        saveState(state);
        return json(200, { ok: true, session: hydrateSession(closed) });
      }

      if (endpointPath === "/api/report/export/json" && method === "GET") {
        return json(200, {
          ok: true,
          report: buildTrainingReport(state),
        });
      }

      if (endpointPath === "/api/report/export/csv" && method === "GET") {
        const scope = String(searchParams.get("scope") || "sessions").trim().toLowerCase();
        const csv = scope === "events" ? buildEventCsv(state.events) : buildSessionSummaryCsv(state.instructorSessions);
        return text(200, csv);
      }

      return json(404, { ok: false, error: `Local API route not found: ${endpointPath}` });
    }

    return {
      mode: "local",
      request,
    };
  }

  window.CyberSimLocalApi = {
    createLocalApi,
  };
})();

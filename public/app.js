let cachedLabs = [];
let cachedSessions = [];
let runtimeMode = "server";

const api = {
  mode: "server",
  local: null,
};

const game = {
  teamMode: "blue",
  xp: 0,
  badges: new Set(),
  completed: new Set(),
  weakAreas: {
    xss: 0,
    phishing: 0,
    sqli: 0,
  },
  phishingCurrent: null,
};

const learningPaths = [
  {
    id: "path-foundations",
    title: "Path 1: Recon Foundations",
    level: "Beginner",
    summary: "Terminal, file discovery, and network scan interpretation.",
  },
  {
    id: "path-web-vulns",
    title: "Path 2: Web Exploitation Basics",
    level: "Intermediate",
    summary: "SQLi, XSS, CSRF, and payload behavior in safe simulations.",
  },
  {
    id: "path-defense",
    title: "Path 3: Defensive Response",
    level: "Intermediate",
    summary: "Rubric-driven hardening and blue-team decision quality.",
  },
  {
    id: "path-operations",
    title: "Path 4: Operator Assessment",
    level: "Advanced",
    summary: "Instructor sessions, scoring, reports, and readiness tuning.",
  },
];

const levels = [
  { id: "lv1", title: "Level 1 - Script Kiddie", requirement: 0 },
  { id: "lv2", title: "Level 2 - Apprentice Operator", requirement: 120 },
  { id: "lv3", title: "Level 3 - Web Pentest Analyst", requirement: 260 },
  { id: "lv4", title: "Level 4 - SOC Defender", requirement: 420 },
  { id: "lv5", title: "Level 5 - Hybrid Red/Blue Lead", requirement: 650 },
];

const fakeFiles = {
  "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nctf:x:1001:1001:CTF User:/home/ctf:/bin/bash",
  "/var/www/.env": "APP_KEY=base64:r4nd0mKEY\nDB_USER=cyberadmin\nDB_PASS=dev-only-password\nJWT_SECRET=local-jwt-dev",
  "/opt/app/config.yml": "featureFlags:\n  debugAuthBypass: true\n  weakPasswordPolicy: enabled\n  csrfProtection: disabled",
  "/srv/secrets/notes.txt": "backup creds: ops:Winter2026!\nrotate immediately",
};

const phishingEmails = [
  {
    from: "security-team@micr0soft-support.com",
    subject: "Urgent: Mailbox suspension in 15 minutes",
    body: "Confirm now to avoid lockout. Attachment: Update_Form.zip",
    phishing: true,
  },
  {
    from: "hr@influence.local",
    subject: "Updated holiday policy",
    body: "Internal memo in employee portal only. No links attached.",
    phishing: false,
  },
  {
    from: "it-helpdesk@influence-devs.co",
    subject: "VPN certificate expired",
    body: "Download cert patch from https://influencedevs-support.co/login",
    phishing: true,
  },
  {
    from: "noreply@github.com",
    subject: "Dependabot alert summary",
    body: "Review vulnerabilities directly in your repository security tab.",
    phishing: false,
  },
];

function endpoint(path) {
  return `api${path}`;
}

function prettyPrint(elementId, payload) {
  const el = document.getElementById(elementId);
  el.textContent = JSON.stringify(payload, null, 2);
}

function setText(elementId, value) {
  const el = document.getElementById(elementId);
  el.textContent = String(value);
}

function showDebrief(payload) {
  prettyPrint("debrief-output", payload);
}

function addXp(amount, challengeId, badgeName) {
  game.xp += amount;
  if (challengeId) {
    game.completed.add(challengeId);
  }
  if (badgeName) {
    game.badges.add(badgeName);
  }
  updatePlayerStats();
  renderLevels();
  renderProgress();
}

function currentLevel() {
  let achieved = levels[0];
  for (const level of levels) {
    if (game.xp >= level.requirement) {
      achieved = level;
    }
  }
  return achieved;
}

function updatePlayerStats() {
  document.getElementById("player-level").textContent = currentLevel().title.split("-")[0].trim().replace("Level ", "");
  document.getElementById("player-xp").textContent = String(game.xp);
  document.getElementById("player-badges").textContent = String(game.badges.size);
}

function renderLearningPaths() {
  const container = document.getElementById("learning-paths");
  container.innerHTML = "";
  for (const path of learningPaths) {
    const card = document.createElement("article");
    card.className = "path-card";
    card.innerHTML = `<h3>${path.title}</h3><p><strong>${path.level}</strong></p><p>${path.summary}</p>`;
    container.appendChild(card);
  }
}

function renderLevels() {
  const container = document.getElementById("levels-output");
  container.innerHTML = "";
  for (const level of levels) {
    const done = game.xp >= level.requirement;
    const card = document.createElement("article");
    card.className = "level-card";
    card.innerHTML = `<h3>${level.title}</h3><p>Needs ${level.requirement} XP</p><p>Status: ${done ? "Unlocked" : "Locked"}</p>`;
    container.appendChild(card);
  }
}

function renderProgress() {
  const weak = Object.entries(game.weakAreas)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
    .join(" | ");

  setText(
    "progress-output",
    JSON.stringify(
      {
        teamMode: game.teamMode,
        xp: game.xp,
        level: currentLevel().title,
        completedChallenges: Array.from(game.completed),
        badges: Array.from(game.badges),
        weakAreas: weak,
        recommendation:
          game.weakAreas.xss > game.weakAreas.phishing
            ? "Focus on XSS defense labs and output encoding practices."
            : "Focus on phishing triage and sender-domain analysis.",
      },
      null,
      2
    )
  );
}

function updateRuntimeBadge() {
  const badge = document.getElementById("runtime-mode");
  const label = runtimeMode === "local" ? "Local Browser Mode (GitHub Pages Ready)" : "Server API Mode";
  badge.textContent = label;
  setText(
    "mode-output",
    runtimeMode === "local"
      ? "Running without backend. State persists in browser localStorage."
      : "Running against Node/Express API endpoints."
  );
}

async function initApi() {
  try {
    const probe = await fetch(endpoint("/status"));
    if (probe.ok) {
      api.mode = "server";
      runtimeMode = "server";
      updateRuntimeBadge();
      return;
    }
  } catch {
    // no-op
  }

  if (window.CyberSimLocalApi) {
    api.local = window.CyberSimLocalApi.createLocalApi();
    api.mode = "local";
    runtimeMode = "local";
    updateRuntimeBadge();
    return;
  }

  throw new Error("No server API and no local API fallback available.");
}

async function callApi(path, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  if (api.mode === "local") {
    const result = await api.local.request(endpoint(path), opts);
    return {
      status: result.status,
      data: result.data,
      text: result.text,
    };
  }

  const response = await fetch(endpoint(path), opts);
  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, error: "Invalid JSON response" };
  }

  return { status: response.status, data };
}

function downloadTextFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function syncLabSelector(labs) {
  const select = document.getElementById("lab-select");
  if (!select || !labs.length) {
    return;
  }

  select.innerHTML = "";
  for (const lab of labs) {
    const option = document.createElement("option");
    option.value = lab.id;
    option.textContent = `${lab.title} (${lab.attackType})`;
    select.appendChild(option);
  }
}

function latestSessionId() {
  return cachedSessions.length ? cachedSessions[0].id : null;
}

function fillRubricForm(rubric) {
  if (!rubric) {
    return;
  }
  document.getElementById("rubric-checkpointWeight").value = rubric.checkpointWeight;
  document.getElementById("rubric-timeBonus").value = rubric.timeBonus;
  document.getElementById("rubric-passThreshold").value = rubric.passThreshold;
  document.getElementById("rubric-lockoutThreshold").value = rubric.lockoutThreshold;
}

async function refreshEvents() {
  const result = await callApi("/events");
  prettyPrint("events-output", result);
}

async function refreshModules() {
  const result = await callApi("/learning/modules");
  prettyPrint("modules-output", result);
  cachedLabs = Array.isArray(result.data.modules) ? result.data.modules : [];
  syncLabSelector(cachedLabs);
}

async function refreshStatus() {
  const result = await callApi("/status");
  prettyPrint("status-output", result);
}

async function refreshSessions() {
  const result = await callApi("/instructor/sessions");
  cachedSessions = Array.isArray(result.data.sessions) ? result.data.sessions : [];
  prettyPrint("instructor-output", result);
}

async function refreshRubric() {
  const result = await callApi("/instructor/rubric");
  prettyPrint("rubric-output", result);
  fillRubricForm(result.data.rubric);
}

async function handleInstructorStart(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = {
    labId: formData.get("labId"),
    analyst: formData.get("analyst"),
    durationMinutes: Number(formData.get("durationMinutes")),
  };

  const result = await callApi("/instructor/session/start", {
    method: "POST",
    body: JSON.stringify(body),
  });

  prettyPrint("instructor-output", result);
  addXp(20, "instructor-start", "Ops Coordinator");
  await refreshSessions();
  await refreshEvents();
}

async function saveRubric(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = {
    checkpointWeight: Number(formData.get("checkpointWeight")),
    timeBonus: Number(formData.get("timeBonus")),
    passThreshold: Number(formData.get("passThreshold")),
    lockoutThreshold: Number(formData.get("lockoutThreshold")),
  };

  const result = await callApi("/instructor/rubric", {
    method: "POST",
    body: JSON.stringify(body),
  });

  prettyPrint("rubric-output", result);
  fillRubricForm(result.data.rubric);
  addXp(10, "rubric-save", "Policy Tuner");
  await refreshEvents();
}

async function evaluateLatestSession() {
  const sessionId = latestSessionId();
  if (!sessionId) {
    setText("instructor-output", "No instructor session found. Start a lab first.");
    return;
  }

  const result = await callApi(`/instructor/session/${encodeURIComponent(sessionId)}/evaluate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  prettyPrint("instructor-output", result);
  showDebrief(result.data.session || { message: "No evaluation data returned." });
  addXp(30, "session-eval", "Evaluator");
  await refreshSessions();
  await refreshEvents();
}

async function closeLatestSession() {
  const sessionId = latestSessionId();
  if (!sessionId) {
    setText("instructor-output", "No instructor session found to close.");
    return;
  }

  const result = await callApi(`/instructor/session/${encodeURIComponent(sessionId)}/close`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  prettyPrint("instructor-output", result);
  await refreshSessions();
  await refreshEvents();
}

async function exportJsonReport() {
  const result = await callApi("/report/export/json");
  prettyPrint("report-output", result);
  downloadTextFile(
    `cybersim-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
    JSON.stringify(result.data, null, 2),
    "application/json"
  );
}

async function exportCsvReport(scope) {
  if (api.mode === "local") {
    const result = await callApi(`/report/export/csv?scope=${encodeURIComponent(scope)}`);
    setText("report-output", result.text);
    downloadTextFile(`cybersim-${scope}.csv`, result.text, "text/csv;charset=utf-8");
    return;
  }

  const response = await fetch(endpoint(`/report/export/csv?scope=${encodeURIComponent(scope)}`));
  const text = await response.text();
  setText("report-output", text);
  downloadTextFile(`cybersim-${scope}.csv`, text, "text/csv;charset=utf-8");
}

function teamPrefix() {
  return game.teamMode === "red" ? "[RED]" : "[BLUE]";
}

function handleTerminalChallenge(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const challenge = String(formData.get("challenge"));
  const command = String(formData.get("command") || "").toLowerCase();

  const rules = {
    "find-password": {
      ok: command.includes("cat") && command.includes("secrets"),
      success: "Found credential artifact: ops:Winter2026!",
      fail: "No useful output. Try reading secret or backup files.",
      badge: "File Hunter",
    },
    "weak-permissions": {
      ok: command.includes("sudo -l") || command.includes("chmod") || command.includes("find / -perm"),
      success: "Privilege path discovered via weak sudo permission.",
      fail: "Permission weakness not identified. Enumerate sudo or world-writable files.",
      badge: "Privilege Scout",
    },
    "decode-base64": {
      ok: command.includes("base64 -d") || command.includes("echo"),
      success: "Decoded token: admin_panel_access=true",
      fail: "Decoder command missing. Use base64 decoding flow.",
      badge: "Decoder",
    },
  };

  const rule = rules[challenge];
  if (rule.ok) {
    setText("terminal-output", `${teamPrefix()} ${rule.success}`);
    addXp(25, `terminal-${challenge}`, rule.badge);
  } else {
    setText("terminal-output", `${teamPrefix()} ${rule.fail}`);
  }
}

function handleFileSearch(event) {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("query") || "").toLowerCase();
  const hits = Object.keys(fakeFiles).filter((path) => path.toLowerCase().includes(query));
  setText("filesystem-output", hits.length ? `Matches:\n${hits.join("\n")}` : "No files matched query.");
  if (hits.length) {
    addXp(10, "file-search", "Explorer");
  }
}

function openFile(path) {
  const content = fakeFiles[path] || "File not found.";
  setText("filesystem-output", `${path}\n\n${content}`);
  addXp(10, `file-open-${path}`, "Forensics Reader");
}

function handleVulnLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const profile = String(formData.get("profile") || "vulnerable");

  const weakPassword = ["123456", "password", "admin"].includes(password.toLowerCase());
  const sqli = /'\s*or\s*1=1\s*--/i.test(password);
  let result;

  if (profile === "vulnerable" && (sqli || weakPassword)) {
    result = {
      success: true,
      reason: sqli ? "SQL injection bypass succeeded." : "Weak password accepted.",
      noRateLimiting: true,
      user: username || "admin",
    };
    addXp(30, "vuln-login", "Auth Breaker");
    game.weakAreas.sqli += 1;
  } else if (profile === "hardened" && sqli) {
    result = {
      success: false,
      reason: "Parameterized query blocked injection attempt.",
      noRateLimiting: false,
    };
    addXp(15, "defend-login", "Auth Defender");
  } else {
    result = {
      success: false,
      reason: "Credential rejected by hardened policy.",
      noRateLimiting: profile === "vulnerable",
    };
  }

  prettyPrint("vuln-login-output", result);
  renderProgress();
}

function handleMiniWeb(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const lab = String(formData.get("lab"));
  const payload = String(formData.get("payload") || "");
  let output;

  if (lab === "xss") {
    const isXss = /<script|onerror=|onload=|javascript:/i.test(payload);
    output = {
      lab,
      reflected: true,
      vulnerable: isXss,
      message: isXss ? "Payload reflected unsafely (simulated XSS)." : "No active script indicators.",
    };
    if (isXss) {
      addXp(20, "mini-xss", "XSS Hunter");
      game.weakAreas.xss += 1;
    }
  } else if (lab === "csrf") {
    output = {
      lab,
      forgedRequestAccepted: true,
      hasCsrfToken: false,
      message: "State-changing action accepted without CSRF token.",
    };
    addXp(20, "mini-csrf", "CSRF Spotter");
  } else {
    const bypass = /\.php$/i.test(payload) || /\.php\.jpg$/i.test(payload);
    output = {
      lab,
      uploaded: true,
      bypass,
      message: bypass
        ? "Disguised executable upload accepted by weak validation."
        : "File accepted as non-executable content.",
    };
    if (bypass) {
      addXp(20, "mini-upload", "Upload Bypass");
    }
  }

  prettyPrint("mini-web-output", output);
  renderProgress();
}

function handlePayloadPlayground(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const vector = String(formData.get("vector"));
  const payload = String(formData.get("payload") || "");

  const signatures = {
    xss: /<script|onerror=|javascript:/i,
    sqli: /'\s*or\s*1=1|union\s+select|--/i,
    cmd: /\|\||&&|;\s*(cat|curl|wget|powershell)/i,
  };

  const matched = signatures[vector].test(payload);
  const blocked = matched && game.teamMode === "blue";
  prettyPrint("payload-output", {
    vector,
    payload,
    result: matched ? (blocked ? "Blocked" : "Executed (simulated)") : "No effect",
    teamMode: game.teamMode,
  });

  if (matched && blocked) {
    addXp(15, `payload-${vector}-blocked`, "WAF Guardian");
  }
}

function nextPhishEmail() {
  const index = Math.floor(Math.random() * phishingEmails.length);
  game.phishingCurrent = phishingEmails[index];
  document.getElementById("phish-question").textContent = `${game.phishingCurrent.from} | ${game.phishingCurrent.subject}`;
  setText("phish-output", game.phishingCurrent.body);
}

function answerPhishing(markedPhishing) {
  if (!game.phishingCurrent) {
    setText("phish-output", "Load a sample email first.");
    return;
  }

  const correct = Boolean(markedPhishing) === game.phishingCurrent.phishing;
  if (correct) {
    setText("phish-output", `Correct. ${teamPrefix()} Good triage decision.`);
    addXp(18, "phishing-quiz", "Mail Sentinel");
  } else {
    setText("phish-output", "Incorrect classification. Review domain patterns and urgency language.");
    game.weakAreas.phishing += 1;
    renderProgress();
  }
}

function handleCrack(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const hash = String(formData.get("hash"));
  const attack = String(formData.get("attack"));
  const target = {
    "5f4dcc3b5aa765d61d8327deb882cf99": "password",
    "0d107d09f5bbe40cade3de5c71e9e9b7": "letmein",
    "482c811da5d5b4bc6d497ffa98491e38": "password123",
  };

  const bar = document.getElementById("crack-progress");
  let progress = 0;
  bar.style.width = "0%";
  setText("crack-output", "Starting simulated cracking run...");

  const timer = setInterval(() => {
    progress += attack === "dictionary" ? 20 : 12;
    bar.style.width = `${Math.min(progress, 100)}%`;

    if (progress >= 100) {
      clearInterval(timer);
      setText(
        "crack-output",
        JSON.stringify(
          {
            hash,
            attack,
            result: target[hash],
            duration: attack === "dictionary" ? "2.4s (simulated)" : "4.9s (simulated)",
          },
          null,
          2
        )
      );
      addXp(22, `crack-${attack}`, "Hash Cracker");
    }
  }, 180);
}

function runScan() {
  setText(
    "network-output",
    `PORT   STATUS   SERVICE\n22     open     ssh\n80     open     http\n443    closed   https\n8080   open     http-alt`
  );
  addXp(10, "network-scan", "Recon Scout");
}

function chooseNetworkAttack(event) {
  event.preventDefault();
  const port = String(new FormData(event.currentTarget).get("port"));
  const outcomes = {
    "22": "Attempted SSH bruteforce detected by fail2ban in defensive mode.",
    "80": "Web enumeration discovered /admin panel and outdated CMS fingerprint.",
    "443": "TLS port closed in simulation. Pivot to exposed alternative services.",
  };
  setText("network-output", `${teamPrefix()} ${outcomes[port] || "No outcome."}`);
  addXp(15, `network-${port}`, "Port Strategist");
}

document.getElementById("team-mode").addEventListener("change", (event) => {
  game.teamMode = String(event.target.value);
  renderProgress();
  setText("mode-output", `${runtimeMode === "local" ? "Local" : "Server"} runtime with ${game.teamMode.toUpperCase()} team perspective.`);
});

document.getElementById("terminal-form").addEventListener("submit", handleTerminalChallenge);
document.getElementById("file-search-form").addEventListener("submit", handleFileSearch);
document.getElementById("open-etc-passwd").addEventListener("click", () => openFile("/etc/passwd"));
document.getElementById("open-hidden-env").addEventListener("click", () => openFile("/var/www/.env"));
document.getElementById("open-config").addEventListener("click", () => openFile("/opt/app/config.yml"));
document.getElementById("vuln-login-form").addEventListener("submit", handleVulnLogin);
document.getElementById("mini-web-form").addEventListener("submit", handleMiniWeb);
document.getElementById("payload-form").addEventListener("submit", handlePayloadPlayground);
document.getElementById("phish-new").addEventListener("click", nextPhishEmail);
document.getElementById("phish-safe").addEventListener("click", () => answerPhishing(false));
document.getElementById("phish-bad").addEventListener("click", () => answerPhishing(true));
document.getElementById("crack-form").addEventListener("submit", handleCrack);
document.getElementById("run-scan").addEventListener("click", runScan);
document.getElementById("network-attack-form").addEventListener("submit", chooseNetworkAttack);

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());
  const result = await callApi("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  prettyPrint("login-output", result);
  await refreshStatus();
  await refreshEvents();
});

document.getElementById("lookup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = new FormData(event.currentTarget).get("query");
  const result = await callApi(`/users?query=${encodeURIComponent(query)}`);
  prettyPrint("lookup-output", result);
  await refreshEvents();
});

document.getElementById("bruteforce-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = {
    username: formData.get("username"),
    totalAttempts: Number(formData.get("totalAttempts")),
  };
  const result = await callApi("/simulate/bruteforce", {
    method: "POST",
    body: JSON.stringify(body),
  });
  prettyPrint("bruteforce-output", result);
  showDebrief(result.data.debrief || { message: "No debrief returned." });
  addXp(15, "bruteforce-sim", "Bruteforce Analyst");
  await refreshStatus();
  await refreshEvents();
});

document.getElementById("phishing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const targets = String(formData.get("targets") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const body = {
    campaign: formData.get("campaign"),
    lureType: formData.get("lureType"),
    targets,
  };

  const result = await callApi("/simulate/phishing", {
    method: "POST",
    body: JSON.stringify(body),
  });
  prettyPrint("phishing-output", result);
  showDebrief(result.data.debrief || { message: "No debrief returned." });
  addXp(15, "phishing-sim", "Phishing Analyst");
  await refreshStatus();
  await refreshEvents();
});

document.getElementById("injection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());

  const result = await callApi("/simulate/injection", {
    method: "POST",
    body: JSON.stringify(body),
  });
  prettyPrint("injection-output", result);
  showDebrief(result.data.debrief || { message: "No debrief returned." });
  addXp(15, "injection-sim", "Injection Analyst");
  await refreshStatus();
  await refreshEvents();
});

document.getElementById("refresh-events").addEventListener("click", refreshEvents);
document.getElementById("load-modules").addEventListener("click", refreshModules);
document.getElementById("refresh-status").addEventListener("click", refreshStatus);
document.getElementById("refresh-rubric").addEventListener("click", refreshRubric);
document.getElementById("instructor-start-form").addEventListener("submit", handleInstructorStart);
document.getElementById("rubric-form").addEventListener("submit", saveRubric);
document.getElementById("refresh-sessions").addEventListener("click", refreshSessions);
document.getElementById("evaluate-active").addEventListener("click", evaluateLatestSession);
document.getElementById("close-active").addEventListener("click", closeLatestSession);
document.getElementById("export-json").addEventListener("click", exportJsonReport);
document
  .getElementById("export-csv-sessions")
  .addEventListener("click", () => exportCsvReport("sessions"));
document
  .getElementById("export-csv-events")
  .addEventListener("click", () => exportCsvReport("events"));

async function bootstrap() {
  renderLearningPaths();
  renderLevels();
  updatePlayerStats();
  renderProgress();

  await initApi();
  await refreshModules();
  await refreshStatus();
  await refreshRubric();
  await refreshEvents();
  await refreshSessions();
}

bootstrap().catch((error) => {
  setText("report-output", `Bootstrap failed: ${error.message}`);
});

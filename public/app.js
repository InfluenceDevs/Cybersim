let cachedLabs = [];
let cachedSessions = [];
let runtimeMode = "server";

const api = {
  mode: "server",
  local: null,
};

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

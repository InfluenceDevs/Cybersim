function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
}

function buildTrainingReport({ events, readiness, sessions, rubric }) {
  return {
    generatedAt: new Date().toISOString(),
    readiness,
    rubric,
    totals: {
      events: events.length,
      sessions: sessions.length,
      completedSessions: sessions.filter((session) => session.status === "COMPLETED").length,
      passedSessions: sessions.filter((session) => session.pass).length,
    },
    sessions,
    events,
  };
}

function buildSessionSummaryCsv(sessions) {
  const rows = [
    [
      "session_id",
      "lab_id",
      "lab_title",
      "analyst",
      "status",
      "score",
      "pass",
      "started_at",
      "duration_minutes",
    ],
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

module.exports = {
  buildTrainingReport,
  buildSessionSummaryCsv,
  buildEventCsv,
};

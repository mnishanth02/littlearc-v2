const appEnv = process.env.APP_ENV || "local";
const staffApiBaseUrl = process.env.STAFF_API_BASE_URL || "http://127.0.0.1:3000";

const readinessRows = [
  { label: "Staff auth", status: "placeholder", owner: "FND-03" },
  { label: "Staff API contract", status: "deferred", owner: "FND-04" },
  { label: "Database access", status: "forbidden", owner: "Architecture" },
  { label: "Purpose-code audit", status: "deferred", owner: "FND-07" },
] as const;

export default function StaffShellPage() {
  return (
    <main className="shell">
      <section className="content" aria-labelledby="page-title">
        <div className="masthead">
          <p className="eyebrow">Staff operations</p>
          <h1 id="page-title">LittleArc support shell</h1>
          <p className="summary">
            Synthetic M1 staff surface for proving the Next.js runtime boundary.
          </p>
        </div>

        <section className="status" aria-label="Runtime configuration">
          <div>
            <span className="label">Environment</span>
            <strong>{appEnv}</strong>
          </div>
          <div>
            <span className="label">Staff API origin</span>
            <strong>{staffApiBaseUrl}</strong>
          </div>
        </section>

        <section className="checks" aria-label="Staff shell readiness">
          {readinessRows.map((row) => (
            <div className="checkRow" key={row.label}>
              <span>{row.label}</span>
              <span className="checkMeta">
                {row.status} · {row.owner}
              </span>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}

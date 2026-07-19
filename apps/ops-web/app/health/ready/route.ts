import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    appEnv: process.env.APP_ENV || "local",
    checks: [
      { name: "staff-auth", owner: "FND-03", status: "placeholder" },
      { name: "staff-api", owner: "FND-04", status: "generated-openapi" },
      { name: "database-access", owner: "Architecture", status: "forbidden" },
    ],
    ready: true,
    service: "ops-web",
  });
}

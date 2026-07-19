import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    appEnv: process.env.APP_ENV || "local",
    service: "ops-web",
    status: "ok",
  });
}

import { describe, expect, it, vi } from "vitest";
import { createConsumerAuth } from "./consumer-auth.js";
import type { OtpDeliveryMessage } from "./otp-delivery.js";

const baseUrl = "http://127.0.0.1:3000";
const secret = "off-01-test-secret-with-at-least-thirty-two-characters";
const clientIps = new WeakMap<object, string>();
let fixtureSequence = 0;

function createFixture() {
  const deliveries: OtpDeliveryMessage[] = [];
  const auth = createConsumerAuth({
    baseUrl,
    otpDelivery: {
      async send(message) {
        deliveries.push(message);
      },
    },
    secret,
    trustedOrigins: [baseUrl, "littlearc://"],
  });
  fixtureSequence += 1;
  clientIps.set(auth, `192.0.2.${fixtureSequence}`);

  return { auth, deliveries };
}

async function authRequest(
  auth: ReturnType<typeof createConsumerAuth>,
  path: string,
  body?: unknown,
  cookie?: string,
  origin = baseUrl,
): Promise<Response> {
  const headers = new Headers({ origin });
  headers.set("x-forwarded-for", clientIps.get(auth) ?? "192.0.2.254");
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }

  return auth.handler(
    new Request(`${baseUrl}/v1/auth${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers,
      method: body === undefined ? "GET" : "POST",
    }),
  );
}

function sessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("better-auth.session_token="));
  if (!cookie) {
    throw new Error("Expected Better Auth to issue a session cookie.");
  }
  return cookie.split(";", 1)[0] ?? cookie;
}

async function signIn(
  fixture: ReturnType<typeof createFixture>,
  email: string,
): Promise<{ readonly cookie: string; readonly token: string }> {
  const sendResponse = await authRequest(fixture.auth, "/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  expect(sendResponse.status).toBe(200);
  const delivery = fixture.deliveries.at(-1);
  expect(delivery).toMatchObject({ email, purpose: "sign-in" });

  const signInResponse = await authRequest(fixture.auth, "/sign-in/email-otp", {
    email,
    otp: delivery?.otp,
  });
  expect(signInResponse.status).toBe(200);
  const body = (await signInResponse.json()) as { readonly token: string };

  return {
    cookie: sessionCookie(signInResponse),
    token: body.token,
  };
}

describe("consumer authentication", () => {
  it("uses uniform OTP-request responses and never returns the code", async () => {
    const fixture = createFixture();
    const first = await authRequest(fixture.auth, "/email-otp/send-verification-otp", {
      email: "synthetic.one@example.test",
      type: "sign-in",
    });
    const second = await authRequest(fixture.auth, "/email-otp/send-verification-otp", {
      email: "synthetic.two@example.test",
      type: "sign-in",
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = await first.text();
    const secondBody = await second.text();
    expect(firstBody).toBe(secondBody);
    expect(fixture.deliveries).toHaveLength(2);
    for (const delivery of fixture.deliveries) {
      expect(firstBody).not.toContain(delivery.otp);
      expect(secondBody).not.toContain(delivery.otp);
    }
  });

  it("establishes, lists, revokes, and invalidates a remote session", async () => {
    const fixture = createFixture();
    const first = await signIn(fixture, "synthetic.session@example.test");
    const second = await signIn(fixture, "synthetic.session@example.test");

    const listResponse = await authRequest(
      fixture.auth,
      "/list-sessions",
      undefined,
      second.cookie,
    );
    expect(listResponse.status).toBe(200);
    const sessions = (await listResponse.json()) as ReadonlyArray<{ readonly token: string }>;
    expect(sessions.map((session) => session.token)).toEqual(
      expect.arrayContaining([first.token, second.token]),
    );
    const identity = await fixture.auth.getSessionIdentity(new Headers({ cookie: second.cookie }));
    expect(identity).toMatchObject({ userId: expect.any(String) });
    expect(identity?.authenticatedAt).toBeInstanceOf(Date);

    const revokeResponse = await authRequest(
      fixture.auth,
      "/revoke-session",
      { token: first.token },
      second.cookie,
    );
    expect(revokeResponse.status).toBe(200);

    const revokedSession = await authRequest(fixture.auth, "/get-session", undefined, first.cookie);
    expect(await revokedSession.json()).toBeNull();
  });

  it("makes OTPs single-use and exhausts them after three failed attempts", async () => {
    const singleUseFixture = createFixture();
    const singleUse = await signIn(singleUseFixture, "synthetic.single-use@example.test");
    const usedOtp = singleUseFixture.deliveries.at(-1)?.otp;
    const reuseResponse = await authRequest(singleUseFixture.auth, "/sign-in/email-otp", {
      email: "synthetic.single-use@example.test",
      otp: usedOtp,
    });
    expect(reuseResponse.status).toBe(400);
    expect(singleUse.cookie).toContain("better-auth.session_token=");

    const exhaustedFixture = createFixture();
    await authRequest(exhaustedFixture.auth, "/email-otp/send-verification-otp", {
      email: "synthetic.exhausted@example.test",
      type: "sign-in",
    });
    const validOtp = exhaustedFixture.deliveries.at(-1)?.otp;
    for (const otp of ["000000", "000001", "000002"]) {
      const response = await authRequest(exhaustedFixture.auth, "/sign-in/email-otp", {
        email: "synthetic.exhausted@example.test",
        otp,
      });
      expect(response.status).toBe(400);
    }
    clientIps.set(exhaustedFixture.auth, "192.0.2.253");
    const exhaustedResponse = await authRequest(exhaustedFixture.auth, "/sign-in/email-otp", {
      email: "synthetic.exhausted@example.test",
      otp: validOtp,
    });
    expect(exhaustedResponse.status).toBe(403);
  });

  it("revokes every other session and signs out the retained session", async () => {
    const fixture = createFixture();
    const first = await signIn(fixture, "synthetic.revoke-others@example.test");
    const second = await signIn(fixture, "synthetic.revoke-others@example.test");

    const revokeOthers = await authRequest(
      fixture.auth,
      "/revoke-other-sessions",
      {},
      second.cookie,
    );
    expect(revokeOthers.status).toBe(200);
    expect(
      await (await authRequest(fixture.auth, "/get-session", undefined, first.cookie)).json(),
    ).toBeNull();
    expect(
      await (await authRequest(fixture.auth, "/get-session", undefined, second.cookie)).json(),
    ).not.toBeNull();

    const signOut = await authRequest(fixture.auth, "/sign-out", {}, second.cookie);
    expect(signOut.status).toBe(200);
    expect(
      await (await authRequest(fixture.auth, "/get-session", undefined, second.cookie)).json(),
    ).toBeNull();
  });

  it("rate limits OTP sends even outside production mode", async () => {
    const fixture = createFixture();
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await authRequest(fixture.auth, "/email-otp/send-verification-otp", {
        email: "synthetic.rate-limit@example.test",
        type: "sign-in",
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(fixture.deliveries).toHaveLength(3);
  });

  it("rejects an OTP after its five-minute lifetime", async () => {
    vi.useFakeTimers();
    try {
      const fixture = createFixture();
      const email = "synthetic.expired@example.test";
      await authRequest(fixture.auth, "/email-otp/send-verification-otp", {
        email,
        type: "sign-in",
      });
      const otp = fixture.deliveries.at(-1)?.otp;
      await vi.advanceTimersByTimeAsync(301_000);

      const response = await authRequest(fixture.auth, "/sign-in/email-otp", {
        email,
        otp,
      });
      expect(response.status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects hostile origins and unsafe configuration", async () => {
    const fixture = createFixture();
    const response = await authRequest(
      fixture.auth,
      "/email-otp/send-verification-otp",
      { email: "synthetic.origin@example.test", type: "sign-in" },
      undefined,
      "https://hostile.example",
    );
    expect(response.status).toBe(403);

    expect(() =>
      createConsumerAuth({
        baseUrl,
        otpDelivery: { async send() {} },
        secret: "too-short",
        trustedOrigins: [baseUrl],
      }),
    ).toThrow("at least 32 characters");
    expect(() =>
      createConsumerAuth({
        baseUrl: "https://api.littlearc.app",
        otpDelivery: { async send() {} },
        production: true,
        secret,
        trustedOrigins: ["littlearc://*"],
      }),
    ).toThrow("requires PostgreSQL-backed state");
    expect(() =>
      createConsumerAuth({
        baseUrl,
        database: {} as never,
        otpDelivery: { async send() {} },
        production: true,
        secret,
        trustedOrigins: ["https://app.littlearc.app"],
      }),
    ).toThrow("HTTPS base URL");
    expect(() =>
      createConsumerAuth({
        baseUrl: "https://api.littlearc.app",
        database: {} as never,
        otpDelivery: { async send() {} },
        production: true,
        secret,
        trustedOrigins: ["littlearc://*"],
      }),
    ).toThrow("must not contain wildcards");
  });

  it("normalizes a long trailing-slash suffix without rejecting a trusted origin", async () => {
    const fixture = createFixture();
    const response = await authRequest(
      fixture.auth,
      "/get-session",
      undefined,
      undefined,
      `${baseUrl}${"/".repeat(10_000)}`,
    );

    expect(response.status).toBe(200);
  });
});

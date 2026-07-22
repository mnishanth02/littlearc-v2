export const recentAuthenticationWindowSeconds = 60 * 10;

export type RecentAuthenticationInput = {
  readonly authenticatedAt: Date | string | null | undefined;
  readonly now?: Date;
  readonly windowSeconds?: number;
};

export class RecentAuthenticationRequiredError extends Error {
  readonly code = "recent_authentication_required";

  constructor() {
    super("Recent authentication is required for this action.");
    this.name = "RecentAuthenticationRequiredError";
  }
}

export function hasRecentAuthentication(input: RecentAuthenticationInput): boolean {
  if (!input.authenticatedAt) {
    return false;
  }
  const authenticatedAt =
    input.authenticatedAt instanceof Date ? input.authenticatedAt : new Date(input.authenticatedAt);
  const now = input.now ?? new Date();
  const windowMilliseconds = (input.windowSeconds ?? recentAuthenticationWindowSeconds) * 1_000;
  const ageMilliseconds = now.getTime() - authenticatedAt.getTime();

  return (
    Number.isFinite(authenticatedAt.getTime()) &&
    ageMilliseconds >= 0 &&
    ageMilliseconds <= windowMilliseconds
  );
}

export function assertRecentAuthentication(input: RecentAuthenticationInput): void {
  if (!hasRecentAuthentication(input)) {
    throw new RecentAuthenticationRequiredError();
  }
}

import { wipeLocalSecurity, withUnlockedLocalDatabase } from "../local-security/native";
import { runSignOutWithLocalWipe } from "../local-security/policy";
import { countRiskyMutations } from "../sync/repository";
import { mobileAuthClient } from "./client";

export async function signOutConsumerAndWipeLocalData(options?: {
  readonly confirmDiscardUnsynchronizedWork: (
    riskyMutationCount: number | null,
  ) => Promise<boolean>;
}): Promise<void> {
  let riskyMutationCount: number | null = null;
  try {
    riskyMutationCount = await withUnlockedLocalDatabase(countRiskyMutations);
  } catch (error) {
    riskyMutationCount =
      error instanceof Error && error.message === "This installation is not enrolled." ? 0 : null;
  }
  if (riskyMutationCount === null || riskyMutationCount > 0) {
    const confirmed = options
      ? await options.confirmDiscardUnsynchronizedWork(riskyMutationCount)
      : false;
    if (!confirmed) {
      throw new Error("Sign-out requires confirmation before discarding unsynchronized work.");
    }
  }
  await runSignOutWithLocalWipe({
    remoteSignOut: () => mobileAuthClient.signOut(),
    wipeLocalSecurity,
  });
}

import { wipeLocalSecurity } from "../local-security/native";
import { runSignOutWithLocalWipe } from "../local-security/policy";
import { mobileAuthClient } from "./client";

export async function signOutConsumerAndWipeLocalData(): Promise<void> {
  await runSignOutWithLocalWipe({
    remoteSignOut: () => mobileAuthClient.signOut(),
    wipeLocalSecurity,
  });
}

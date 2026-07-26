import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { getMobileEnvironment } from "../bootstrap/environment";

const environment = getMobileEnvironment();

export const mobileAuthClient = createAuthClient({
  baseURL: `${environment.apiBaseUrl.replace(/\/$/, "")}/v1/auth`,
  plugins: [
    expoClient({
      scheme: "littlearc",
      storage: SecureStore,
      storagePrefix: "littlearc.auth",
    }),
    emailOTPClient(),
  ],
});

import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

const baseURL = process.env.EXPO_PUBLIC_AUTH_BASE_URL ?? 'http://127.0.0.1:8080';

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'littlearc-m0',
      storage: SecureStore,
      storagePrefix: 'littlearc-m0',
    }),
  ],
});

export const authProbeConfiguration = {
  baseURL,
  configuredFromEnvironment: process.env.EXPO_PUBLIC_AUTH_BASE_URL !== undefined,
} as const;


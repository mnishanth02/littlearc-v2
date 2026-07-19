export const featureFlagDefinitions = {
  ai_extraction: {
    defaultValue: false,
    expiresAt: "2027-07-19",
    owner: "UTL-08",
  },
  caregiver_sharing: {
    defaultValue: false,
    expiresAt: "2027-07-19",
    owner: "UTL-06",
  },
  notifications: {
    defaultValue: false,
    expiresAt: "2027-07-19",
    owner: "UTL-02",
  },
  uploads: {
    defaultValue: false,
    expiresAt: "2027-07-19",
    owner: "VLT-04",
  },
} as const;

export type FeatureFlagName = keyof typeof featureFlagDefinitions;

export type FeatureFlagProvider = {
  readonly isEnabled: (flag: FeatureFlagName) => Promise<boolean>;
};

export type FeatureFlags = {
  readonly isEnabled: (flag: FeatureFlagName) => Promise<boolean>;
};

export type FeatureFlagOptions = {
  readonly provider?: FeatureFlagProvider;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
};

export function createFeatureFlags(options: FeatureFlagOptions = {}): FeatureFlags {
  return {
    async isEnabled(flag) {
      const definition = featureFlagDefinitions[flag];
      const now = (options.now ?? (() => new Date()))();

      if (!definition || isExpired(definition.expiresAt, now) || !options.provider) {
        return false;
      }

      try {
        const result = await withTimeout(
          options.provider.isEnabled(flag),
          options.timeoutMs ?? 250,
        );
        return typeof result === "boolean" ? result : definition.defaultValue;
      } catch {
        return definition.defaultValue;
      }
    },
  };
}

export function assertFeatureFlagDefinitions(now = new Date()): void {
  for (const [name, definition] of Object.entries(featureFlagDefinitions)) {
    if (
      definition.defaultValue !== false ||
      !definition.owner ||
      isExpired(definition.expiresAt, now)
    ) {
      throw new Error(`Feature flag definition requires review: ${name}`);
    }
  }
}

function isExpired(expiresAt: string, now: Date): boolean {
  const expiry = Date.parse(`${expiresAt}T23:59:59.999Z`);
  return !Number.isFinite(expiry) || expiry < now.getTime();
}

async function withTimeout<Value>(promise: Promise<Value>, timeoutMs: number): Promise<Value> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Feature flag timeout must be positive");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Feature flag provider timed out")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

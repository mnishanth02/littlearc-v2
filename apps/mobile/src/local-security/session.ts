export type LocalSecuritySessionCache<T> = {
  readonly current: () => T | undefined;
  readonly getOrUnlock: (unlock: () => Promise<T>) => Promise<T>;
  readonly lock: () => void;
};

export function createLocalSecuritySessionCache<T>(): LocalSecuritySessionCache<T> {
  let generation = 0;
  let session: T | undefined;
  let pending: Promise<T> | undefined;

  return {
    current() {
      return session;
    },
    getOrUnlock(unlock) {
      if (session !== undefined) {
        return Promise.resolve(session);
      }
      if (pending) {
        return pending;
      }
      const unlockGeneration = generation;
      const nextPending = unlock()
        .then((next) => {
          if (unlockGeneration !== generation) {
            throw new Error("The local-security session was locked during authentication.");
          }
          session = next;
          return next;
        })
        .finally(() => {
          if (pending === nextPending) {
            pending = undefined;
          }
        });
      pending = nextPending;
      return nextPending;
    },
    lock() {
      generation += 1;
      session = undefined;
      pending = undefined;
    },
  };
}

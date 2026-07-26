export type ParserPermit = {
  readonly run: <Result>(operation: () => Promise<Result>, signal?: AbortSignal) => Promise<Result>;
};

export function createParserPermit(): ParserPermit {
  let tail = Promise.resolve();
  return {
    async run(operation, signal) {
      signal?.throwIfAborted();
      let release!: () => void;
      const previous = tail;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        signal?.throwIfAborted();
        return await operation();
      } finally {
        release();
      }
    },
  };
}

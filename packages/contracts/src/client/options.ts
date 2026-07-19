export type ApiClientHeaders = Record<string, string>;
export type ApiClientFetch = typeof globalThis.fetch;

export type ApiClientOptions = {
  readonly baseUrl: string;
  readonly headers?: ApiClientHeaders;
  readonly fetch?: ApiClientFetch;
};

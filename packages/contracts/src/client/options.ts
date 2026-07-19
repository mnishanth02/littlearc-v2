export type ApiClientHeaders = Record<string, string>;
export type ApiClientFetch = (input: Request) => Promise<Response>;

export type ApiClientOptions = {
  readonly baseUrl: string;
  readonly headers?: ApiClientHeaders;
  readonly fetch?: ApiClientFetch;
};

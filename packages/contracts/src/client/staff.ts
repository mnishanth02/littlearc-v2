import createClient from "openapi-fetch";
import type { paths } from "../generated/openapi-types.js";
import type { ApiClientOptions } from "./options.js";

export function createStaffApiClient(options: ApiClientOptions) {
  const clientOptions = {
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
  };

  return createClient<paths>(clientOptions);
}

export type StaffApiClient = ReturnType<typeof createStaffApiClient>;

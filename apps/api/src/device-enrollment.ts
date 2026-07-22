import type { DatabaseClient } from "@littlearc/database";
import { persistDeviceEnrollment } from "@littlearc/database";
import type { DeviceEnrollmentCommand } from "./device-enrollment-route.js";

export function createDeviceEnrollmentCommand(database: DatabaseClient): DeviceEnrollmentCommand {
  return {
    execute(input) {
      return persistDeviceEnrollment(database, {
        ...input.request,
        identityUserId: input.identityUserId,
        requestId: input.requestId,
      });
    },
  };
}

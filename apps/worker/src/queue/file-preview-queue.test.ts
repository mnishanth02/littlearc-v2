import { describe, expect, it } from "vitest";
import {
  filePreviewDeadLetterQueueName,
  filePreviewQueueDefinition,
  filePreviewQueueName,
  parseFilePreviewPayload,
} from "./file-preview-queue.js";

const derivativeId = "019d3157-2000-7000-8000-000000000003";

describe("file preview queue", () => {
  it("uses the reviewed retry and dead-letter boundary", () => {
    expect(filePreviewQueueName).toBe("file-preview-v1");
    expect(filePreviewDeadLetterQueueName).toBe("file-preview-dead-v1");
    expect(filePreviewQueueDefinition).toMatchObject({
      deadLetter: filePreviewDeadLetterQueueName,
      expireInSeconds: 900,
      heartbeatSeconds: 60,
      retryDelay: 30,
      retryDelayMax: 900,
      retryLimit: 5,
    });
  });

  it("accepts only the minimized derivative identifier payload", () => {
    expect(parseFilePreviewPayload({ derivativeId })).toBe(derivativeId);
    expect(() => parseFilePreviewPayload({ derivativeId, filename: "forbidden.jpg" })).toThrow(
      "unsupported fields",
    );
    expect(JSON.stringify({ derivativeId })).not.toContain("household");
  });
});

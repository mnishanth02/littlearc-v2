import { describe, expect, it } from "vitest";
import { PreviewRendererError, parseChildResult } from "./renderer.js";

describe("preview renderer protocol", () => {
  it("accepts only minimized bounded renderer results", () => {
    expect(
      parseChildResult(
        JSON.stringify({ bytes: 1024, height: 600, status: "rendered", width: 800 }),
      ),
    ).toEqual({ bytes: 1024, height: 600, status: "rendered", width: 800 });
    expect(() =>
      parseChildResult(
        JSON.stringify({
          bytes: 1024,
          filename: "forbidden.jpg",
          height: 600,
          status: "rendered",
          width: 800,
        }),
      ),
    ).toThrow(PreviewRendererError);
  });

  it("maps only allowlisted safe child errors", () => {
    expect(
      parseChildResult(JSON.stringify({ code: "output_invalid", status: "rejected" })),
    ).toEqual({ code: "output_invalid", status: "rejected" });
    expect(() =>
      parseChildResult(
        JSON.stringify({ code: "/tmp/private/source.jpg failed", status: "rejected" }),
      ),
    ).toThrow(PreviewRendererError);
  });
});

import { describe, expect, it } from "vitest";
import { inspectQpdfJson } from "./pdf.js";

function qpdfJson(extra: Record<string, unknown> = {}, pageCount = 1): Record<string, unknown> {
  return {
    pages: Array.from({ length: pageCount }, (_, index) => ({ object: `obj:${index + 1} 0 R` })),
    qpdf: [{ jsonversion: 2 }, { "obj:1 0 R": { value: { "/Type": "/Catalog" } } }],
    ...extra,
  };
}

describe("bounded PDF policy", () => {
  it("accepts bounded static page content", () => {
    expect(inspectQpdfJson(qpdfJson())).toEqual({ pageCount: 1 });
    expect(inspectQpdfJson(qpdfJson({}, 50))).toEqual({ pageCount: 50 });
  });

  it.each([
    ["/JavaScript", "pdf_active_content"],
    ["/OpenAction", "pdf_active_content"],
    ["/AcroForm", "pdf_active_content"],
    ["/URI", "pdf_active_content"],
    ["/EmbeddedFiles", "pdf_embedded_content"],
    ["/Filespec", "pdf_embedded_content"],
  ])("rejects prohibited structured token %s", (token, code) => {
    expect(() =>
      inspectQpdfJson(
        qpdfJson({
          qpdf: [{ jsonversion: 2 }, { "obj:99 0 R": { value: { [token]: true } } }],
        }),
      ),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("rejects encrypted and over-page-limit documents", () => {
    expect(() => inspectQpdfJson(qpdfJson({ encrypt: true }))).toThrow(
      expect.objectContaining({ code: "pdf_encrypted" }),
    );
    expect(() => inspectQpdfJson(qpdfJson({}, 51))).toThrow(
      expect.objectContaining({ code: "resource_limit_exceeded" }),
    );
  });
});

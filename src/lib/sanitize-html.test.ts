// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "./sanitize-html";

describe("sanitizeRichText", () => {
  it("preserves supported rich text", () => {
    expect(sanitizeRichText('<p><strong>Texto</strong> <a href="https://example.com">seguro</a></p>'))
      .toBe('<p><strong>Texto</strong> <a href="https://example.com">seguro</a></p>');
  });

  it("removes executable markup", () => {
    const sanitized = sanitizeRichText(
      '<img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">link</a>',
    );

    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("javascript:");
  });
});

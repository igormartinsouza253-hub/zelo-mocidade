import DOMPurify from "dompurify";

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["form", "iframe", "object", "embed"],
    FORBID_ATTR: ["formaction"],
  });
}

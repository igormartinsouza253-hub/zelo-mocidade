const NOTE_BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre";

const normalizeInlineWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export function noteHtmlToPlainText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;

  root.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  root.querySelectorAll("li").forEach((element) => {
    element.prepend("• ");
    element.append("\n");
  });
  root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, blockquote, pre").forEach((element) => {
    element.append("\n");
  });

  return (root.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getNoteFirstLine(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;

  for (const element of root.querySelectorAll(NOTE_BLOCK_SELECTOR)) {
    const line = normalizeInlineWhitespace(element.textContent || "");
    if (line) return line.slice(0, 120);
  }

  const firstLine = noteHtmlToPlainText(html)
    .split(/\r?\n/)
    .map(normalizeInlineWhitespace)
    .find(Boolean);

  return firstLine?.slice(0, 120) || "Sem título";
}

export function resolveNoteTitle(title: string | null | undefined, html: string): string {
  const normalizedTitle = title?.trim() || "";
  const fallbackTitle = getNoteFirstLine(html);

  if (!normalizedTitle || normalizedTitle === "Sem título") return fallbackTitle;

  // A primeira migração gerava títulos substituindo todas as tags por espaços e
  // cortando os 120 primeiros caracteres. Reconhecemos esse formato para que as
  // notas antigas passem a exibir somente a primeira linha do conteúdo.
  const legacyGeneratedTitle = html.replace(/<[^>]+>/g, " ").trim().slice(0, 120);
  if (normalizeInlineWhitespace(normalizedTitle) === normalizeInlineWhitespace(legacyGeneratedTitle)) {
    return fallbackTitle;
  }

  return normalizedTitle;
}

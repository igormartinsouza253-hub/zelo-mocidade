import { noteHtmlToPlainText, resolveNoteTitle } from "@/lib/note-content";

interface ExportNotePdfOptions {
  title: string | null | undefined;
  html: string;
  author?: string | null;
  createdAt?: string | null;
}

export async function exportNotePdf({ title, html, author, createdAt }: ExportNotePdfOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const resolvedTitle = resolveNoteTitle(title, html);
  const resolvedAuthor = author?.trim() || "Usuário";
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  pdf.setProperties({ title: resolvedTitle, author: resolvedAuthor, subject: "Nota exportada pelo Zelo" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(32, 32, 30);
  const titleLines = pdf.splitTextToSize(resolvedTitle, contentWidth) as string[];
  pdf.text(titleLines, margin, margin);

  let y = margin + titleLines.length * 7 + 2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(105, 105, 98);
  pdf.text(`${formattedDate} - ${resolvedAuthor}`, margin, y);
  y += 7;
  pdf.setDrawColor(215, 211, 199);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  pdf.setFontSize(11);
  pdf.setTextColor(40, 40, 37);
  const bodyLines = pdf.splitTextToSize(noteHtmlToPlainText(html), contentWidth) as string[];
  const lineHeight = 6;

  for (const line of bodyLines) {
    if (y > pageHeight - margin - 8) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line || " ", margin, y);
    y += lineHeight;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 124);
    pdf.text(`${page} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  const filename = resolvedTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "nota";
  pdf.save(`${filename}.pdf`);
}

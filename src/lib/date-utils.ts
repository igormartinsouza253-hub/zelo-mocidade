/**
 * Faz parse de datas locais no formato YYYY-MM-DD (ou ISO com horário)
 * sem sofrer deslocamento de timezone.
 */
const parseLocalDate = (value: string): Date | null => {
  if (!value) return null;

  const normalized = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = normalized.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formata uma data local para exibição longa em português.
 */
export const formatDateLocal = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  if (!date) return "Data inválida";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

/**
 * Formata uma data local para exibição curta em português.
 */
export const formatDateShort = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  if (!date) return "--/--/----";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/**
 * Converte uma data do formato Date para YYYY-MM-DD
 */
export const dateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

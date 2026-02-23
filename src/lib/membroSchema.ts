import { z } from "zod";

export const membroSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  data_nascimento: z
    .string()
    .optional()
    .refine((date) => {
      if (!date || date === "") return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 0 && age <= 120;
    }, "Data de nascimento inválida"),
  data_aniversario: z
    .string()
    .optional()
    .refine(
      (date) => !date || date === "" || /^\d{2}-\d{2}$/.test(date),
      "Formato de aniversário inválido (use DD-MM)",
    ),
  faixa_etaria: z.enum(["Crianças", "Meninos", "Meninas", "Moços", "Moças"], {
    errorMap: () => ({ message: "Selecione uma faixa etária" }),
  }),
  cargos: z.array(z.string()).max(10, "Máximo de 10 cargos permitidos"),
  telefone: z
    .string()
    .max(20, "Telefone muito longo")
    .optional()
    .or(z.literal("")),
  status_telefone: z.string().optional().or(z.literal("")),
  observacoes: z
    .string()
    .max(1000, "Observações devem ter no máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type MembroFormValues = z.infer<typeof membroSchema>;

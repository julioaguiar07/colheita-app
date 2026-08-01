import * as z from "zod";
import { Produto, UnidadeMedida } from "@/generated/prisma/enums";

export const VendaFormSchema = z.object({
  data: z.string().min(1, { error: "Informe a data." }),
  produto: z.enum(Produto, { error: "Selecione o produto." }),
  cliente: z.string().optional(),
  unidade: z.enum(UnidadeMedida, { error: "Selecione a unidade." }),
  qtd: z.coerce.number().positive({ error: "Quantidade deve ser maior que zero." }),
  valorUnit: z.coerce.number().positive({ error: "Valor unitário deve ser maior que zero." }),
  deduzirEstoque: z.enum(["true", "false"]).transform((v) => v === "true"),
  area: z.string().optional(),
  safra: z.string().optional(),
});

export type VendaFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

import * as z from "zod";
import { CategoriaDespesa, Produto, UnidadeMedida } from "@/generated/prisma/enums";

export const DespesaFormSchema = z
  .object({
    data: z.string().min(1, { error: "Informe a data." }),
    categoria: z.enum(CategoriaDespesa, { error: "Selecione uma categoria." }),
    custoProducao: z.enum(["true", "false"]).transform((v) => v === "true"),
    produto: z.enum(Produto).optional().or(z.literal("")),
    qtd: z.coerce.number().positive().optional().or(z.literal("")),
    unidade: z.enum(UnidadeMedida).optional().or(z.literal("")),
    valorUnit: z.coerce.number().positive().optional().or(z.literal("")),
    total: z.coerce.number().positive().optional().or(z.literal("")),
    obs: z.string().optional(),
    safra: z.string().optional(),
  })
  .refine((data) => !data.custoProducao || !!data.produto, {
    error: "Selecione o produto quando o lançamento é custo de produção.",
    path: ["produto"],
  })
  .refine((data) => (data.qtd && data.valorUnit) || (data.total && Number(data.total) > 0), {
    error: "Informe quantidade + valor unitário, ou um valor total.",
    path: ["total"],
  });

export type DespesaFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

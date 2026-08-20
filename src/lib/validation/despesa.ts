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
  // Nota: "custo de produção" e "vínculo com produto" são informações independentes.
  // Um custo de produção continua sendo custo de produção mesmo sem produto vinculado
  // (ex.: pagamento de funcionário que não é atribuível a um produto específico), e uma
  // despesa geral também pode estar vinculada a um produto. Por isso não há refine
  // obrigando produto quando custoProducao é true.
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

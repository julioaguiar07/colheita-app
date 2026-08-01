import * as z from "zod";
import { Produto, UnidadeMedida, TipoMovimentacaoEstoque } from "@/generated/prisma/enums";

export const MovimentacaoFormSchema = z
  .object({
    data: z.string().min(1, { error: "Informe a data." }),
    produto: z.enum(Produto, { error: "Selecione o produto." }),
    unidade: z.enum(UnidadeMedida, { error: "Selecione a unidade." }),
    tipo: z.enum(TipoMovimentacaoEstoque, { error: "Selecione o tipo." }),
    qtd: z.coerce.number().positive({ error: "Quantidade deve ser maior que zero." }),
    custoUnitario: z.coerce.number().nonnegative().optional().or(z.literal("")),
    obs: z.string().optional(),
  })
  .refine((data) => data.tipo !== "ENTRADA" || (data.custoUnitario !== "" && data.custoUnitario !== undefined), {
    error: "Informe o custo unitário para entradas de estoque.",
    path: ["custoUnitario"],
  });

export type MovimentacaoFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

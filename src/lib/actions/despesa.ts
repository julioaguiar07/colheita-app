"use server";

import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { requireFazenda } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit/log";
import { DespesaFormSchema, type DespesaFormState } from "@/lib/validation/despesa";
import { flattenFieldErrors } from "@/lib/validation/utils";
import type { Produto, UnidadeMedida } from "@/generated/prisma/enums";

/** Sentinela do <Select> de produto para "sem vínculo" — vira null no banco. */
const PRODUTO_NENHUM = "NENHUM";

export async function createDespesa(_state: DespesaFormState, formData: FormData): Promise<DespesaFormState> {
  const usuario = await requireFazenda();

  const produtoRaw = formData.get("produto");
  const produto = !produtoRaw || produtoRaw === PRODUTO_NENHUM ? "" : produtoRaw;

  const validated = DespesaFormSchema.safeParse({
    data: formData.get("data"),
    categoria: formData.get("categoria"),
    custoProducao: formData.get("custoProducao") ?? "false",
    produto,
    qtd: formData.get("qtd") ?? "",
    unidade: formData.get("unidade") ?? "",
    valorUnit: formData.get("valorUnit") ?? "",
    total: formData.get("total") ?? "",
    obs: formData.get("obs") ?? "",
    safra: formData.get("safra") ?? "",
  });

  if (!validated.success) {
    return { errors: flattenFieldErrors(validated.error) };
  }

  const v = validated.data;
  const total = v.qtd && v.valorUnit ? Math.round(Number(v.qtd) * Number(v.valorUnit) * 100) / 100 : Number(v.total);

  const despesa = await db.despesa.create({
    data: {
      id: createId(),
      fazendaId: usuario.fazendaId,
      criadoPorId: usuario.id,
      data: new Date(v.data),
      categoria: v.categoria,
      custoProducao: v.custoProducao,
      produto: (v.produto || null) as Produto | null,
      qtd: v.qtd ? Number(v.qtd) : null,
      unidade: (v.unidade || null) as UnidadeMedida | null,
      valorUnit: v.valorUnit ? Number(v.valorUnit) : null,
      total,
      obs: v.obs || null,
      safra: v.safra || null,
    },
  });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "CREATE_DESPESA",
    entidade: "Despesa",
    entidadeId: despesa.id,
  });

  revalidatePath("/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/produtos");
  return { message: "success" };
}

export async function deleteDespesa(id: string) {
  const usuario = await requireFazenda();

  const despesa = await db.despesa.findFirst({ where: { id, fazendaId: usuario.fazendaId } });
  if (!despesa) return;

  await db.despesa.delete({ where: { id } });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "DELETE_DESPESA",
    entidade: "Despesa",
    entidadeId: id,
  });

  revalidatePath("/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/produtos");
}

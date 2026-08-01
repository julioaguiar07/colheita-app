"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFazenda } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit/log";
import { registrarMovimentacaoEstoque, recalcularSaldoEstoque } from "@/lib/estoque/valuation";
import { MovimentacaoFormSchema, type MovimentacaoFormState } from "@/lib/validation/estoque";
import { flattenFieldErrors } from "@/lib/validation/utils";

export async function createMovimentacao(
  _state: MovimentacaoFormState,
  formData: FormData
): Promise<MovimentacaoFormState> {
  const usuario = await requireFazenda();

  const validated = MovimentacaoFormSchema.safeParse({
    data: formData.get("data"),
    produto: formData.get("produto"),
    unidade: formData.get("unidade"),
    tipo: formData.get("tipo"),
    qtd: formData.get("qtd"),
    custoUnitario: formData.get("custoUnitario") ?? "",
    obs: formData.get("obs") ?? "",
  });

  if (!validated.success) {
    return { errors: flattenFieldErrors(validated.error) };
  }

  const v = validated.data;

  const movimento = await db.$transaction((tx) =>
    registrarMovimentacaoEstoque(tx, {
      fazendaId: usuario.fazendaId,
      criadoPorId: usuario.id,
      data: new Date(v.data),
      produto: v.produto,
      unidade: v.unidade,
      tipo: v.tipo,
      qtd: v.qtd,
      custoUnitarioEntrada: v.custoUnitario ? Number(v.custoUnitario) : undefined,
      obs: v.obs || null,
    })
  );

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "CREATE_MOVIMENTACAO_ESTOQUE",
    entidade: "EstoqueMovimentacao",
    entidadeId: movimento.id,
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  return { message: "success" };
}

export async function deleteMovimentacao(id: string) {
  const usuario = await requireFazenda();

  const movimento = await db.estoqueMovimentacao.findFirst({
    where: { id, fazendaId: usuario.fazendaId, vendaId: null },
  });
  if (!movimento) return;

  await db.$transaction(async (tx) => {
    await tx.estoqueMovimentacao.delete({ where: { id } });
    await recalcularSaldoEstoque(tx, {
      fazendaId: usuario.fazendaId,
      produto: movimento.produto,
      unidade: movimento.unidade,
    });
  });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "DELETE_MOVIMENTACAO_ESTOQUE",
    entidade: "EstoqueMovimentacao",
    entidadeId: id,
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
}

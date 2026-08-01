"use server";

import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { requireFazenda } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit/log";
import { registrarMovimentacaoEstoque, recalcularSaldoEstoque } from "@/lib/estoque/valuation";
import { VendaFormSchema, type VendaFormState } from "@/lib/validation/venda";
import { flattenFieldErrors } from "@/lib/validation/utils";
import { TipoMovimentacaoEstoque } from "@/generated/prisma/enums";

export async function createVenda(_state: VendaFormState, formData: FormData): Promise<VendaFormState> {
  const usuario = await requireFazenda();

  const validated = VendaFormSchema.safeParse({
    data: formData.get("data"),
    produto: formData.get("produto"),
    cliente: formData.get("cliente") ?? "",
    unidade: formData.get("unidade"),
    qtd: formData.get("qtd"),
    valorUnit: formData.get("valorUnit"),
    deduzirEstoque: formData.get("deduzirEstoque") ?? "false",
    area: formData.get("area") ?? "",
    safra: formData.get("safra") ?? "",
  });

  if (!validated.success) {
    return { errors: flattenFieldErrors(validated.error) };
  }

  const v = validated.data;
  const total = Math.round(v.qtd * v.valorUnit * 100) / 100;
  const vendaId = createId();
  const data = new Date(v.data);

  await db.$transaction(async (tx) => {
    await tx.venda.create({
      data: {
        id: vendaId,
        fazendaId: usuario.fazendaId,
        criadoPorId: usuario.id,
        data,
        produto: v.produto,
        cliente: v.cliente || null,
        unidade: v.unidade,
        qtd: v.qtd,
        valorUnit: v.valorUnit,
        total,
        area: v.area || null,
        safra: v.safra || null,
      },
    });

    if (v.deduzirEstoque) {
      await registrarMovimentacaoEstoque(tx, {
        fazendaId: usuario.fazendaId,
        criadoPorId: usuario.id,
        data,
        produto: v.produto,
        unidade: v.unidade,
        tipo: TipoMovimentacaoEstoque.SAIDA,
        qtd: v.qtd,
        obs: "Saída automática por venda",
        vendaId,
      });
    }
  });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "CREATE_VENDA",
    entidade: "Venda",
    entidadeId: vendaId,
  });

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/produtos");
  revalidatePath("/estoque");
  return { message: "success" };
}

export async function deleteVenda(id: string) {
  const usuario = await requireFazenda();

  const venda = await db.venda.findFirst({
    where: { id, fazendaId: usuario.fazendaId },
    include: { estoqueMovimentacoes: true },
  });
  if (!venda) return;

  await db.$transaction(async (tx) => {
    await tx.venda.delete({ where: { id } });
    for (const mov of venda.estoqueMovimentacoes) {
      await recalcularSaldoEstoque(tx, {
        fazendaId: usuario.fazendaId,
        produto: mov.produto,
        unidade: mov.unidade,
      });
    }
  });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "DELETE_VENDA",
    entidade: "Venda",
    entidadeId: id,
  });

  revalidatePath("/vendas");
  revalidatePath("/dashboard");
  revalidatePath("/produtos");
  revalidatePath("/estoque");
}

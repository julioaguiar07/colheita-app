import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@/generated/prisma/client";
import { Produto, UnidadeMedida, TipoMovimentacaoEstoque } from "@/generated/prisma/enums";

type TxClient = Prisma.TransactionClient;

export interface RegistrarMovimentacaoInput {
  fazendaId: string;
  criadoPorId?: number | null;
  data: Date;
  produto: Produto;
  unidade: UnidadeMedida;
  tipo: TipoMovimentacaoEstoque;
  qtd: number;
  /** Only meaningful for ENTRADA — the unit cost paid. Ignored for SAIDA (cost is snapshotted from the running average). */
  custoUnitarioEntrada?: number;
  obs?: string | null;
  vendaId?: string | null;
}

/**
 * Records one stock movement and updates the weighted-average balance in the same
 * transaction. SAIDA snapshots the cost from the running average at that moment
 * (COGS); it never changes the average itself — only ENTRADA does.
 */
export async function registrarMovimentacaoEstoque(
  tx: TxClient,
  input: RegistrarMovimentacaoInput
) {
  const saldo = await tx.estoqueSaldo.upsert({
    where: {
      fazendaId_produto_unidade: {
        fazendaId: input.fazendaId,
        produto: input.produto,
        unidade: input.unidade,
      },
    },
    create: {
      fazendaId: input.fazendaId,
      produto: input.produto,
      unidade: input.unidade,
      qtdAtual: 0,
      custoMedioAtual: 0,
      valorTotalAtual: 0,
    },
    update: {},
  });

  const qtdAtual = Number(saldo.qtdAtual);
  const custoMedioAtual = Number(saldo.custoMedioAtual);
  const valorTotalAtual = Number(saldo.valorTotalAtual);

  let novoQtd: number;
  let novoCustoMedio: number;
  let novoValorTotal: number;
  let custoUnitarioMovimento: number;
  let valorTotalMovimento: number;

  if (input.tipo === TipoMovimentacaoEstoque.ENTRADA) {
    custoUnitarioMovimento = input.custoUnitarioEntrada ?? 0;
    valorTotalMovimento = input.qtd * custoUnitarioMovimento;
    novoQtd = qtdAtual + input.qtd;
    novoValorTotal = valorTotalAtual + valorTotalMovimento;
    novoCustoMedio = novoQtd > 0 ? novoValorTotal / novoQtd : 0;
  } else {
    custoUnitarioMovimento = custoMedioAtual;
    valorTotalMovimento = input.qtd * custoUnitarioMovimento;
    novoQtd = qtdAtual - input.qtd;
    novoValorTotal = valorTotalAtual - valorTotalMovimento;
    novoCustoMedio = custoMedioAtual;
  }

  await tx.estoqueSaldo.update({
    where: { id: saldo.id },
    data: {
      qtdAtual: novoQtd,
      custoMedioAtual: novoCustoMedio,
      valorTotalAtual: novoValorTotal,
    },
  });

  return tx.estoqueMovimentacao.create({
    data: {
      id: createId(),
      fazendaId: input.fazendaId,
      criadoPorId: input.criadoPorId ?? null,
      data: input.data,
      produto: input.produto,
      unidade: input.unidade,
      tipo: input.tipo,
      qtd: input.qtd,
      custoUnitario: custoUnitarioMovimento,
      valorTotal: valorTotalMovimento,
      obs: input.obs ?? null,
      vendaId: input.vendaId ?? null,
    },
  });
}

/**
 * Replays every remaining movement for a produto/unidade in date order to rebuild the
 * weighted-average balance from scratch. Weighted-average cost isn't reversible in
 * isolation (an ENTRADA's effect on custoMedio depends on every ENTRADA before it), so
 * deleting or editing any historical movement must go through this instead of trying to
 * "undo" just that one row.
 */
export async function recalcularSaldoEstoque(
  tx: TxClient,
  params: { fazendaId: string; produto: Produto; unidade: UnidadeMedida }
) {
  const movimentos = await tx.estoqueMovimentacao.findMany({
    where: { fazendaId: params.fazendaId, produto: params.produto, unidade: params.unidade },
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  });

  let qtd = 0;
  let custoMedio = 0;
  let valorTotal = 0;

  for (const mov of movimentos) {
    const movQtd = Number(mov.qtd);
    if (mov.tipo === TipoMovimentacaoEstoque.ENTRADA) {
      const custoUnit = Number(mov.custoUnitario ?? 0);
      valorTotal += movQtd * custoUnit;
      qtd += movQtd;
      custoMedio = qtd > 0 ? valorTotal / qtd : 0;
    } else {
      valorTotal -= movQtd * custoMedio;
      qtd -= movQtd;
    }
  }

  await tx.estoqueSaldo.upsert({
    where: {
      fazendaId_produto_unidade: {
        fazendaId: params.fazendaId,
        produto: params.produto,
        unidade: params.unidade,
      },
    },
    create: {
      fazendaId: params.fazendaId,
      produto: params.produto,
      unidade: params.unidade,
      qtdAtual: qtd,
      custoMedioAtual: custoMedio,
      valorTotalAtual: valorTotal,
    },
    update: {
      qtdAtual: qtd,
      custoMedioAtual: custoMedio,
      valorTotalAtual: valorTotal,
    },
  });
}

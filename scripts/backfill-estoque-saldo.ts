import { db } from "@/lib/db";
import { recalcularSaldoEstoque } from "@/lib/estoque/valuation";

async function main() {
  const combos = await db.estoqueMovimentacao.findMany({
    select: { fazendaId: true, produto: true, unidade: true },
    distinct: ["fazendaId", "produto", "unidade"],
  });

  console.log(`Recalculando saldo para ${combos.length} combinação(ões) fazenda/produto/unidade...`);

  for (const combo of combos) {
    await db.$transaction((tx) => recalcularSaldoEstoque(tx, combo));
    console.log(`  OK: ${combo.fazendaId} / ${combo.produto} / ${combo.unidade}`);
  }

  console.log("Backfill concluído.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

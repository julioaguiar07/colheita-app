import "dotenv/config";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import {
  Produto,
  UnidadeMedida,
  CategoriaDespesa,
  TipoMovimentacaoEstoque,
  Role,
  FrequenciaRelatorio,
} from "@/generated/prisma/enums";
import { registrarMovimentacaoEstoque } from "@/lib/estoque/valuation";
import { db } from "@/lib/db";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function dataAleatoriaNoMes(base: Date, dia: number) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia));
}

const CATEGORIAS_PRODUCAO = [CategoriaDespesa.COLHEITA, CategoriaDespesa.MAO_DE_OBRA, CategoriaDespesa.ADUBO];
const CATEGORIAS_GERAIS = [
  CategoriaDespesa.COMBUSTIVEL,
  CategoriaDespesa.MANUTENCAO,
  CategoriaDespesa.MAO_DE_OBRA,
  CategoriaDespesa.INSUMOS,
  CategoriaDespesa.OUTROS,
];

async function main() {
  console.log("Limpando banco de desenvolvimento...");
  await db.auditLog.deleteMany();
  await db.configuracaoEmail.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.estoqueMovimentacao.deleteMany();
  await db.estoqueSaldo.deleteMany();
  await db.despesa.deleteMany();
  await db.venda.deleteMany();
  await db.usuario.deleteMany();
  await db.fazenda.deleteMany();

  const senhaHash = await bcrypt.hash("senha123", 10);

  console.log("Criando fazendas...");
  const fazendaWeliton = await db.fazenda.create({
    data: { nome: "Fazenda Weliton", cidade: "Itaporanga", estado: "PB" },
  });
  const fazendaKenio = await db.fazenda.create({
    data: { nome: "Fazenda Kênio", cidade: "Itaporanga", estado: "PB" },
  });

  console.log("Criando usuários...");
  await db.usuario.create({
    data: {
      email: "julioaguiar05@gmail.com",
      senhaHash,
      nome: "Julio Aguiar",
      role: Role.ADMIN,
      fazendaId: null,
    },
  });
  const weliton = await db.usuario.create({
    data: {
      email: "weliton@example.com",
      senhaHash,
      nome: "Weliton Aguiar",
      role: Role.MEMBRO,
      fazendaId: fazendaWeliton.id,
    },
  });
  await db.usuario.create({
    data: {
      email: "kenio@example.com",
      senhaHash,
      nome: "Kênio Azevedo",
      role: Role.MEMBRO,
      fazendaId: fazendaKenio.id,
    },
  });

  const hoje = new Date();
  const inicioSerie = addMonths(hoje, -11);

  const produtos = [Produto.CASTANHA, Produto.LENHA, Produto.ACEROLA, Produto.CAJU];
  const clientes = ["Mercado Central", "Atacado Nordeste", "Feira do Produtor", "Cooperativa Sertão"];

  console.log("Criando vendas e despesas (12 meses)...");
  for (let m = 0; m < 12; m++) {
    const mesBase = addMonths(inicioSerie, m);
    // small seasonal swing so charts/insights have something to talk about
    const sazonal = 1 + 0.35 * Math.sin((m / 12) * Math.PI * 2);

    for (let i = 0; i < 3; i++) {
      const produto = produtos[(m + i) % produtos.length];
      const categoria = CATEGORIAS_PRODUCAO[(m + i) % CATEGORIAS_PRODUCAO.length];
      const qtd = Math.round((20 + Math.random() * 80) * sazonal);
      const valorUnit = 3 + Math.random() * 12;
      await db.despesa.create({
        data: {
          id: createId(),
          fazendaId: fazendaWeliton.id,
          criadoPorId: weliton.id,
          data: dataAleatoriaNoMes(mesBase, 5 + i * 7),
          categoria,
          custoProducao: true,
          produto,
          qtd,
          unidade: UnidadeMedida.KG,
          valorUnit,
          total: Math.round(qtd * valorUnit * 100) / 100,
          safra: `${mesBase.getUTCFullYear()}`,
        },
      });
    }

    for (let i = 0; i < 4; i++) {
      const produto = produtos[(m + i + 1) % produtos.length];
      const qtd = Math.round((30 + Math.random() * 120) * sazonal);
      const valorUnit = 6 + Math.random() * 18;
      await db.venda.create({
        data: {
          id: createId(),
          fazendaId: fazendaWeliton.id,
          criadoPorId: weliton.id,
          data: dataAleatoriaNoMes(mesBase, 3 + i * 6),
          produto,
          cliente: clientes[(m + i) % clientes.length],
          unidade: UnidadeMedida.KG,
          qtd,
          valorUnit,
          total: Math.round(qtd * valorUnit * 100) / 100,
          safra: `${mesBase.getUTCFullYear()}`,
        },
      });
    }

    for (let i = 0; i < 5; i++) {
      const categoria = CATEGORIAS_GERAIS[(m + i) % CATEGORIAS_GERAIS.length];
      const produto = i % 3 === 0 ? produtos[(m + i) % produtos.length] : null;
      const valor = 50 + Math.round(Math.random() * 400);
      await db.despesa.create({
        data: {
          id: createId(),
          fazendaId: fazendaWeliton.id,
          criadoPorId: weliton.id,
          data: dataAleatoriaNoMes(mesBase, 2 + i * 5),
          categoria,
          custoProducao: false,
          produto,
          obs: null,
          total: valor,
        },
      });
    }
  }

  console.log("Criando movimentações de estoque...");
  await db.$transaction(async (tx) => {
    await registrarMovimentacaoEstoque(tx, {
      fazendaId: fazendaWeliton.id,
      criadoPorId: weliton.id,
      data: addMonths(hoje, -2),
      produto: Produto.CASTANHA,
      unidade: UnidadeMedida.KG,
      tipo: TipoMovimentacaoEstoque.ENTRADA,
      qtd: 300,
      custoUnitarioEntrada: 8.5,
      obs: "Colheita safra atual",
    });
    await registrarMovimentacaoEstoque(tx, {
      fazendaId: fazendaWeliton.id,
      criadoPorId: weliton.id,
      data: addMonths(hoje, -1),
      produto: Produto.CASTANHA,
      unidade: UnidadeMedida.KG,
      tipo: TipoMovimentacaoEstoque.SAIDA,
      qtd: 120,
      obs: "Venda para atacado",
    });
    await registrarMovimentacaoEstoque(tx, {
      fazendaId: fazendaWeliton.id,
      criadoPorId: weliton.id,
      data: addMonths(hoje, -1),
      produto: Produto.ACEROLA,
      unidade: UnidadeMedida.KG,
      tipo: TipoMovimentacaoEstoque.ENTRADA,
      qtd: 150,
      custoUnitarioEntrada: 4.2,
      obs: "Colheita",
    });
  });

  await db.estoqueSaldo.updateMany({
    where: { fazendaId: fazendaWeliton.id, produto: Produto.CASTANHA },
    data: { qtdMinima: 50 },
  });

  console.log("Configurando e-mail de relatório...");
  await db.configuracaoEmail.create({
    data: {
      fazendaId: fazendaWeliton.id,
      usuarioId: weliton.id,
      emailDestino: "weliton@example.com",
      frequencias: [FrequenciaRelatorio.DIARIO],
      horario: "11:00",
      ativo: true,
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

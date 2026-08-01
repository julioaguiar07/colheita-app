-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBRO');

-- CreateEnum
CREATE TYPE "Produto" AS ENUM ('CASTANHA', 'LENHA', 'ACEROLA', 'CAJU', 'OUTRO');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'BALDE', 'CAIXA', 'UNIDADE', 'OUTRO');

-- CreateEnum
CREATE TYPE "CategoriaDespesa" AS ENUM ('COLHEITA', 'MAO_DE_OBRA', 'ADUBO', 'COMBUSTIVEL', 'MANUTENCAO', 'INSUMOS', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('DOSSIE_CREDITO', 'LIVRO_CAIXA');

-- CreateEnum
CREATE TYPE "FrequenciaRelatorio" AS ENUM ('DIARIO', 'SEMANAL', 'MENSAL');

-- CreateTable
CREATE TABLE "fazendas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fazendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "nome" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL DEFAULT 'MEMBRO',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "fazenda_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "area" TEXT,
    "data" DATE NOT NULL,
    "produto" "Produto" NOT NULL,
    "cliente" TEXT,
    "unidade" "UnidadeMedida" NOT NULL,
    "qtd" DECIMAL(10,2) NOT NULL,
    "valor_unit" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "safra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesas" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "data" DATE NOT NULL,
    "categoria" "CategoriaDespesa" NOT NULL,
    "custo_producao" BOOLEAN NOT NULL DEFAULT false,
    "produto" "Produto",
    "area" TEXT,
    "qtd" DECIMAL(10,2),
    "unidade" "UnidadeMedida",
    "valor_unit" DECIMAL(10,2),
    "total" DECIMAL(10,2) NOT NULL,
    "obs" TEXT,
    "safra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_movimentacoes" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "usuario_id" INTEGER,
    "data" DATE NOT NULL,
    "produto" "Produto" NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "qtd" DECIMAL(10,2) NOT NULL,
    "custo_unitario" DECIMAL(10,2),
    "valor_total" DECIMAL(10,2),
    "obs" TEXT,
    "venda_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque_saldos" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "produto" "Produto" NOT NULL,
    "unidade" "UnidadeMedida" NOT NULL,
    "qtd_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_medio_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total_atual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "qtd_minima" DECIMAL(10,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estoque_saldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_email" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "email_destino" TEXT NOT NULL,
    "frequencias" "FrequenciaRelatorio"[],
    "horario" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_envio_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_gerados" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "tipo" "TipoRelatorio" NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "usuario_id" INTEGER,
    "dados_snapshot_json" JSONB NOT NULL,
    "hash_conteudo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_gerados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "fazenda_id" TEXT,
    "usuario_id" INTEGER,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "detalhes_json" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "vendas_fazenda_id_data_idx" ON "vendas"("fazenda_id", "data");

-- CreateIndex
CREATE INDEX "despesas_fazenda_id_data_idx" ON "despesas"("fazenda_id", "data");

-- CreateIndex
CREATE INDEX "despesas_fazenda_id_custo_producao_idx" ON "despesas"("fazenda_id", "custo_producao");

-- CreateIndex
CREATE INDEX "estoque_movimentacoes_fazenda_id_produto_data_idx" ON "estoque_movimentacoes"("fazenda_id", "produto", "data");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_fazenda_id_produto_unidade_key" ON "estoque_saldos"("fazenda_id", "produto", "unidade");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_email_usuario_id_key" ON "configuracoes_email"("usuario_id");

-- CreateIndex
CREATE INDEX "relatorios_gerados_fazenda_id_tipo_idx" ON "relatorios_gerados"("fazenda_id", "tipo");

-- CreateIndex
CREATE INDEX "audit_logs_fazenda_id_created_at_idx" ON "audit_logs"("fazenda_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_email" ADD CONSTRAINT "configuracoes_email_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_email" ADD CONSTRAINT "configuracoes_email_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_gerados" ADD CONSTRAINT "relatorios_gerados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

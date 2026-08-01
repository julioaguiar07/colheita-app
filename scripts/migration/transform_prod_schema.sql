-- AGROcore: transformação do schema antigo (Flask) para o schema Prisma novo.
-- Roda inteiro numa transação. Testado primeiro em staging (porta 55433) antes de produção.

BEGIN;

-- ============================================================
-- 0. Enums
-- ============================================================
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBRO');
CREATE TYPE "Produto" AS ENUM ('CASTANHA', 'LENHA', 'ACEROLA', 'CAJU', 'OUTRO');
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'BALDE', 'CAIXA', 'UNIDADE', 'OUTRO');
CREATE TYPE "CategoriaDespesa" AS ENUM ('COLHEITA', 'MAO_DE_OBRA', 'ADUBO', 'COMBUSTIVEL', 'MANUTENCAO', 'INSUMOS', 'OUTROS');
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE "FrequenciaRelatorio" AS ENUM ('DIARIO', 'SEMANAL', 'MENSAL');

-- ============================================================
-- 1. Dead tables (modo consultor + lixo), aprovado para descarte
-- ============================================================
DROP TABLE IF EXISTS assinaturas_relatorio CASCADE;
DROP TABLE IF EXISTS convites_consultor CASCADE;
DROP TABLE IF EXISTS logs_acesso_consultor CASCADE;
DROP TABLE IF EXISTS vinculos_consultor CASCADE;
DROP TABLE IF EXISTS logs_auditoria CASCADE;
DROP TABLE IF EXISTS gastos_backup CASCADE;
DROP TABLE IF EXISTS configuracoes_email CASCADE; -- dados corrompidos, recriada vazia abaixo

-- ============================================================
-- 2. fazendas (nova tabela) — duas fazendas isoladas
-- ============================================================
CREATE TABLE "fazendas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fazendas_pkey" PRIMARY KEY ("id")
);

CREATE TEMP TABLE _fazenda_seed (
    usuario_id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    fazenda_id TEXT NOT NULL DEFAULT gen_random_uuid()::text
);
INSERT INTO _fazenda_seed (usuario_id, nome) VALUES
    (1, 'Fazenda Weliton'),
    (9, 'Fazenda Kênio');

INSERT INTO "fazendas" (id, nome, updated_at)
SELECT fazenda_id, nome, CURRENT_TIMESTAMP FROM _fazenda_seed;

-- ============================================================
-- 3. usuarios — mantém ids/hashes existentes, remove contas de teste/consultor
-- ============================================================
DELETE FROM usuarios WHERE id IN (3, 5, 6, 7, 8);

ALTER TABLE usuarios ALTER COLUMN email TYPE TEXT;
ALTER TABLE usuarios ALTER COLUMN senha_hash TYPE TEXT;
ALTER TABLE usuarios ALTER COLUMN nome TYPE TEXT;
ALTER TABLE usuarios ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE usuarios ALTER COLUMN ativo SET DEFAULT true;
ALTER TABLE usuarios ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE usuarios ALTER COLUMN created_at TYPE TIMESTAMP(3);

ALTER TABLE usuarios ADD COLUMN role_new "Role" NOT NULL DEFAULT 'MEMBRO';
UPDATE usuarios SET role_new = 'MEMBRO'; -- únicos restantes (1, 9) são donos de fazenda
ALTER TABLE usuarios DROP COLUMN role;
ALTER TABLE usuarios RENAME COLUMN role_new TO role;

ALTER TABLE usuarios ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN fazenda_id TEXT;

UPDATE usuarios u SET fazenda_id = fs.fazenda_id
FROM _fazenda_seed fs WHERE fs.usuario_id = u.id;

-- Admin da plataforma: sem fazenda, senha real definida via "esqueci minha senha"
INSERT INTO usuarios (email, senha_hash, nome, ativo, role, session_version, fazenda_id)
VALUES ('julioaguiar05@gmail.com', '$2b$10$y7OFBgFS1lA5Zq4HtJVtJeC/XdT8AdcSO8Uow7ZiP71Gwlv0MEsjW', 'Júlio Aguiar', true, 'ADMIN', 0, NULL);

ALTER TABLE usuarios ADD CONSTRAINT "usuarios_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 4. vendas — mantém ids TEXT existentes, adiciona fazenda_id/safra, converte enums
-- ============================================================
DELETE FROM vendas WHERE usuario_id NOT IN (1, 9);

ALTER TABLE vendas ALTER COLUMN id TYPE TEXT;
ALTER TABLE vendas ALTER COLUMN area TYPE TEXT;
ALTER TABLE vendas ALTER COLUMN cliente TYPE TEXT;
ALTER TABLE vendas ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE vendas ALTER COLUMN created_at TYPE TIMESTAMP(3);
ALTER TABLE vendas ALTER COLUMN qtd SET NOT NULL;
ALTER TABLE vendas ALTER COLUMN valor_unit SET NOT NULL;
ALTER TABLE vendas ALTER COLUMN total SET NOT NULL;

ALTER TABLE vendas ADD COLUMN fazenda_id TEXT;
UPDATE vendas v SET fazenda_id = fs.fazenda_id FROM _fazenda_seed fs WHERE fs.usuario_id = v.usuario_id;
ALTER TABLE vendas ALTER COLUMN fazenda_id SET NOT NULL;

ALTER TABLE vendas ADD COLUMN safra TEXT;

ALTER TABLE vendas ALTER COLUMN produto TYPE "Produto" USING (UPPER(produto)::"Produto");

ALTER TABLE vendas ALTER COLUMN unidade TYPE "UnidadeMedida" USING (
    CASE UPPER(TRIM(unidade))
        WHEN 'KG' THEN 'KG'
        WHEN 'BALDE' THEN 'BALDE'
        WHEN 'CAIXA' THEN 'CAIXA'
        WHEN 'UN' THEN 'UNIDADE'
        WHEN 'UNIDADE' THEN 'UNIDADE'
        ELSE 'OUTRO'
    END::"UnidadeMedida"
);
ALTER TABLE vendas ALTER COLUMN unidade SET NOT NULL;

ALTER TABLE vendas ADD CONSTRAINT "vendas_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE vendas ADD CONSTRAINT "vendas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "vendas_fazenda_id_data_idx" ON "vendas"("fazenda_id", "data");

-- ============================================================
-- 5. despesas (nova tabela) — une producoes (custo_producao=true) + gastos (false)
-- ============================================================
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

-- 5a. producoes -> despesas (custo de colheita)
INSERT INTO despesas (id, fazenda_id, usuario_id, data, categoria, custo_producao, produto, area, qtd, unidade, valor_unit, total, obs, created_at)
SELECT
    p.id,
    fs.fazenda_id,
    p.usuario_id,
    p.data,
    CASE p.tipo
        WHEN 'Colheita' THEN 'COLHEITA'
        WHEN 'Mão de obra' THEN 'MAO_DE_OBRA'
        WHEN 'Adubo' THEN 'ADUBO'
        ELSE 'OUTROS'
    END::"CategoriaDespesa",
    true,
    NULLIF(UPPER(TRIM(p.produto)), '')::"Produto",
    NULLIF(p.area, ''),
    p.qtd,
    CASE UPPER(TRIM(COALESCE(p.unidade, '')))
        WHEN 'KG' THEN 'KG'
        WHEN 'BALDE' THEN 'BALDE'
        WHEN 'CAIXA' THEN 'CAIXA'
        WHEN 'UN' THEN 'UNIDADE'
        WHEN 'UNIDADE' THEN 'UNIDADE'
        WHEN '' THEN NULL
        ELSE 'OUTRO'
    END::"UnidadeMedida",
    p.valor_unit,
    COALESCE(p.total, 0),
    NULL,
    p.created_at
FROM producoes p
JOIN _fazenda_seed fs ON fs.usuario_id = p.usuario_id
WHERE p.usuario_id IN (1, 9);

-- 5b. gastos -> despesas (despesa geral), preserva "tipo" (descrição específica) dentro de obs
INSERT INTO despesas (id, fazenda_id, usuario_id, data, categoria, custo_producao, produto, area, qtd, unidade, valor_unit, total, obs, created_at)
SELECT
    g.id,
    fs.fazenda_id,
    g.usuario_id,
    g.data,
    CASE g.categoria
        WHEN 'Combustível' THEN 'COMBUSTIVEL'
        WHEN 'Insumos' THEN 'INSUMOS'
        WHEN 'Manutenção' THEN 'MANUTENCAO'
        WHEN 'Mão de obra' THEN 'MAO_DE_OBRA'
        WHEN 'Outros' THEN 'OUTROS'
        ELSE 'OUTROS'
    END::"CategoriaDespesa",
    false,
    NULLIF(UPPER(TRIM(COALESCE(g.produto, ''))), '')::"Produto",
    NULLIF(g.area, ''),
    NULL,
    NULL,
    NULL,
    COALESCE(g.valor, 0),
    CASE
        WHEN g.tipo IS NULL OR g.tipo = '' THEN NULLIF(g.obs, '')
        WHEN g.obs IS NULL OR g.obs = '' OR g.obs = g.tipo THEN g.tipo
        ELSE g.tipo || ': ' || g.obs
    END,
    g.created_at
FROM gastos g
JOIN _fazenda_seed fs ON fs.usuario_id = g.usuario_id
WHERE g.usuario_id IN (1, 9);

ALTER TABLE despesas ADD CONSTRAINT "despesas_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE despesas ADD CONSTRAINT "despesas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "despesas_fazenda_id_data_idx" ON "despesas"("fazenda_id", "data");
CREATE INDEX "despesas_fazenda_id_custo_producao_idx" ON "despesas"("fazenda_id", "custo_producao");

-- ============================================================
-- 6. estoque_movimentacoes — retipa e adiciona fazenda_id/custo_unitario/valor_total
-- ============================================================
ALTER TABLE estoque_movimentacoes DROP CONSTRAINT IF EXISTS estoque_movimentacoes_usuario_id_fkey;
ALTER TABLE estoque_movimentacoes DROP CONSTRAINT IF EXISTS estoque_movimentacoes_venda_id_fkey;

DELETE FROM estoque_movimentacoes WHERE usuario_id NOT IN (1, 9);

ALTER TABLE estoque_movimentacoes ALTER COLUMN id TYPE TEXT;
ALTER TABLE estoque_movimentacoes ALTER COLUMN venda_id TYPE TEXT;
ALTER TABLE estoque_movimentacoes ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE estoque_movimentacoes ALTER COLUMN created_at TYPE TIMESTAMP(3);

ALTER TABLE estoque_movimentacoes ADD COLUMN fazenda_id TEXT;
UPDATE estoque_movimentacoes em SET fazenda_id = fs.fazenda_id FROM _fazenda_seed fs WHERE fs.usuario_id = em.usuario_id;
ALTER TABLE estoque_movimentacoes ALTER COLUMN fazenda_id SET NOT NULL;

ALTER TABLE estoque_movimentacoes ADD COLUMN custo_unitario DECIMAL(10,2);
ALTER TABLE estoque_movimentacoes ADD COLUMN valor_total DECIMAL(10,2);

ALTER TABLE estoque_movimentacoes ALTER COLUMN produto TYPE "Produto" USING (UPPER(produto)::"Produto");
ALTER TABLE estoque_movimentacoes ALTER COLUMN unidade TYPE "UnidadeMedida" USING (
    CASE UPPER(TRIM(unidade))
        WHEN 'KG' THEN 'KG'
        WHEN 'BALDE' THEN 'BALDE'
        WHEN 'CAIXA' THEN 'CAIXA'
        WHEN 'UN' THEN 'UNIDADE'
        WHEN 'UNIDADE' THEN 'UNIDADE'
        ELSE 'OUTRO'
    END::"UnidadeMedida"
);
ALTER TABLE estoque_movimentacoes ALTER COLUMN tipo TYPE "TipoMovimentacaoEstoque" USING (
    CASE LOWER(TRIM(tipo)) WHEN 'entrada' THEN 'ENTRADA' WHEN 'saida' THEN 'SAIDA' ELSE 'ENTRADA' END::"TipoMovimentacaoEstoque"
);

ALTER TABLE estoque_movimentacoes ADD CONSTRAINT "estoque_movimentacoes_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE estoque_movimentacoes ADD CONSTRAINT "estoque_movimentacoes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE estoque_movimentacoes ADD CONSTRAINT "estoque_movimentacoes_venda_id_fkey"
    FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "estoque_movimentacoes_fazenda_id_produto_data_idx" ON "estoque_movimentacoes"("fazenda_id", "produto", "data");

-- ============================================================
-- 7. estoque_saldos (nova tabela, vazia — backfill via script TS depois)
-- ============================================================
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
ALTER TABLE estoque_saldos ADD CONSTRAINT "estoque_saldos_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "estoque_saldos_fazenda_id_produto_unidade_key" ON "estoque_saldos"("fazenda_id", "produto", "unidade");

-- ============================================================
-- 8. configuracoes_email (recriada vazia — dados antigos corrompidos)
-- ============================================================
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
ALTER TABLE configuracoes_email ADD CONSTRAINT "configuracoes_email_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE configuracoes_email ADD CONSTRAINT "configuracoes_email_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "configuracoes_email_usuario_id_key" ON "configuracoes_email"("usuario_id");

-- ============================================================
-- 9. audit_logs (nova tabela, vazia)
-- ============================================================
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
ALTER TABLE audit_logs ADD CONSTRAINT "audit_logs_fazenda_id_fkey"
    FOREIGN KEY ("fazenda_id") REFERENCES "fazendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE audit_logs ADD CONSTRAINT "audit_logs_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "audit_logs_fazenda_id_created_at_idx" ON "audit_logs"("fazenda_id", "created_at");

-- ============================================================
-- 10. password_reset_tokens (nova tabela, vazia)
-- ============================================================
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
ALTER TABLE password_reset_tokens ADD CONSTRAINT "password_reset_tokens_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- ============================================================
-- 11. Drop legacy source tables (dados já migrados para despesas)
-- ============================================================
DROP TABLE producoes;
DROP TABLE gastos;

DROP TABLE _fazenda_seed;

COMMIT;

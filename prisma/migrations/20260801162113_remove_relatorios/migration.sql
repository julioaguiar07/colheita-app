/*
  Warnings:

  - You are about to drop the `relatorios_gerados` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "relatorios_gerados" DROP CONSTRAINT "relatorios_gerados_fazenda_id_fkey";

-- DropForeignKey
ALTER TABLE "relatorios_gerados" DROP CONSTRAINT "relatorios_gerados_usuario_id_fkey";

-- DropTable
DROP TABLE "relatorios_gerados";

-- DropEnum
DROP TYPE "TipoRelatorio";

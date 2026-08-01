import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Administração — AGROcore" };

export default async function AdminPage() {
  const [fazendas, usuarios] = await Promise.all([
    db.fazenda.findMany({
      include: { _count: { select: { usuarios: true, vendas: true, despesas: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.usuario.findMany({ include: { fazenda: true }, orderBy: { id: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Fazendas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Despesas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fazendas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[f.cidade, f.estado].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell>{f._count.usuarios}</TableCell>
                  <TableCell>{f._count.vendas}</TableCell>
                  <TableCell>{f._count.despesas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.fazenda?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "secondary" : "destructive"}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

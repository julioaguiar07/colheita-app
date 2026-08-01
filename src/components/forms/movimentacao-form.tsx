"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createMovimentacao } from "@/lib/actions/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUTO_LABEL, UNIDADE_LABEL } from "@/lib/format";

const PRODUTOS = Object.entries(PRODUTO_LABEL);
const UNIDADES = Object.entries(UNIDADE_LABEL).filter(([value]) => value !== "OUTRO");
const UNIDADES_MAP = Object.fromEntries(UNIDADES);
const TIPO_LABEL = { ENTRADA: "Entrada", SAIDA: "Saída" };

export function MovimentacaoForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createMovimentacao, undefined);
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("ENTRADA");

  useEffect(() => {
    if (state?.message === "success") onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!state?.errors?.data}>
            <FieldLabel htmlFor="data">Data</FieldLabel>
            <Input id="data" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <FieldError errors={state?.errors?.data?.map((message) => ({ message }))} />
          </Field>

          <Field data-invalid={!!state?.errors?.tipo}>
            <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
            <Select
              name="tipo"
              items={TIPO_LABEL}
              value={tipo}
              onValueChange={(v) => v && setTipo(v as "ENTRADA" | "SAIDA")}
            >
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Saída</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!state?.errors?.produto}>
            <FieldLabel htmlFor="produto">Produto</FieldLabel>
            <Select name="produto" items={PRODUTO_LABEL}>
              <SelectTrigger id="produto" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={state?.errors?.produto?.map((message) => ({ message }))} />
          </Field>
          <Field data-invalid={!!state?.errors?.unidade}>
            <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
            <Select name="unidade" items={UNIDADES_MAP}>
              <SelectTrigger id="unidade" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={state?.errors?.unidade?.map((message) => ({ message }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!state?.errors?.qtd}>
            <FieldLabel htmlFor="qtd">Quantidade</FieldLabel>
            <Input id="qtd" name="qtd" type="number" step="0.01" />
            <FieldError errors={state?.errors?.qtd?.map((message) => ({ message }))} />
          </Field>
          {tipo === "ENTRADA" && (
            <Field data-invalid={!!state?.errors?.custoUnitario}>
              <FieldLabel htmlFor="custoUnitario">Custo unitário</FieldLabel>
              <Input id="custoUnitario" name="custoUnitario" type="number" step="0.01" />
              <FieldError errors={state?.errors?.custoUnitario?.map((message) => ({ message }))} />
            </Field>
          )}
        </div>

        <Field>
          <FieldLabel htmlFor="obs">Observação (opcional)</FieldLabel>
          <Textarea id="obs" name="obs" rows={2} />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Registrar movimentação
      </Button>
    </form>
  );
}

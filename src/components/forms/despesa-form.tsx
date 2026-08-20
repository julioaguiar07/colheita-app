"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createDespesa } from "@/lib/actions/despesa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIA_DESPESA_LABEL, PRODUTO_LABEL, UNIDADE_LABEL, formatBRL } from "@/lib/format";

const CATEGORIAS = Object.entries(CATEGORIA_DESPESA_LABEL);
const UNIDADES = Object.entries(UNIDADE_LABEL);

/** Sentinela para "sem vínculo com produto" — normalizada para null na Server Action. */
export const PRODUTO_NENHUM = "NENHUM";
const PRODUTO_ITEMS = { [PRODUTO_NENHUM]: "Nenhum produto", ...PRODUTO_LABEL };
const PRODUTOS = Object.entries(PRODUTO_ITEMS);

export function DespesaForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createDespesa, undefined);
  const [custoProducao, setCustoProducao] = useState(false);
  const [qtd, setQtd] = useState("");
  const [valorUnit, setValorUnit] = useState("");
  const [totalManual, setTotalManual] = useState("");

  const totalCalculado = useMemo(() => {
    const q = Number(qtd);
    const vu = Number(valorUnit);
    if (q > 0 && vu > 0) return q * vu;
    return null;
  }, [qtd, valorUnit]);

  useEffect(() => {
    if (state?.message === "success") onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="custoProducao" value={String(custoProducao)} />

      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!state?.errors?.data}>
            <FieldLabel htmlFor="data">Data</FieldLabel>
            <Input id="data" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <FieldError errors={state?.errors?.data?.map((message) => ({ message }))} />
          </Field>

          <Field data-invalid={!!state?.errors?.categoria}>
            <FieldLabel htmlFor="categoria">Categoria</FieldLabel>
            <Select name="categoria" items={CATEGORIA_DESPESA_LABEL}>
              <SelectTrigger id="categoria" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={state?.errors?.categoria?.map((message) => ({ message }))} />
          </Field>
        </div>

        <Field orientation="horizontal" className="items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex flex-col">
            <FieldLabel htmlFor="custo-producao-switch">Custo de produção</FieldLabel>
            <span className="text-xs text-muted-foreground">
              Entra no cálculo de custo de produção, com ou sem produto vinculado
            </span>
          </div>
          <Switch id="custo-producao-switch" checked={custoProducao} onCheckedChange={setCustoProducao} />
        </Field>

        <Field data-invalid={!!state?.errors?.produto}>
          <FieldLabel htmlFor="produto">Produto (opcional)</FieldLabel>
          <Select name="produto" items={PRODUTO_ITEMS} defaultValue={PRODUTO_NENHUM}>
            <SelectTrigger id="produto" className="w-full">
              <SelectValue placeholder="Nenhum produto" />
            </SelectTrigger>
            <SelectContent>
              {PRODUTOS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Vincule a um produto para organizar a análise. Deixe em &quot;Nenhum produto&quot; se o lançamento não for
            atribuível a um produto específico.
          </span>
          <FieldError errors={state?.errors?.produto?.map((message) => ({ message }))} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel htmlFor="qtd">Quantidade (opcional)</FieldLabel>
            <Input id="qtd" name="qtd" type="number" step="0.01" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
            <Select name="unidade" items={UNIDADE_LABEL}>
              <SelectTrigger id="unidade" className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="valorUnit">Valor unitário</FieldLabel>
            <Input
              id="valorUnit"
              name="valorUnit"
              type="number"
              step="0.01"
              value={valorUnit}
              onChange={(e) => setValorUnit(e.target.value)}
            />
          </Field>
        </div>

        <Field data-invalid={!!state?.errors?.total}>
          <FieldLabel htmlFor="total">
            {totalCalculado !== null ? "Total (calculado)" : "Valor total"}
          </FieldLabel>
          <Input
            id="total"
            name="total"
            type="number"
            step="0.01"
            readOnly={totalCalculado !== null}
            value={totalCalculado !== null ? totalCalculado.toFixed(2) : totalManual}
            onChange={(e) => setTotalManual(e.target.value)}
            placeholder={totalCalculado === null ? "0,00" : undefined}
          />
          {totalCalculado !== null && (
            <span className="text-xs text-muted-foreground">{formatBRL(totalCalculado)}</span>
          )}
          <FieldError errors={state?.errors?.total?.map((message) => ({ message }))} />
        </Field>

        <Field>
          <FieldLabel htmlFor="obs">Observação (opcional)</FieldLabel>
          <Textarea id="obs" name="obs" rows={2} />
        </Field>
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Salvar despesa
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createVenda } from "@/lib/actions/venda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUTO_LABEL, UNIDADE_LABEL, formatBRL } from "@/lib/format";

const PRODUTOS = Object.entries(PRODUTO_LABEL);
const UNIDADES = Object.entries(UNIDADE_LABEL).filter(([value]) => value !== "OUTRO");
const UNIDADES_MAP = Object.fromEntries(UNIDADES);

export function VendaForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createVenda, undefined);
  const [deduzirEstoque, setDeduzirEstoque] = useState(true);
  const [qtd, setQtd] = useState("");
  const [valorUnit, setValorUnit] = useState("");

  const total = useMemo(() => {
    const q = Number(qtd);
    const vu = Number(valorUnit);
    return q > 0 && vu > 0 ? q * vu : null;
  }, [qtd, valorUnit]);

  useEffect(() => {
    if (state?.message === "success") onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="deduzirEstoque" value={String(deduzirEstoque)} />

      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!state?.errors?.data}>
            <FieldLabel htmlFor="data">Data</FieldLabel>
            <Input id="data" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <FieldError errors={state?.errors?.data?.map((message) => ({ message }))} />
          </Field>

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
        </div>

        <Field>
          <FieldLabel htmlFor="cliente">Cliente (opcional)</FieldLabel>
          <Input id="cliente" name="cliente" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field data-invalid={!!state?.errors?.qtd}>
            <FieldLabel htmlFor="qtd">Quantidade</FieldLabel>
            <Input id="qtd" name="qtd" type="number" step="0.01" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            <FieldError errors={state?.errors?.qtd?.map((message) => ({ message }))} />
          </Field>
          <Field data-invalid={!!state?.errors?.unidade}>
            <FieldLabel htmlFor="unidade">Unidade</FieldLabel>
            <Select name="unidade" items={UNIDADES_MAP}>
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
            <FieldError errors={state?.errors?.unidade?.map((message) => ({ message }))} />
          </Field>
          <Field data-invalid={!!state?.errors?.valorUnit}>
            <FieldLabel htmlFor="valorUnit">Preço unitário</FieldLabel>
            <Input
              id="valorUnit"
              name="valorUnit"
              type="number"
              step="0.01"
              value={valorUnit}
              onChange={(e) => setValorUnit(e.target.value)}
            />
            <FieldError errors={state?.errors?.valorUnit?.map((message) => ({ message }))} />
          </Field>
        </div>

        {total !== null && (
          <p className="rounded-lg bg-status-good/10 px-3 py-2 text-sm text-status-good">
            Total da venda: <span className="font-mono font-semibold">{formatBRL(total)}</span>
          </p>
        )}

        <Field orientation="horizontal" className="items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex flex-col">
            <FieldLabel htmlFor="deduzir-switch">Descontar do estoque</FieldLabel>
            <span className="text-xs text-muted-foreground">Registra uma saída automática nessa quantidade</span>
          </div>
          <Switch id="deduzir-switch" checked={deduzirEstoque} onCheckedChange={setDeduzirEstoque} />
        </Field>
      </FieldGroup>

      {state?.message && state.message !== "success" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Salvar venda
      </Button>
    </form>
  );
}

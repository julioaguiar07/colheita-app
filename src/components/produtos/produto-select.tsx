"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUTO_LABEL } from "@/lib/format";
import type { Produto } from "@/generated/prisma/enums";

export function ProdutoSelect({ value, disponiveis }: { value: Produto; disponiveis: Produto[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(produto: string | null) {
    if (!produto) return;
    const params = new URLSearchParams(searchParams);
    params.set("produto", produto);
    router.push(`${pathname}?${params.toString()}`);
  }

  const items = Object.fromEntries(disponiveis.map((p) => [p, PRODUTO_LABEL[p]]));

  return (
    <Select value={value} onValueChange={handleChange} items={items}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {disponiveis.map((p) => (
          <SelectItem key={p} value={p}>
            {PRODUTO_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODO_PRESET_LABEL, type PeriodoPreset } from "@/lib/financeiro/periodo";

export function PeriodoSelect({ value }: { value: PeriodoPreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(preset: PeriodoPreset | null) {
    if (!preset) return;
    const params = new URLSearchParams(searchParams);
    params.set("periodo", preset);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={handleChange} items={PERIODO_PRESET_LABEL}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PERIODO_PRESET_LABEL).map(([preset, label]) => (
          <SelectItem key={preset} value={preset}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

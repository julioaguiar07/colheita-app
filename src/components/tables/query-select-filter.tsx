"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function QuerySelectFilter({
  paramName,
  placeholder,
  allLabel = "Todos",
  options,
  className,
}: {
  paramName: string;
  placeholder: string;
  allLabel?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? "todos";

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    if (value === "todos") params.delete(paramName);
    else params.set(paramName, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const items = { todos: allLabel, ...Object.fromEntries(options.map((o) => [o.value, o.label])) };

  return (
    <Select value={current} onValueChange={handleChange} items={items}>
      <SelectTrigger className={className ?? "w-44"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

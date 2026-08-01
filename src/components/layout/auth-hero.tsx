import { Sprout, Sparkles, Wallet } from "lucide-react";

export function AuthHero() {
  return (
    <div className="relative hidden h-full flex-col justify-between overflow-hidden bg-[#17231a] p-10 text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(127,174,98,0.35), transparent 45%), radial-gradient(circle at 85% 75%, rgba(63,107,63,0.45), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #fff 0, #fff 1px, transparent 1px, transparent 22px)",
        }}
      />

      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#7fae62] text-[#12160e]">
          <Sprout className="size-5" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-semibold tracking-tight">AGROcore</span>
      </div>

      <div className="relative z-10 max-w-sm space-y-6">
        <h1 className="text-3xl font-semibold leading-tight text-balance">
          Gestão financeira para quem colhe caju, castanha, lenha e acerola.
        </h1>
        <p className="text-sm leading-relaxed text-white/70">
          Receita, custos de colheita, despesas e estoque em um só lugar — com o lucro líquido
          calculado de forma clara, sem letras miúdas.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur-sm">
            <Wallet className="size-4 text-[#7fae62]" />
            <span className="text-sm text-white/80">Receita − Custos − Despesas = Lucro líquido</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur-sm">
            <Sparkles className="size-4 text-[#7fae62]" />
            <span className="text-sm text-white/80">Resumo inteligente gerado por IA a qualquer momento</span>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/40">© {new Date().getFullYear()} AGROcore</p>
    </div>
  );
}

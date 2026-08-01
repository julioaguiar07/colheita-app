"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MovimentacaoForm } from "@/components/forms/movimentacao-form";

export function NovaMovimentacaoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Nova movimentação</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova movimentação de estoque</DialogTitle>
        </DialogHeader>
        <MovimentacaoForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

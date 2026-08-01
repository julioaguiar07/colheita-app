"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VendaForm } from "@/components/forms/venda-form";

export function NovaVendaDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus /> Nova venda</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova venda</DialogTitle>
        </DialogHeader>
        <VendaForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

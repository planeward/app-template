"use client";

import { useId } from "react";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

export function CopyField({ label, value }: { label: string; value: string }) {
  const id = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} readOnly className="font-mono text-sm" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          <CopyIcon />
        </Button>
      </div>
    </div>
  );
}

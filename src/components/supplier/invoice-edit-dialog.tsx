import { useEffect, useMemo, useState } from "react";
import type { Invoice, SupplierStockRow } from "@/lib/store";
import { ApiError } from "@/lib/store";
import { sendSupplierInvoice, updateSupplierInvoice } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Mail, Plus, Save, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type EditLine = {
  key: string;
  stockId: string;
  qty: number;
  price: number;
};

function stockLabel(s: SupplierStockRow) {
  return `${s.partName} · ${s.vehicleModel}`;
}

function linesFromInvoice(invoice: Invoice, stock: SupplierStockRow[]): EditLine[] {
  return invoice.parts.map((p, i) => {
    const match =
      (p.stockId ? stock.find((s) => s.id === p.stockId) : undefined) ??
      stock.find((s) => `${s.vehicleModel} ${s.partName}` === p.name) ??
      stock.find((s) => s.partName === p.name);
    return {
      key: `line-${i}-${Date.now()}`,
      stockId: match?.id ?? "",
      qty: p.qty,
      price: p.price,
    };
  });
}

function newLine(): EditLine {
  return { key: `line-new-${Date.now()}-${Math.random()}`, stockId: "", qty: 1, price: 0 };
}

export function InvoiceEditDialog({
  invoice,
  stock,
  open,
  onOpenChange,
  onSaved,
}: {
  invoice: Invoice | null;
  stock: SupplierStockRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Invoice) => void;
  onSent?: () => void;
}) {
  const [lines, setLines] = useState<EditLine[]>([]);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [partFilter, setPartFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (invoice && open) {
      setLines(invoice.parts.length > 0 ? linesFromInvoice(invoice, stock) : [newLine()]);
      setSearch("");
      setModelFilter("all");
      setPartFilter("all");
    }
  }, [invoice, open, stock]);

  const models = useMemo(
    () => [...new Set(stock.map((s) => s.vehicleModel))].sort(),
    [stock],
  );

  const partNames = useMemo(() => {
    const source =
      modelFilter === "all" ? stock : stock.filter((s) => s.vehicleModel === modelFilter);
    return [...new Set(source.map((s) => s.partName))].sort();
  }, [stock, modelFilter]);

  const filteredStock = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stock.filter((s) => {
      if (modelFilter !== "all" && s.vehicleModel !== modelFilter) return false;
      if (partFilter !== "all" && s.partName !== partFilter) return false;
      if (!q) return true;
      return (
        s.partName.toLowerCase().includes(q) ||
        s.vehicleModel.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [stock, search, modelFilter, partFilter]);

  const stockById = useMemo(() => new Map(stock.map((s) => [s.id, s])), [stock]);

  const partsTotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.qty * l.price, 0),
    [lines],
  );

  const zeroStockLines = useMemo(
    () =>
      lines.filter((l) => {
        const s = stockById.get(l.stockId);
        return s && s.quantity === 0;
      }),
    [lines, stockById],
  );

  const insufficientStockLines = useMemo(
    () =>
      lines.filter((l) => {
        const s = stockById.get(l.stockId);
        return s && s.quantity > 0 && l.qty > s.quantity;
      }),
    [lines, stockById],
  );

  const canSend = useMemo(
    () =>
      lines.length > 0 &&
      lines.every((l) => l.stockId) &&
      zeroStockLines.length === 0 &&
      insufficientStockLines.length === 0,
    [lines, zeroStockLines, insufficientStockLines],
  );

  function validateLines(): boolean {
    if (lines.some((l) => !l.stockId)) {
      toast.error("Select a stock part for every line item");
      return false;
    }
    if (lines.some((l) => l.qty < 1)) {
      toast.error("Quantity must be at least 1");
      return false;
    }
    if (zeroStockLines.length > 0) {
      toast.error("Cannot proceed — selected parts include zero-stock items");
      return false;
    }
    if (insufficientStockLines.length > 0) {
      toast.error("Cannot proceed — quantity exceeds available stock for some parts");
      return false;
    }
    return true;
  }

  function updateLine(key: string, patch: Partial<EditLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.stockId) {
          const s = stockById.get(patch.stockId);
          if (s) next.price = s.price;
        }
        return next;
      }),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function handleSave() {
    if (!invoice) return;
    if (!validateLines()) return;

    setSaving(true);
    try {
      const updated = await updateSupplierInvoice(invoice.id, {
        lineItems: lines.map((l) => ({
          stockId: l.stockId,
          qty: l.qty,
          price: l.price,
        })),
      });
      toast.success(
        updated.awaitingStock
          ? "Invoice updated — still awaiting stock for some parts"
          : "Invoice updated — ready to send",
      );
      onSaved?.({
        ...invoice,
        parts: updated.parts,
        total: updated.total,
        labourCost: 0,
        stockReady: updated.stockReady,
        awaitingStock: updated.awaitingStock,
        stockItems: updated.stockItems,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!invoice) return;
    if (!validateLines()) return;

    setSending(true);
    try {
      await updateSupplierInvoice(invoice.id, {
        lineItems: lines.map((l) => ({
          stockId: l.stockId,
          qty: l.qty,
          price: l.price,
        })),
      });
      await sendSupplierInvoice(invoice.id);
      toast.success(`Invoice sent to ${invoice.workshopName}`);
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
  }

  if (!invoice) return null;

  const statusLabel =
    invoice.status === "Sent"
      ? "Sent"
      : canSend
        ? "Ready to send"
        : "Awaiting stock";
  const statusBadgeClass =
    invoice.status === "Sent"
      ? "border-emerald-300 text-emerald-800"
      : canSend
        ? "border-blue-300 text-blue-800"
        : "border-amber-300 text-amber-800";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit invoice</DialogTitle>
          <DialogDescription className="font-mono text-xs">{invoice.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-slate-500">Workshop:</span>
            <span className="font-medium">{invoice.workshopName}</span>
            {invoice.vehicle && (
              <>
                <span className="text-slate-300">·</span>
                <span>{invoice.vehicle}</span>
              </>
            )}
            <Badge variant="outline" className={statusBadgeClass}>
              {statusLabel}
            </Badge>
          </div>

          {(zeroStockLines.length > 0 || insufficientStockLines.length > 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Stock warning</p>
                {zeroStockLines.length > 0 && (
                  <p className="text-xs mt-1">
                    {zeroStockLines.length} selected part(s) have zero stock. Choose in-stock
                    alternatives before sending.
                  </p>
                )}
                {insufficientStockLines.length > 0 && (
                  <p className="text-xs mt-1">
                    {insufficientStockLines.length} line(s) exceed available quantity.
                  </p>
                )}
              </div>
            </div>
          )}

          {canSend && invoice.status !== "Sent" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              All parts in stock — you can save or send this invoice to the workshop.
            </div>
          )}

          <div>
            <Label className="mb-2 block">Line items — select from stock</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search parts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Vehicle model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={partFilter} onValueChange={setPartFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Part name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parts</SelectItem>
                  {partNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part (from stock)</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-28">Unit (NZD)</TableHead>
                  <TableHead className="w-28">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const selected = stockById.get(line.stockId);
                  const isZeroStock = selected?.quantity === 0;
                  const options =
                    filteredStock.length > 0
                      ? filteredStock
                      : selected
                        ? [selected]
                        : stock;

                  return (
                    <TableRow key={line.key}>
                      <TableCell>
                        <Select
                          value={line.stockId || undefined}
                          onValueChange={(v) => updateLine(line.key, { stockId: v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select part from stock" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {stockLabel(s)} — {s.quantity} in stock · NZD ${s.price.toFixed(2)}
                                {s.quantity === 0 ? " ⚠" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isZeroStock && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Out of stock (0 available)
                          </p>
                        )}
                        {selected && selected.quantity > 0 && line.qty > selected.quantity && (
                          <p className="mt-1 text-xs text-amber-700">
                            Only {selected.quantity} in stock for qty {line.qty}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="h-9"
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(line.key, { qty: Math.max(1, Number(e.target.value)) })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-9"
                          value={line.price}
                          onChange={(e) =>
                            updateLine(line.key, { price: Math.max(0, Number(e.target.value)) })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(line.qty * line.price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">
                    Total
                  </TableCell>
                  <TableCell className="font-bold">${partsTotal.toFixed(2)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((p) => [...p, newLine()])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add line
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || sending}>
                <Save className="mr-1 h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
              {invoice.status !== "Sent" && (
                <Button onClick={handleSend} disabled={!canSend || saving || sending}>
                  <Mail className="mr-1 h-3.5 w-3.5" />
                  {sending ? "Sending…" : "Send to workshop"}
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Created {format(invoice.createdAt, "dd MMM yyyy")}. Send is enabled when every line
            uses in-stock parts with sufficient quantity.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useStore, type Invoice } from "@/lib/store";
import {
  updateSupplierInvoice,
  sendSupplierInvoice,
  ApiError,
} from "@/lib/api";
import { downloadInvoicePdf } from "@/lib/pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceDetailDialog } from "./detail-dialogs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Download, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

export function SupplierInvoicesSection() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { parts: Invoice["parts"]; labourCost: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [listTab, setListTab] = useState<"queue" | "all">("queue");

  const draftInvoices = state.invoices.filter((i) => i.status !== "Sent" && i.status?.toLowerCase() !== "paid");
  const allInvoices = [...state.invoices].sort((a, b) => b.createdAt - a.createdAt);
  const displayInvoices = listTab === "queue" ? draftInvoices : allInvoices;

  function getEdit(inv: Invoice) {
    return edits[inv.id] ?? { parts: inv.parts.map((p) => ({ ...p })), labourCost: inv.labourCost };
  }

  function updatePart(invId: string, idx: number, field: "qty" | "price", value: number) {
    setEdits((prev) => {
      const base = prev[invId] ?? getEdit(state.invoices.find((i) => i.id === invId)!);
      const parts = base.parts.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
      return { ...prev, [invId]: { ...base, parts } };
    });
  }

  function calcTotal(invId: string) {
    const e = edits[invId];
    if (!e) return state.invoices.find((i) => i.id === invId)?.total ?? 0;
    return e.parts.reduce((s, p) => s + p.price * p.qty, 0) + e.labourCost;
  }

  async function saveInvoice(inv: Invoice) {
    const edit = getEdit(inv);
    setSaving(inv.id);
    try {
      await updateSupplierInvoice(inv.id, { lineItems: edit.parts, labourCost: edit.labourCost });
      await refreshSupplierData();
      toast.success("Invoice updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function send(inv: Invoice) {
    const edit = getEdit(inv);
    setSending(inv.id);
    try {
      await updateSupplierInvoice(inv.id, { lineItems: edit.parts, labourCost: edit.labourCost });
      await sendSupplierInvoice(inv.id);
      await refreshSupplierData();
      addLog(`Invoice ${inv.id} sent to ${inv.workshopName}`, "system");
      toast.success(`Invoice sent to ${inv.workshopName}`);
      setExpanded(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  return (
    <>
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Queue drafts or browse all invoices with full detail</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={listTab} onValueChange={(v) => setListTab(v as "queue" | "all")} className="mb-4">
          <TabsList>
            <TabsTrigger value="queue">Queue ({draftInvoices.length})</TabsTrigger>
            <TabsTrigger value="all">All ({allInvoices.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {displayInvoices.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            {listTab === "queue" ? "No draft invoices." : "No invoices yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {displayInvoices.map((inv) => {
              const isDraft = inv.status !== "Sent" && inv.status?.toLowerCase() !== "paid";
              const isOpen = expanded === inv.id;
              const edit = getEdit(inv);
              return (
                <div key={inv.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 bg-white p-4 text-left hover:bg-slate-50"
                    onClick={() => setExpanded(isOpen ? null : inv.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="font-mono text-xs text-slate-500">{inv.id}</div>
                        <div className="text-sm font-medium">{inv.workshopName}</div>
                        {inv.vehicle && <div className="text-xs text-slate-500">{inv.vehicle}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{inv.status ?? "Draft"}</Badge>
                      <span className="font-medium">${calcTotal(inv.id).toLocaleString()}</span>
                    </div>
                  </button>
                  {isOpen && isDraft && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Part</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Unit price</TableHead>
                            <TableHead className="w-32">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {edit.parts.map((p, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{p.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  value={p.qty}
                                  onChange={(e) => updatePart(inv.id, idx, "qty", Number(e.target.value))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={p.price}
                                  onChange={(e) => updatePart(inv.id, idx, "price", Number(e.target.value))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>${(p.price * p.qty).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} className="font-medium">
                              Labour
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={edit.labourCost}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [inv.id]: { ...edit, labourCost: Number(e.target.value) },
                                  }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={3} className="font-bold">
                              Total
                            </TableCell>
                            <TableCell className="font-bold">${calcTotal(inv.id).toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadInvoicePdf({
                              id: inv.id,
                              quotationId: inv.quotationId,
                              workshopName: inv.workshopName,
                              vehicle: inv.vehicle,
                              parts: edit.parts,
                              labourCost: edit.labourCost,
                              total: calcTotal(inv.id),
                              createdAt: inv.createdAt,
                            })
                          }
                        >
                          <Download className="mr-1 h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => saveInvoice(inv)} disabled={saving === inv.id}>
                          {saving === inv.id ? "Saving…" : "Save changes"}
                        </Button>
                        <Button size="sm" onClick={() => send(inv)} disabled={sending === inv.id}>
                          <Mail className="mr-1 h-3.5 w-3.5" />
                          {sending === inv.id ? "Sending…" : "Send to workshop"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {(!isOpen || !isDraft) && (
                    <div className="border-t border-slate-100 px-4 py-2 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewInvoice(inv)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadInvoicePdf({
                            id: inv.id,
                            quotationId: inv.quotationId,
                            workshopName: inv.workshopName,
                            vehicle: inv.vehicle,
                            parts: inv.parts,
                            labourCost: inv.labourCost,
                            total: inv.total,
                            createdAt: inv.createdAt,
                          })
                        }
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> PDF
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    <InvoiceDetailDialog
      invoice={viewInvoice}
      open={viewInvoice !== null}
      onOpenChange={(o) => !o && setViewInvoice(null)}
    />
    </>
  );
}

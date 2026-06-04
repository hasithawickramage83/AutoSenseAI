import { useState } from "react";
import { useStore, type PurchaseOrder } from "@/lib/store";
import {
  updateSupplierPurchaseOrder,
  sendSupplierPurchaseOrder,
  ApiError,
} from "@/lib/api";
import { downloadPurchaseOrderPdf } from "@/lib/pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrderDetailDialog } from "./detail-dialogs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Download, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

export function SupplierPurchaseOrdersSection() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { parts: PurchaseOrder["parts"]; vendorEmail: string; urgency: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [viewPo, setViewPo] = useState<PurchaseOrder | null>(null);
  const [listTab, setListTab] = useState<"queue" | "all">("queue");

  const draftPOs = state.purchaseOrders.filter((po) => po.status !== "Sent");
  const allPOs = [...state.purchaseOrders].sort((a, b) => b.createdAt - a.createdAt);
  const displayPOs = listTab === "queue" ? draftPOs : allPOs;

  function getEdit(po: PurchaseOrder) {
    return (
      edits[po.id] ?? {
        parts: po.parts.map((p) => ({ ...p, price: p.price ?? 0 })),
        vendorEmail: po.vendorEmail,
        urgency: po.urgency,
      }
    );
  }

  function updatePart(poId: string, idx: number, field: "qty" | "price", value: number) {
    setEdits((prev) => {
      const po = state.purchaseOrders.find((p) => p.id === poId)!;
      const base = prev[poId] ?? getEdit(po);
      const parts = base.parts.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
      return { ...prev, [poId]: { ...base, parts } };
    });
  }

  async function savePO(po: PurchaseOrder) {
    const edit = getEdit(po);
    setSaving(po.id);
    try {
      await updateSupplierPurchaseOrder(po.quotationId, {
        parts: edit.parts.map((p) => ({
          id: p.id!,
          name: p.name,
          qty: p.qty,
          price: p.price ?? 0,
        })),
        vendorEmail: edit.vendorEmail,
        urgency: edit.urgency,
      });
      await refreshSupplierData();
      toast.success("Purchase order updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function send(po: PurchaseOrder) {
    const edit = getEdit(po);
    setSaving(po.id);
    try {
      await updateSupplierPurchaseOrder(po.quotationId, {
        parts: edit.parts.map((p) => ({
          id: p.id!,
          name: p.name,
          qty: p.qty,
          price: p.price ?? 0,
        })),
        vendorEmail: edit.vendorEmail,
        urgency: edit.urgency,
      });
      setSending(po.id);
      await sendSupplierPurchaseOrder(po.quotationId);
      await refreshSupplierData();
      addLog(`Purchase order sent to ${edit.vendorEmail}`, "system");
      toast.success(`PO dispatched to ${edit.vendorEmail}`);
      setExpanded(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Send failed");
    } finally {
      setSaving(null);
      setSending(null);
    }
  }

  return (
    <>
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Purchase orders</CardTitle>
        <CardDescription>Draft queue or all POs with full detail</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={listTab} onValueChange={(v) => setListTab(v as "queue" | "all")} className="mb-4">
          <TabsList>
            <TabsTrigger value="queue">Queue ({draftPOs.length})</TabsTrigger>
            <TabsTrigger value="all">All ({allPOs.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {displayPOs.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No purchase orders yet.</div>
        ) : (
          <div className="space-y-2">
            {displayPOs.map((po) => {
              const isDraft = po.status !== "Sent";
              const isOpen = expanded === po.id;
              const edit = getEdit(po);
              const total = edit.parts.reduce((s, p) => s + (p.price ?? 0) * p.qty, 0);
              return (
                <div key={po.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 bg-white p-4 text-left hover:bg-slate-50"
                    onClick={() => setExpanded(isOpen ? null : po.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="font-mono text-xs text-slate-500">{po.id}</div>
                        <div className="text-sm font-medium">{po.workshopName ?? "Workshop"}</div>
                        {po.vehicle && <div className="text-xs text-slate-500">{po.vehicle}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          po.urgency === "Critical"
                            ? "bg-red-100 text-red-700"
                            : po.urgency === "Urgent"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }
                      >
                        {po.urgency}
                      </Badge>
                      <span className="font-medium">${total.toLocaleString()}</span>
                    </div>
                  </button>
                  {isOpen && isDraft && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500">Vendor email</label>
                          <Input
                            value={edit.vendorEmail}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [po.id]: { ...edit, vendorEmail: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Urgency</label>
                          <select
                            value={edit.urgency}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [po.id]: { ...edit, urgency: e.target.value },
                              }))
                            }
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                          >
                            <option value="Standard">Standard</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                      </div>
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
                            <TableRow key={p.id ?? idx}>
                              <TableCell>{p.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  value={p.qty}
                                  onChange={(e) => updatePart(po.id, idx, "qty", Number(e.target.value))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={p.price ?? 0}
                                  onChange={(e) => updatePart(po.id, idx, "price", Number(e.target.value))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>${((p.price ?? 0) * p.qty).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} className="font-bold">
                              Total
                            </TableCell>
                            <TableCell className="font-bold">${total.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadPurchaseOrderPdf({
                              id: po.id,
                              quotationId: po.quotationId,
                              workshopName: po.workshopName ?? "",
                              vehicle: po.vehicle,
                              vendorEmail: edit.vendorEmail,
                              urgency: edit.urgency,
                              parts: edit.parts.map((p) => ({
                                name: p.name,
                                qty: p.qty,
                                price: p.price ?? 0,
                              })),
                              createdAt: po.createdAt,
                            })
                          }
                        >
                          <Download className="mr-1 h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => savePO(po)} disabled={saving === po.id}>
                          {saving === po.id ? "Saving…" : "Save changes"}
                        </Button>
                        <Button size="sm" onClick={() => send(po)} disabled={sending === po.id}>
                          <Mail className="mr-1 h-3.5 w-3.5" />
                          {sending === po.id ? "Sending…" : "Send purchase order"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {(!isOpen || !isDraft) && (
                    <div className="border-t border-slate-100 px-4 py-2 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewPo(po)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const edit = getEdit(po);
                          const total = edit.parts.reduce((s, p) => s + (p.price ?? 0) * p.qty, 0);
                          downloadPurchaseOrderPdf({
                            id: po.id,
                            quotationId: po.quotationId,
                            workshopName: po.workshopName ?? "",
                            vehicle: po.vehicle,
                            vendorEmail: edit.vendorEmail,
                            urgency: edit.urgency,
                            parts: edit.parts.map((p) => ({
                              name: p.name,
                              qty: p.qty,
                              price: p.price ?? 0,
                            })),
                            createdAt: po.createdAt,
                          });
                        }}
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
    <PurchaseOrderDetailDialog
      purchaseOrder={viewPo}
      open={viewPo !== null}
      onOpenChange={(o) => !o && setViewPo(null)}
    />
    </>
  );
}

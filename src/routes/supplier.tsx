import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore, type Invoice, type PurchaseOrder, type Quotation } from "../lib/store";
import {
  processSupplierQuotation,
  updateSupplierInvoice,
  sendSupplierInvoice,
  updateSupplierPurchaseOrder,
  sendSupplierPurchaseOrder,
  ApiError,
} from "../lib/api";
import {
  downloadQuotationPdf,
  downloadInvoicePdf,
  downloadPurchaseOrderPdf,
} from "../lib/pdf";
import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import {
  Inbox,
  Boxes,
  FileText,
  ShoppingCart,
  Sparkles,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supplier")({
  component: SupplierPage,
});

function SupplierPage() {
  const { refreshSupplierData } = useStore();

  useEffect(() => {
    refreshSupplierData();
  }, [refreshSupplierData]);

  return (
    <DashboardShell
      role="supplier"
      title="Supplier Dashboard"
      nav={[
        { label: "Incoming Requests", to: "/supplier", icon: <Inbox className="h-4 w-4" /> },
        { label: "Stock Alerts", to: "/supplier", icon: <Boxes className="h-4 w-4" /> },
        { label: "AI Invoice Queue", to: "/supplier", icon: <FileText className="h-4 w-4" /> },
        { label: "Purchase Orders", to: "/supplier", icon: <ShoppingCart className="h-4 w-4" /> },
      ]}
    >
      <Tabs defaultValue="requests">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">Incoming Requests</TabsTrigger>
          <TabsTrigger value="stock">Stock Alerts</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Queue</TabsTrigger>
          <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="requests"><Requests /></TabsContent>
        <TabsContent value="stock"><StockAlerts /></TabsContent>
        <TabsContent value="invoices"><InvoiceQueue /></TabsContent>
        <TabsContent value="pos"><PurchaseOrders /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function Requests() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const incoming = state.quotations.filter(
    (q) => q.status === "Pending" || q.status === "Processing",
  );

  async function processRequest(q: Quotation) {
    setProcessing(q.id);
    addLog(`AI processing supplier request for ${q.id.slice(0, 8)}`, "ai");
    try {
      const data = await processSupplierQuotation(q.id);
      await refreshSupplierData();
      if (data.invoice) {
        addLog(`AI generated invoice ${data.invoice.id.slice(0, 8)} for ${q.id.slice(0, 8)}`, "ai");
        toast.success(`Invoice ready for ${q.workshopName}`);
      }
      if (data.purchaseOrders.length > 0) {
        addLog(`AI created purchase order(s) due to stock shortage`, "ai");
        toast.warning(`Stock insufficient — Purchase order drafted`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Processing failed");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incoming Quotation Requests</CardTitle>
        <CardDescription>Quotations submitted by workshops — process to generate invoices or purchase orders</CardDescription>
      </CardHeader>
      <CardContent>
        {incoming.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">
            No incoming requests. Workshops submit damage reports to create quotations.
          </div>
        ) : (
          <div className="space-y-3">
            {incoming.map((q) => (
              <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      Quotation from {q.workshopName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {q.id.slice(0, 8)} · {q.vehicle}
                    </div>
                    <div className="text-xs text-slate-600 mt-2">{q.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.parts.map((p) => (
                        <Badge key={p.name} variant="secondary">{p.name} ×{p.qty}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline">{q.severity} severity</Badge>
                      <Badge variant="outline">{q.status}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadQuotationPdf({
                          id: q.id,
                          workshopName: q.workshopName,
                          vehicle: q.vehicle,
                          description: q.description,
                          parts: q.parts,
                          damages: q.damages,
                          recommendations: q.recommendations,
                          severity: q.severity,
                          labourCost: q.labourCost,
                          createdAt: q.createdAt,
                        })
                      }
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button onClick={() => processRequest(q)} disabled={processing === q.id}>
                      <Sparkles className="h-4 w-4 mr-1" />
                      {processing === q.id ? "Processing…" : "Process with AI"}
                    </Button>
                  </div>
                </div>
                {processing === q.id && <Progress value={70} className="mt-3 animate-pulse" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StockAlerts() {
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");

  const models = useMemo(
    () => [...new Set(state.supplierStock.map((s) => s.vehicleModel))].sort(),
    [state.supplierStock],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return state.supplierStock.filter((s) => {
      if (modelFilter !== "all" && s.vehicleModel !== modelFilter) return false;
      if (!q) return true;
      return (
        s.partName.toLowerCase().includes(q) ||
        s.vehicleModel.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [state.supplierStock, search, modelFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory &amp; Stock</CardTitle>
        <CardDescription>All available stock by vehicle model</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search parts by keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">All vehicle models</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No stock items found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Vehicle Model</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price (NZD)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.partName}</div>
                    {s.description && (
                      <div className="text-xs text-slate-500">{s.description}</div>
                    )}
                  </TableCell>
                  <TableCell>{s.vehicleModel}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell>${s.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {s.quantity === 0 ? (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Out of stock
                      </Badge>
                    ) : s.quantity <= 2 ? (
                      <Badge className="bg-amber-100 text-amber-700">Low</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Available
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceQueue() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { parts: Invoice["parts"]; labourCost: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const draftInvoices = state.invoices.filter((i) => i.status !== "Sent");

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
      await updateSupplierInvoice(inv.id, {
        lineItems: edit.parts,
        labourCost: edit.labourCost,
      });
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
      await updateSupplierInvoice(inv.id, {
        lineItems: edit.parts,
        labourCost: edit.labourCost,
      });
      await sendSupplierInvoice(inv.id);
      await refreshSupplierData();
      addLog(`Invoice ${inv.id.slice(0, 8)} sent to ${inv.workshopName}`, "system");
      toast.success(`Invoice sent to ${inv.workshopName}`);
      setExpanded(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Queue</CardTitle>
        <CardDescription>Review and edit line items before sending to workshop</CardDescription>
      </CardHeader>
      <CardContent>
        {draftInvoices.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No draft invoices.</div>
        ) : (
          <div className="space-y-2">
            {draftInvoices.map((inv) => {
              const isOpen = expanded === inv.id;
              const edit = getEdit(inv);
              return (
                <div key={inv.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 p-4 bg-white hover:bg-slate-50 text-left"
                    onClick={() => setExpanded(isOpen ? null : inv.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="font-mono text-xs text-slate-500">{inv.id.slice(0, 8)}</div>
                        <div className="text-sm font-medium">{inv.workshopName}</div>
                        {inv.vehicle && <div className="text-xs text-slate-500">{inv.vehicle}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{inv.status ?? "Draft"}</Badge>
                      <span className="font-medium">${calcTotal(inv.id).toLocaleString()}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-200 p-4 bg-slate-50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Part</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Unit Price</TableHead>
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
                            <TableCell colSpan={3} className="font-medium">Labour</TableCell>
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
                            <TableCell colSpan={3} className="font-bold">Total</TableCell>
                            <TableCell className="font-bold">${calcTotal(inv.id).toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <div className="flex gap-2 mt-4 justify-end">
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
                          <Download className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveInvoice(inv)}
                          disabled={saving === inv.id}
                        >
                          {saving === inv.id ? "Saving…" : "Save Changes"}
                        </Button>
                        <Button size="sm" onClick={() => send(inv)} disabled={sending === inv.id}>
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          {sending === inv.id ? "Sending…" : "Send to Workshop"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PurchaseOrders() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { parts: PurchaseOrder["parts"]; vendorEmail: string; urgency: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const draftPOs = state.purchaseOrders.filter((po) => po.status !== "Sent");

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
    <Card>
      <CardHeader>
        <CardTitle>Purchase Orders</CardTitle>
        <CardDescription>Review and edit before sending to vendor</CardDescription>
      </CardHeader>
      <CardContent>
        {draftPOs.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No purchase orders yet.</div>
        ) : (
          <div className="space-y-2">
            {draftPOs.map((po) => {
              const isOpen = expanded === po.id;
              const edit = getEdit(po);
              const total = edit.parts.reduce((s, p) => s + (p.price ?? 0) * p.qty, 0);
              return (
                <div key={po.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 p-4 bg-white hover:bg-slate-50 text-left"
                    onClick={() => setExpanded(isOpen ? null : po.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="font-mono text-xs text-slate-500">{po.id.slice(0, 8)}</div>
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
                  {isOpen && (
                    <div className="border-t border-slate-200 p-4 bg-slate-50">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-xs text-slate-500">Vendor Email</label>
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
                            className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                            <TableHead className="w-32">Unit Price</TableHead>
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
                            <TableCell colSpan={3} className="font-bold">Total</TableCell>
                            <TableCell className="font-bold">${total.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <div className="flex gap-2 mt-4 justify-end">
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
                          <Download className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => savePO(po)}
                          disabled={saving === po.id}
                        >
                          {saving === po.id ? "Saving…" : "Save Changes"}
                        </Button>
                        <Button size="sm" onClick={() => send(po)} disabled={sending === po.id}>
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          {sending === po.id ? "Sending…" : "Send Purchase Order"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

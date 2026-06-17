import { useState } from "react";
import { useStore, type Invoice } from "@/lib/store";
import { sendSupplierInvoice, ApiError } from "@/lib/api";
import { downloadInvoicePdf } from "@/lib/pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceDetailDialog } from "./detail-dialogs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Download, ChevronDown, ChevronRight, Eye, PackageX, PackageCheck } from "lucide-react";
import { toast } from "sonner";

function invoiceBadge(inv: Invoice) {
  if (inv.status === "Sent") return { label: "Sent", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  if (inv.awaitingStock) return { label: "Awaiting stock", className: "bg-amber-50 text-amber-800 border-amber-200" };
  if (inv.stockReady) return { label: "Ready to send", className: "bg-blue-50 text-blue-800 border-blue-200" };
  return { label: inv.status ?? "Draft", className: "" };
}

export function SupplierInvoicesSection() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [listTab, setListTab] = useState<"queue" | "all">("queue");

  const draftInvoices = state.invoices.filter((i) => i.status !== "Sent" && i.status?.toLowerCase() !== "paid");
  const allInvoices = [...state.invoices].sort((a, b) => b.createdAt - a.createdAt);
  const displayInvoices = listTab === "queue" ? draftInvoices : allInvoices;

  async function send(inv: Invoice) {
    if (inv.awaitingStock) {
      toast.error("Cannot send — parts are not in stock yet");
      return;
    }
    setSending(inv.id);
    try {
      await sendSupplierInvoice(inv.id);
      await refreshSupplierData();
      addLog(`Invoice ${inv.id} sent to ${inv.workshopName}`, "system");
      toast.success(`Invoice sent to ${inv.workshopName}`);
      setExpanded(null);
      setViewInvoice(null);
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
          <CardDescription>
            Draft invoices stay locked until all parts are in stock, then you can send to the workshop
          </CardDescription>
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
                const isLocked = isDraft && Boolean(inv.awaitingStock);
                const canSend = isDraft && inv.stockReady && !inv.awaitingStock;
                const isOpen = expanded === inv.id;
                const badge = invoiceBadge(inv);

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
                        <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        <span className="font-medium">${inv.total.toLocaleString()}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                        {isLocked && (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <PackageX className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">Awaiting stock</p>
                              <p className="text-xs mt-1 text-amber-800">
                                Edit line items to select in-stock parts, or wait for inventory.
                              </p>
                              {inv.stockItems?.map((s) => (
                                <p key={s.partName} className="text-xs mt-1">
                                  {s.partName}: need {s.requiredQty}, have {s.availableQty}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {canSend && (
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            <PackageCheck className="h-5 w-5" />
                            All parts in stock — ready to send.
                          </div>
                        )}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Part</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Unit price</TableHead>
                              <TableHead>Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {inv.parts.map((p, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.qty}</TableCell>
                                <TableCell>${p.price.toFixed(2)}</TableCell>
                                <TableCell>${(p.price * p.qty).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={3} className="font-bold">Total</TableCell>
                              <TableCell className="font-bold">${inv.total.toFixed(2)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf({
                            id: inv.id, quotationId: inv.quotationId, workshopName: inv.workshopName,
                            vehicle: inv.vehicle, parts: inv.parts, labourCost: inv.labourCost,
                            total: inv.total, createdAt: inv.createdAt,
                          })}>
                            <Download className="mr-1 h-3.5 w-3.5" /> PDF
                          </Button>
                          {canSend && (
                            <Button size="sm" onClick={() => send(inv)} disabled={sending === inv.id}>
                              <Mail className="mr-1 h-3.5 w-3.5" />
                              {sending === inv.id ? "Sending…" : "Send to workshop"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {!isOpen && (
                      <div className="border-t border-slate-100 px-4 py-2 flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => setViewInvoice(inv)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> View details
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
        onSend={
          viewInvoice && viewInvoice.stockReady && !viewInvoice.awaitingStock && viewInvoice.status !== "Sent"
            ? () => send(viewInvoice)
            : undefined
        }
        sending={sending === viewInvoice?.id}
      />
    </>
  );
}

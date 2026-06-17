import { useMemo, useState } from "react";
import { useStore, type Invoice, type PurchaseOrder, type Quotation } from "@/lib/store";
import { downloadQuotationPdf, downloadInvoicePdf, downloadPurchaseOrderPdf } from "@/lib/pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QuotationDetailDialog,
  InvoiceDetailDialog,
  PurchaseOrderDetailDialog,
} from "./detail-dialogs";
import { InvoiceEditDialog } from "./invoice-edit-dialog";
import { Search, Eye, Download, FileText, Receipt, ShoppingCart, Pencil } from "lucide-react";
import { format } from "date-fns";

type RecordsTab = "quotations" | "invoices" | "pos";

function isDraftInvoice(inv: Invoice) {
  return inv.status !== "Sent" && inv.status?.toLowerCase() !== "paid";
}

function canEditInvoice(inv: Invoice) {
  return isDraftInvoice(inv) && (Boolean(inv.awaitingStock) || Boolean(inv.stockReady));
}

export function SupplierRecordsBrowser({
  defaultTab = "quotations",
  compact = false,
}: {
  defaultTab?: RecordsTab;
  compact?: boolean;
}) {
  const { state, refreshSupplierData } = useStore();
  const [tab, setTab] = useState<RecordsTab>(defaultTab);
  const [search, setSearch] = useState("");
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [viewPo, setViewPo] = useState<PurchaseOrder | null>(null);

  const filteredQuotes = useMemo(() => filterQuotes(state.quotations, search), [state.quotations, search]);
  const filteredInvoices = useMemo(() => filterInvoices(state.invoices, search), [state.invoices, search]);
  const filteredPos = useMemo(() => filterPos(state.purchaseOrders, search), [state.purchaseOrders, search]);

  const listHeight = compact ? "max-h-[320px]" : "";

  return (
    <>
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            {compact ? "Browse records" : "All quotations, invoices & purchase orders"}
          </CardTitle>
          <CardDescription>View full details for every record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by ID, workshop, vehicle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as RecordsTab)}>
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="quotations">
                <FileText className="mr-1 h-3.5 w-3.5" />
                Quotations ({state.quotations.length})
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <Receipt className="mr-1 h-3.5 w-3.5" />
                Invoices ({state.invoices.length})
              </TabsTrigger>
              <TabsTrigger value="pos">
                <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                POs ({state.purchaseOrders.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="quotations">
              <RecordList
                empty="No quotations found."
                className={listHeight}
                items={filteredQuotes.map((q) => (
                  <RecordRow
                    key={q.id}
                    title={q.vehicle}
                    subtitle={`${q.workshopName} · ${q.id}`}
                    meta={format(q.createdAt, "dd MMM yyyy")}
                    badge={q.status}
                    amount={`$${(q.parts.reduce((s, p) => s + p.price * p.qty, 0) + q.labourCost).toLocaleString()}`}
                    onView={() => setViewQuote(q)}
                    onDownload={() =>
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
                  />
                ))}
              />
            </TabsContent>
            <TabsContent value="invoices">
              <RecordList
                empty="No invoices found."
                className={listHeight}
                items={filteredInvoices.map((inv) => {
                  const badgeLabel =
                    inv.status === "Sent"
                      ? "Sent"
                      : inv.awaitingStock
                        ? "Awaiting stock"
                        : inv.stockReady
                          ? "Ready to send"
                          : inv.status ?? "Draft";
                  const badgeTone =
                    inv.status === "Sent"
                      ? "success"
                      : inv.awaitingStock
                        ? "warning"
                        : inv.stockReady
                          ? undefined
                          : "warning";
                  return (
                  <RecordRow
                    key={inv.id}
                    title={inv.workshopName}
                    subtitle={`${inv.vehicle ?? "—"} · ${inv.id}`}
                    meta={format(inv.createdAt, "dd MMM yyyy")}
                    badge={badgeLabel}
                    badgeTone={badgeTone as "success" | "warning" | "danger" | undefined}
                    amount={`$${inv.total.toLocaleString()}`}
                    onView={() => setViewInvoice(inv)}
                    onEdit={canEditInvoice(inv) ? () => setEditInvoice(inv) : undefined}
                    onDownload={() =>
                      downloadInvoicePdf({
                        id: inv.id,
                        quotationId: inv.quotationId,
                        workshopName: inv.workshopName,
                        vehicle: inv.vehicle,
                        parts: inv.parts,
                        labourCost: 0,
                        total: inv.total,
                        createdAt: inv.createdAt,
                      })
                    }
                  />
                );})}
              />
            </TabsContent>
            <TabsContent value="pos">
              <RecordList
                empty="No purchase orders found."
                className={listHeight}
                items={filteredPos.map((po) => {
                  const total = po.parts.reduce((s, p) => s + (p.price ?? 0) * p.qty, 0);
                  return (
                    <RecordRow
                      key={po.id}
                      title={po.workshopName ?? "Workshop"}
                      subtitle={`${po.vehicle ?? "—"} · ${po.quotationId}`}
                      meta={format(po.createdAt, "dd MMM yyyy")}
                      badge={po.status ?? "Draft"}
                      badgeTone={po.urgency === "Critical" ? "danger" : po.urgency === "Urgent" ? "warning" : undefined}
                      amount={`$${total.toLocaleString()}`}
                      onView={() => setViewPo(po)}
                      onDownload={() =>
                        downloadPurchaseOrderPdf({
                          id: po.id,
                          quotationId: po.quotationId,
                          workshopName: po.workshopName ?? "",
                          vehicle: po.vehicle,
                          vendorEmail: po.vendorEmail,
                          urgency: po.urgency,
                          parts: po.parts.map((p) => ({
                            name: p.name,
                            qty: p.qty,
                            price: p.price ?? 0,
                          })),
                          createdAt: po.createdAt,
                        })
                      }
                    />
                  );
                })}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <QuotationDetailDialog quotation={viewQuote} open={viewQuote !== null} onOpenChange={(o) => !o && setViewQuote(null)} />
      <InvoiceDetailDialog invoice={viewInvoice} open={viewInvoice !== null} onOpenChange={(o) => !o && setViewInvoice(null)} />
      <InvoiceEditDialog
        invoice={editInvoice}
        stock={state.supplierStock}
        open={editInvoice !== null}
        onOpenChange={(o) => !o && setEditInvoice(null)}
        onSaved={async () => {
          await refreshSupplierData();
        }}
        onSent={async () => {
          await refreshSupplierData();
        }}
      />
      <PurchaseOrderDetailDialog purchaseOrder={viewPo} open={viewPo !== null} onOpenChange={(o) => !o && setViewPo(null)} />
    </>
  );
}

function RecordList({
  items,
  empty,
  className,
}: {
  items: React.ReactNode[];
  empty: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  }
  return <ul className={`space-y-2 overflow-y-auto ${className}`}>{items}</ul>;
}

function RecordRow({
  title,
  subtitle,
  meta,
  badge,
  badgeTone,
  amount,
  onView,
  onEdit,
  onDownload,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge: string;
  badgeTone?: "success" | "warning" | "danger";
  amount: string;
  onView: () => void;
  onEdit?: () => void;
  onDownload: () => void;
}) {
  const badgeClass =
    badgeTone === "success"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : badgeTone === "warning"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : badgeTone === "danger"
          ? "bg-red-50 text-red-700 border-red-200"
          : "";

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        <p className="text-xs text-slate-400 mt-0.5">{meta}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Badge variant="outline" className={badgeClass}>
          {badge}
        </Badge>
        <span className="text-sm font-semibold text-[var(--workshop-primary)]">{amount}</span>
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          Details
        </Button>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function filterQuotes(quotes: Quotation[], search: string) {
  const q = search.toLowerCase().trim();
  const sorted = [...quotes].sort((a, b) => b.createdAt - a.createdAt);
  if (!q) return sorted;
  return sorted.filter(
    (x) =>
      x.id.toLowerCase().includes(q) ||
      x.workshopName.toLowerCase().includes(q) ||
      x.vehicle.toLowerCase().includes(q) ||
      x.status.toLowerCase().includes(q),
  );
}

function filterInvoices(invoices: Invoice[], search: string) {
  const q = search.toLowerCase().trim();
  const sorted = [...invoices].sort((a, b) => b.createdAt - a.createdAt);
  if (!q) return sorted;
  return sorted.filter(
    (x) =>
      x.id.toLowerCase().includes(q) ||
      x.workshopName.toLowerCase().includes(q) ||
      (x.vehicle?.toLowerCase().includes(q) ?? false) ||
      (x.status?.toLowerCase().includes(q) ?? false),
  );
}

function filterPos(pos: PurchaseOrder[], search: string) {
  const q = search.toLowerCase().trim();
  const sorted = [...pos].sort((a, b) => b.createdAt - a.createdAt);
  if (!q) return sorted;
  return sorted.filter(
    (x) =>
      x.id.toLowerCase().includes(q) ||
      x.quotationId.toLowerCase().includes(q) ||
      (x.workshopName?.toLowerCase().includes(q) ?? false) ||
      (x.vehicle?.toLowerCase().includes(q) ?? false),
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, uid, type Invoice, type PurchaseOrder, type Quotation } from "../lib/store";
import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import { Inbox, Boxes, FileText, ShoppingCart, Sparkles, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supplier")({
  component: SupplierPage,
});

function SupplierPage() {
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
  const { state, setState, addLog } = useStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const incoming = state.quotations.filter(
    (q) => q.status === "Pending" || q.status === "Processing",
  );

  function processRequest(q: Quotation) {
    setProcessing(q.id);
    addLog(`AI processing supplier request for ${q.id}`, "ai");
    setState((s) => ({
      ...s,
      quotations: s.quotations.map((x) => x.id === q.id ? { ...x, status: "Processing" } : x),
    }));

    setTimeout(() => {
      const stock = state.stock;
      const enriched = q.parts.map((p) => {
        const info = stock[p.name];
        return { ...p, price: info?.price ?? 500, available: (info?.qty ?? 0) >= p.qty };
      });
      const missing = enriched.filter((p) => !p.available);

      if (missing.length === 0) {
        // Create invoice
        const partsList = enriched.map(({ name, qty, price }) => ({ name, qty, price }));
        const partsTotal = partsList.reduce((sum, p) => sum + p.price * p.qty, 0);
        const total = partsTotal + q.labourCost;
        const invoice: Invoice = {
          id: uid("INV"),
          quotationId: q.id,
          workshopName: q.workshopName,
          parts: partsList,
          labourCost: q.labourCost,
          total,
          createdAt: Date.now(),
        };
        setState((s) => ({
          ...s,
          invoices: [invoice, ...s.invoices],
          quotations: s.quotations.map((x) =>
            x.id === q.id
              ? { ...x, status: "Invoiced", parts: partsList, invoiceId: invoice.id }
              : x,
          ),
          stock: Object.fromEntries(
            Object.entries(s.stock).map(([k, v]) => {
              const used = partsList.find((p) => p.name === k);
              return [k, used ? { ...v, qty: Math.max(0, v.qty - used.qty) } : v];
            }),
          ),
        }));
        addLog(`AI generated invoice ${invoice.id} for ${q.id}`, "ai");
        toast.success(`Invoice ${invoice.id} ready — email sent to ${q.workshopName}`);
      } else {
        const po: PurchaseOrder = {
          id: uid("PO"),
          quotationId: q.id,
          vendorEmail: "vendor@nzparts-supply.co.nz",
          parts: missing.map(({ name, qty }) => ({ name, qty })),
          urgency: q.severity === "High" ? "Critical" : q.severity === "Medium" ? "Urgent" : "Standard",
          createdAt: Date.now(),
        };
        setState((s) => ({
          ...s,
          purchaseOrders: [po, ...s.purchaseOrders],
          quotations: s.quotations.map((x) => x.id === q.id ? { ...x, status: "PO Raised", poId: po.id } : x),
        }));
        addLog(`AI created Purchase Order ${po.id} due to stock shortage`, "ai");
        toast.warning(`Stock insufficient — Purchase Order ${po.id} drafted`);
      }
      setProcessing(null);
    }, 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incoming AI Quotation Requests</CardTitle>
        <CardDescription>Auto-process to generate invoices or purchase orders</CardDescription>
      </CardHeader>
      <CardContent>
        {incoming.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">No incoming requests. Try uploading damage as a workshop.</div>
        ) : (
          <div className="space-y-3">
            {incoming.map((q) => (
              <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      New AI Quotation from {q.workshopName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{q.id} · {q.vehicle}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.parts.map((p) => (
                        <Badge key={p.name} variant="secondary">{p.name} ×{p.qty}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => processRequest(q)} disabled={processing === q.id}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    {processing === q.id ? "AI processing…" : "Process with AI"}
                  </Button>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory &amp; Stock Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price (NZD)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(state.stock).map(([name, info]) => (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell>{info.qty}</TableCell>
                <TableCell>${info.price}</TableCell>
                <TableCell>
                  {info.qty === 0 ? (
                    <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" /> Out of stock</Badge>
                  ) : info.qty <= 2 ? (
                    <Badge className="bg-amber-100 text-amber-700">Low</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Available</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoiceQueue() {
  const { state, addLog } = useStore();
  function send(invId: string, workshop: string) {
    addLog(`Invoice ${invId} emailed to ${workshop}`, "system");
    toast.success(`Email sent: "Your vehicle repair invoice is ready"`);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Invoice Queue</CardTitle>
        <CardDescription>Invoices generated automatically by AI</CardDescription>
      </CardHeader>
      <CardContent>
        {state.invoices.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No invoices yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Workshop</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.id}</TableCell>
                  <TableCell>{i.workshopName}</TableCell>
                  <TableCell>${i.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => send(i.id, i.workshopName)}>
                      <Mail className="h-3.5 w-3.5 mr-1" /> Send to Workshop
                    </Button>
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

function PurchaseOrders() {
  const { state, addLog } = useStore();
  function send(poId: string, vendor: string) {
    addLog(`Purchase Order ${poId} sent to ${vendor}`, "system");
    toast.success(`PO ${poId} dispatched to ${vendor}`);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Orders</CardTitle>
        <CardDescription>Generated when inventory is insufficient</CardDescription>
      </CardHeader>
      <CardContent>
        {state.purchaseOrders.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No purchase orders yet.</div>
        ) : (
          <div className="space-y-3">
            {state.purchaseOrders.map((po) => (
              <div key={po.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{po.id}</div>
                    <div className="text-sm">Vendor: <span className="font-medium">{po.vendorEmail}</span></div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {po.parts.map((p) => (
                        <Badge key={p.name} variant="secondary">{p.name} ×{p.qty}</Badge>
                      ))}
                    </div>
                    <Badge className={`mt-2 ${po.urgency === "Critical" ? "bg-red-100 text-red-700" : po.urgency === "Urgent" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                      {po.urgency}
                    </Badge>
                  </div>
                  <Button size="sm" onClick={() => send(po.id, po.vendorEmail)}>
                    <Mail className="h-3.5 w-3.5 mr-1" /> Send Purchase Order
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

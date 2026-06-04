import { useMemo, useState } from "react";
import { useStore, type Invoice } from "@/lib/store";
import { SummaryStatCard } from "./summary-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceStatusBadge } from "./status-badge";
import { format } from "date-fns";
import { Download, Search, Filter, DollarSign, CheckCircle, AlertCircle } from "lucide-react";

function paymentStatus(inv: Invoice): "Paid" | "Partially Paid" | "Pending" | "Overdue" {
  const s = inv.status?.toLowerCase() ?? "";
  if (s === "paid") return "Paid";
  if (s.includes("partial")) return "Partially Paid";
  if (s === "overdue") return "Overdue";
  return "Pending";
}

export function InvoicesSection() {
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const summary = useMemo(() => {
    const total = state.invoices.reduce((s, i) => s + i.total, 0);
    const paid = state.invoices
      .filter((i) => paymentStatus(i) === "Paid")
      .reduce((s, i) => s + i.total, 0);
    return { total, paid, outstanding: total - paid };
  }, [state.invoices]);

  const filtered = useMemo(() => {
    return state.invoices.filter((inv) => {
      const status = paymentStatus(inv);
      const matchSearch =
        !search.trim() ||
        inv.id.toLowerCase().includes(search.toLowerCase()) ||
        inv.quotationId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [state.invoices, search, statusFilter]);

  function downloadInvoice(invId: string) {
    const inv = state.invoices.find((i) => i.id === invId);
    if (!inv) return;
    const lines = [
      `AutoSense AI — Invoice ${inv.id}`,
      `Workshop: ${inv.workshopName}`,
      `Quotation: ${inv.quotationId}`,
      "",
      "Parts:",
      ...inv.parts.map((p) => `  ${p.name} x${p.qty} — NZD $${p.price}`),
      `Labour: NZD $${inv.labourCost}`,
      `Total: NZD $${inv.total}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryStatCard
          label="Total invoice amount"
          value={`$${summary.total.toLocaleString()}`}
          icon={DollarSign}
          accent="blue"
        />
        <SummaryStatCard
          label="Paid amount"
          value={`$${summary.paid.toLocaleString()}`}
          icon={CheckCircle}
          accent="green"
        />
        <SummaryStatCard
          label="Outstanding amount"
          value={`$${summary.outstanding.toLocaleString()}`}
          icon={AlertCircle}
          accent="orange"
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Partially Paid">Partially paid</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Invoice management</CardTitle>
          <CardDescription>Generated automatically by supplier AI</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((inv) => {
                const status = paymentStatus(inv);
                return (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-900">{inv.id}</p>
                        <p className="text-xs text-slate-500">Ref: {inv.quotationId.slice(0, 12)}</p>
                      </div>
                      <InvoiceStatusBadge status={status} />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-[var(--workshop-primary)]">
                      NZD ${inv.total.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {inv.createdAt ? format(inv.createdAt, "dd MMM yyyy") : "—"}
                    </p>
                    <ul className="mt-3 space-y-1 text-xs text-slate-600">
                      {inv.parts.slice(0, 3).map((p) => (
                        <li key={p.name}>
                          {p.name} ×{p.qty}
                        </li>
                      ))}
                      {inv.parts.length > 3 && (
                        <li className="text-slate-400">+{inv.parts.length - 3} more parts</li>
                      )}
                    </ul>
                    <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => downloadInvoice(inv.id)}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

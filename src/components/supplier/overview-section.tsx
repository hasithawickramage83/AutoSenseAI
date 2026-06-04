import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SummaryStatCard } from "@/components/workshop/summary-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  DollarSign,
  CheckCircle2,
  Clock,
  TrendingUp,
  Package,
  Inbox,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { SupplierRecordsBrowser } from "./records-browser";

const chartConfig = {
  amount: { label: "Revenue", color: "var(--workshop-primary)" },
  pipeline: { label: "Pipeline", color: "var(--workshop-primary)" },
};

const PIPELINE_COLORS: Record<string, string> = {
  "Total quotations": "#64748b",
  "PO Raised": "#3b82f6",
  Invoiced: "#1e3a5f",
  "Invoice pending": "#f59e0b",
};

export function SupplierOverviewSection({
  onViewRequests,
  onViewInvoices,
  onViewStock,
  onViewAllQuotations,
}: {
  onViewRequests: () => void;
  onViewInvoices: () => void;
  onViewStock: () => void;
  onViewAllQuotations?: () => void;
}) {
  const { state } = useStore();
  const quotes = state.quotations;
  const invoices = state.invoices;
  const stock = state.supplierStock;
  const pos = state.purchaseOrders;

  const stats = useMemo(() => {
    const pending = quotes.filter((q) => q.status === "Pending" || q.status === "Processing").length;
    const poRaised = quotes.filter((q) => q.status === "PO Raised").length;
    const invoiced = quotes.filter((q) => q.status === "Invoiced").length;
    const invoicedJobs = invoiced + poRaised;
    const sentInvoices = invoices.filter((i) => i.status === "Sent");
    const paidInvoices = invoices.filter((i) => i.status?.toLowerCase() === "paid");
    const draftInvoices = invoices.filter((i) => i.status !== "Sent" && i.status?.toLowerCase() !== "paid");
    const totalReceivables = sentInvoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = paidInvoices.reduce((s, i) => s + i.total, 0);
    const totalRevenue = sentInvoices.reduce((s, i) => s + i.total, 0) + totalPaid;
    const lowStock = stock.filter((s) => s.quantity > 0 && s.quantity <= 2).length;
    const outOfStock = stock.filter((s) => s.quantity <= 0).length;
    const draftPOs = pos.filter((p) => p.status !== "Sent").length;

    return {
      totalQuotations: quotes.length,
      pending,
      poRaised,
      invoiced,
      invoicedJobs,
      invoicePending: draftInvoices.length,
      totalReceivables,
      paidCount: paidInvoices.length,
      totalPaid,
      totalRevenue,
      sentInvoiceCount: sentInvoices.length,
      draftInvoices: draftInvoices.length,
      lowStock,
      outOfStock,
      draftPOs,
    };
  }, [quotes, invoices, stock, pos]);

  const fastMovingParts = useMemo(() => {
    const counts = new Map<string, { count: number; revenue: number }>();
    for (const inv of invoices) {
      for (const part of inv.parts) {
        const key = part.name;
        const existing = counts.get(key) ?? { count: 0, revenue: 0 };
        existing.count += part.qty;
        existing.revenue += part.price * part.qty;
        counts.set(key, existing);
      }
    }
    return [...counts.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [invoices]);

  const pipelinePie = useMemo(() => {
    const slices = [
      { name: "Total quotations", value: stats.totalQuotations, fill: PIPELINE_COLORS["Total quotations"] },
      { name: "PO Raised", value: stats.poRaised, fill: PIPELINE_COLORS["PO Raised"] },
      { name: "Invoiced", value: stats.invoiced, fill: PIPELINE_COLORS.Invoiced },
      { name: "Invoice pending", value: stats.invoicePending, fill: PIPELINE_COLORS["Invoice pending"] },
    ];
    return slices.filter((s) => s.value > 0);
  }, [stats]);

  const monthlyRevenue = useMemo(() => {
    const sent = invoices.filter((i) => i.status === "Sent" || i.status?.toLowerCase() === "paid");
    return buildMonthlySeries(sent.map((i) => ({ at: i.createdAt, amount: i.total })));
  }, [invoices]);

  const recentJobs = useMemo(
    () => [...quotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [quotes],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard label="Total quotations" value={stats.totalQuotations} icon={FileText} accent="blue" />
        <SummaryStatCard label="Invoiced jobs" value={stats.invoicedJobs} icon={Briefcase} accent="green" />
        <SummaryStatCard
          label="Total receivables"
          value={`$${stats.totalReceivables.toLocaleString()}`}
          icon={Clock}
          accent="orange"
        />
        <SummaryStatCard
          label="Total revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          accent="blue"
        />
        <SummaryStatCard label="Paid invoices" value={stats.paidCount} icon={CheckCircle2} accent="green" />
        <SummaryStatCard label="Sent invoices" value={stats.sentInvoiceCount} icon={TrendingUp} accent="slate" />
        <SummaryStatCard label="Pending requests" value={stats.pending} icon={Inbox} accent="orange" />
        <SummaryStatCard label="Draft POs" value={stats.draftPOs} icon={ShoppingCart} accent="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly revenue</CardTitle>
            <CardDescription>Sent and paid invoice totals by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={monthlyRevenue} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="amount" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quotation &amp; invoice pipeline</CardTitle>
            <CardDescription>
              Total quotations: {stats.totalQuotations} · Pending requests: {stats.pending}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pipelinePie.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
            ) : (
              <>
                <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full max-w-[220px]">
                  <PieChart>
                    <Pie
                      data={pipelinePie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {pipelinePie.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => [`${value}`, String(name)]}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "Total quotations", value: stats.totalQuotations, color: PIPELINE_COLORS["Total quotations"] },
                    { label: "PO Raised", value: stats.poRaised, color: PIPELINE_COLORS["PO Raised"] },
                    { label: "Invoiced", value: stats.invoiced, color: PIPELINE_COLORS.Invoiced },
                    { label: "Invoice pending", value: stats.invoicePending, color: PIPELINE_COLORS["Invoice pending"] },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                        {item.label}
                      </span>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Fast-moving parts</CardTitle>
              <CardDescription>Most invoiced parts by volume</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onViewInvoices}>
              Invoices
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {fastMovingParts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoice data yet.</p>
            ) : (
              <ul className="space-y-2">
                {fastMovingParts.map((part, i) => (
                  <li
                    key={part.name}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--workshop-primary)]/10 text-xs font-bold text-[var(--workshop-primary)]">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-800">{part.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-xs font-semibold text-slate-900">×{part.count}</div>
                      <div className="text-xs text-slate-500">${part.revenue.toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--workshop-primary)] to-[var(--workshop-primary-dark)] px-6 py-5 text-white">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Operations snapshot
            </CardTitle>
            <CardDescription className="text-blue-100/90 mt-1">
              {stats.draftInvoices} draft invoice(s) · {stats.draftPOs} open PO(s)
            </CardDescription>
          </div>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Low stock SKUs</span>
              <span className="font-semibold text-amber-700">{stats.lowStock}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Out of stock</span>
              <span className="font-semibold text-red-700">{stats.outOfStock}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={onViewRequests}>
                <Inbox className="mr-1 h-3.5 w-3.5" />
                Requests
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={onViewStock}>
                <Package className="mr-1 h-3.5 w-3.5" />
                Stock
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent quotation jobs</CardTitle>
          {onViewAllQuotations && (
            <Button variant="outline" size="sm" onClick={onViewAllQuotations}>
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{job.vehicle}</p>
                      <p className="text-xs text-slate-500">{job.workshopName}</p>
                    </div>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{format(job.createdAt, "dd MMM yyyy")}</p>
                  {job.severity === "High" && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      High severity
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierRecordsBrowser compact />
    </div>
  );
}

function buildMonthlySeries(items: { at: number; amount: number }[]) {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(format(d, "MMM yy"), 0);
  }
  items.forEach(({ at, amount }) => {
    const key = format(at, "MMM yy");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
  });
  return Array.from(buckets.entries()).map(([month, amount]) => ({ month, amount }));
}

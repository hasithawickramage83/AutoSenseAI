import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SummaryStatCard } from "./summary-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { QuotationStatusBadge } from "./status-badge";
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
  Upload,
  FileText,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

const chartConfig = {
  quotations: { label: "Quotations", color: "var(--workshop-primary)" },
  invoices: { label: "Invoices", color: "var(--workshop-accent-green)" },
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Processing: "#fb923c",
  Approved: "#059669",
  "PO Raised": "#3b82f6",
  Invoiced: "#1e3a5f",
};

export function OverviewSection({ onUpload, onViewQuotations }: { onUpload: () => void; onViewQuotations: () => void }) {
  const { state } = useStore();
  const quotes = state.quotations;
  const invoices = state.invoices;

  const stats = useMemo(() => {
    const pending = quotes.filter((q) => q.status === "Pending" || q.status === "Processing").length;
    const approved = quotes.filter((q) => q.status === "Approved" || q.status === "PO Raised").length;
    const invoicedJobs = quotes.filter((q) => q.status === "Invoiced").length;
    const totalAmount = invoices.reduce((s, i) => s + i.total, 0);
    const paidAmount = invoices
      .filter((i) => i.status?.toLowerCase() === "paid")
      .reduce((s, i) => s + i.total, 0);
    return {
      totalQuotes: quotes.length,
      pending,
      approved,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((i) => i.status?.toLowerCase() === "paid").length,
      outstandingInvoices: invoices.filter((i) => i.status?.toLowerCase() !== "paid").length,
      totalUploads: quotes.length,
      invoicedJobs,
      totalAmount,
      paidAmount,
      outstandingAmount: totalAmount - paidAmount,
    };
  }, [quotes, invoices]);

  const monthlyQuotes = useMemo(() => buildMonthlySeries(quotes.map((q) => q.createdAt)), [quotes]);
  const monthlyInvoices = useMemo(() => buildMonthlySeries(invoices.map((i) => i.createdAt)), [invoices]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    quotes.forEach((q) => {
      counts[q.status] = (counts[q.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] ?? "#94a3b8" }));
  }, [quotes]);

  const recentJobs = useMemo(
    () => [...quotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    [quotes],
  );

  const recentActivity = useMemo(() => {
    const items: { id: string; type: string; message: string; at: number }[] = [];
    quotes.slice(0, 3).forEach((q) =>
      items.push({
        id: `q-${q.id}`,
        type: "quotation",
        message: `Quotation for ${q.vehicle} — ${q.status}`,
        at: q.createdAt,
      }),
    );
    invoices.slice(0, 3).forEach((inv) =>
      items.push({
        id: `i-${inv.id}`,
        type: "invoice",
        message: `Invoice ${inv.id.slice(0, 8)} — NZD $${inv.total.toLocaleString()}`,
        at: inv.createdAt,
      }),
    );
    state.logs.slice(0, 5).forEach((l) =>
      items.push({ id: l.id, type: l.type, message: l.message, at: l.createdAt }),
    );
    return items.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [quotes, invoices, state.logs]);

  const combinedMonthly = monthlyQuotes.map((row, i) => ({
    month: row.month,
    quotations: row.count,
    invoices: monthlyInvoices[i]?.count ?? 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard label="Total Quotations" value={stats.totalQuotes} icon={FileText} accent="blue" />
        <SummaryStatCard label="Pending Quotations" value={stats.pending} icon={Clock} accent="orange" />
        <SummaryStatCard label="Approved Quotations" value={stats.approved} icon={CheckCircle2} accent="green" />
        <SummaryStatCard label="Total Invoices" value={stats.totalInvoices} icon={Receipt} accent="blue" />
        <SummaryStatCard label="Paid Invoices" value={stats.paidInvoices} icon={CheckCircle2} accent="green" />
        <SummaryStatCard label="Outstanding Invoices" value={stats.outstandingInvoices} icon={AlertCircle} accent="orange" />
        <SummaryStatCard label="Damage Uploads" value={stats.totalUploads} icon={ImagePlus} accent="slate" />
        <SummaryStatCard label="Invoiced Jobs" value={stats.invoicedJobs} icon={Briefcase} accent="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly activity</CardTitle>
            <CardDescription>Quotation and invoice volume over recent months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={combinedMonthly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="quotations" fill="var(--color-quotations)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invoices" fill="var(--color-invoices)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Job status</CardTitle>
            <CardDescription>Distribution of quotation statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {statusDistribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No jobs yet</p>
            ) : (
              <ChartContainer config={chartConfig} className="mx-auto h-[220px] w-full max-w-[220px]">
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
              </ChartContainer>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {statusDistribution.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.fill }} />
                  {s.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Uploads, quotations, and invoices</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentActivity.length === 0 ? (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              ) : (
                recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <ActivityDot type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{item.message}</p>
                      <p className="text-xs text-slate-500">{format(item.at, "dd MMM yyyy, HH:mm")}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--workshop-primary)] to-[var(--workshop-primary-dark)] px-6 py-5 text-white">
            <CardTitle className="text-lg text-white">Quick start</CardTitle>
            <CardDescription className="text-blue-100/90">
              Upload damage photos and let AI build your quotation instantly.
            </CardDescription>
            <Button
              onClick={onUpload}
              className="mt-4 bg-[var(--workshop-accent)] text-white hover:bg-orange-600 border-0"
            >
              <Upload className="mr-2 h-4 w-4" />
              New damage upload
            </Button>
          </div>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">
              Outstanding invoice value:{" "}
              <span className="font-semibold text-slate-900">NZD ${stats.outstandingAmount.toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Recent jobs</CardTitle>
            <CardDescription>Latest repair assessments and their status</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onViewQuotations}>
            View all
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet. Upload damage to create your first quotation.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--workshop-primary)]/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{job.vehicle}</p>
                      <p className="font-mono text-xs text-slate-500">{job.id.slice(0, 12)}</p>
                    </div>
                    <QuotationStatusBadge status={job.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{job.description}</p>
                  <p className="mt-2 text-xs text-slate-400">{format(job.createdAt, "dd MMM yyyy")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    quotation: "bg-[var(--workshop-primary)]",
    invoice: "bg-[var(--workshop-accent-green)]",
    ai: "bg-orange-500",
    user: "bg-slate-400",
    system: "bg-slate-300",
  };
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colors[type] ?? colors.system}`} />;
}

function buildMonthlySeries(timestamps: number[]) {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(format(d, "MMM yy"), 0);
  }
  timestamps.forEach((ts) => {
    const key = format(ts, "MMM yy");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
  return Array.from(buckets.entries()).map(([month, count]) => ({ month, count }));
}

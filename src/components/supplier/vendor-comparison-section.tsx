import { useEffect, useState } from "react";
import { ApiError } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trophy, TrendingDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchVendorComparisonQuotations,
  fetchVendorQuotationComparison,
  type VendorComparison,
  type VendorQuotationRequest,
} from "@/lib/api";
import { downloadVendorComparisonPdf } from "@/lib/pdf";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-slate-500",
  Sent: "bg-blue-600",
  Opened: "bg-amber-600",
  Responded: "bg-emerald-600",
  Expired: "bg-red-600",
};

export function SupplierVendorComparisonSection() {
  const [quotationId, setQuotationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<VendorComparison | null>(null);
  const [requests, setRequests] = useState<VendorQuotationRequest[]>([]);
  const [vehicle, setVehicle] = useState("");
  const [quotations, setQuotations] = useState<
    {
      id: string;
      vehicle: string;
      status: string;
      source: string;
      workshopName: string;
      createdAt: number;
    }[]
  >([]);

  useEffect(() => {
    fetchVendorComparisonQuotations()
      .then(setQuotations)
      .catch(() => toast.error("Failed to load quotations"));
  }, []);

  async function loadComparison(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchVendorQuotationComparison(id);
      setComparison(data.comparison);
      setRequests(data.requests);
      setVehicle(data.quotation.vehicle);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load comparison");
      setComparison(null);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (quotationId) loadComparison(quotationId);
  }, [quotationId]);

  function exportPdf() {
    if (!comparison || !quotationId) return;
    downloadVendorComparisonPdf({
      quotationId,
      vehicle,
      comparison,
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Vendor Quotation Comparison</CardTitle>
            <CardDescription>Compare vendor prices and find the best deal</CardDescription>
          </div>
          {comparison && comparison.respondedCount > 0 && (
            <Button variant="outline" onClick={exportPdf}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 max-w-md">
            <Label>Quotation</Label>
            <Select value={quotationId} onValueChange={setQuotationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select quotation to compare" />
              </SelectTrigger>
              <SelectContent>
                {quotations.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.id} — {q.vehicle}
                    {q.source === "SUPPLIER" ? " (Custom)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && <p className="text-slate-500">Loading comparison…</p>}

          {comparison && !loading && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  title="Responses"
                  value={`${comparison.respondedCount} / ${comparison.totalRequests}`}
                  icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
                />
                {comparison.recommendedVendor && (
                  <SummaryCard
                    title="Recommended Vendor"
                    value={comparison.recommendedVendor.vendorName}
                    sub={`NZD $${comparison.recommendedVendor.total.toFixed(2)} total`}
                    icon={<Trophy className="h-5 w-5 text-amber-500" />}
                    highlight
                  />
                )}
                <SummaryCard
                  title="Best Mix Total"
                  value={`NZD $${comparison.bestMixTotal.toFixed(2)}`}
                  sub="Lowest price per item combined"
                  icon={<TrendingDown className="h-5 w-5 text-emerald-600" />}
                />
                {comparison.savingsVsHighest > 0 && (
                  <SummaryCard
                    title="Savings vs Highest"
                    value={`NZD $${comparison.savingsVsHighest.toFixed(2)}`}
                    sub="Using recommended vendor"
                    icon={<TrendingDown className="h-5 w-5 text-emerald-600" />}
                  />
                )}
              </div>

              {comparison.items.length === 0 ? (
                <p className="text-slate-500">No vendor responses yet for this quotation.</p>
              ) : (
                <div className="space-y-6">
                  {comparison.items.map((item) => (
                    <Card key={item.partName} className="border-slate-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {item.partName}
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            ×{item.quantity}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {item.offers.map((o) => {
                            const isLowest = o.vendorId === item.lowestVendorId;
                            return (
                              <div
                                key={o.vendorId}
                                className={cn(
                                  "rounded-lg border p-3",
                                  isLowest && "border-emerald-500 bg-emerald-50",
                                )}
                              >
                                <p className="font-medium text-sm">{o.vendorName}</p>
                                <p
                                  className={cn(
                                    "text-lg font-semibold",
                                    isLowest && "text-emerald-700",
                                  )}
                                >
                                  NZD ${o.unitPrice.toFixed(2)}
                                </p>
                                {isLowest && (
                                  <Badge className="mt-1 bg-emerald-600">Lowest</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {item.lowestVendorName && (
                          <p className="mt-3 text-sm text-emerald-700">
                            Lowest: <strong>{item.lowestVendorName}</strong> at NZD $
                            {item.lowestPrice?.toFixed(2)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Vendor Totals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Total (NZD)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparison.vendorTotals.map((v) => {
                            const isRec =
                              comparison.recommendedVendor?.vendorId === v.vendorId;
                            return (
                              <TableRow
                                key={v.vendorId}
                                className={isRec ? "bg-amber-50" : undefined}
                              >
                                <TableCell>
                                  {v.vendorName}
                                  {isRec && (
                                    <Badge className="ml-2 bg-amber-500">Recommended</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  ${v.total.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-emerald-50">
                            <TableCell className="font-medium">Best item-by-item mix</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700">
                              ${comparison.bestMixTotal.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {requests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {requests.map((r) => (
                      <div key={r.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium">{r.vendorName}</span>
                          <Badge className={STATUS_COLORS[r.status] ?? "bg-slate-500"}>
                            {r.status}
                          </Badge>
                        </div>
                        <ul className="text-sm text-slate-600 space-y-1">
                          {(r.activities ?? []).slice(0, 5).map((a) => (
                            <li key={a.id}>
                              {new Date(a.createdAt).toLocaleString()} — {a.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  icon,
  highlight,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlight && "border-amber-300 bg-amber-50",
      )}
    >
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
        {icon}
        {title}
      </div>
      <p className="font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

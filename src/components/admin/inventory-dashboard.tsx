import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInventoryDashboard, ApiError, type InventoryDashboard } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Boxes, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

export function InventoryDashboardTab() {
  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchInventoryDashboard());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.items.filter((item) => {
      const matchAvail = availability === "all" || item.availability === availability;
      const matchSearch =
        !q ||
        item.partName.toLowerCase().includes(q) ||
        item.vehicleModel.toLowerCase().includes(q);
      return matchAvail && matchSearch;
    });
  }, [data, search, availability]);

  if (!data && loading) {
    return <p className="text-sm text-slate-500 py-8 text-center">Loading inventory…</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Total SKUs" value={data?.totalSkus ?? 0} />
        <StatCard icon={Boxes} label="In stock" value={data?.inStock ?? 0} tone="green" />
        <StatCard icon={AlertTriangle} label="Low stock" value={data?.lowStock ?? 0} tone="amber" />
        <StatCard icon={AlertTriangle} label="Out of stock" value={data?.outOfStock ?? 0} tone="red" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Inventory value</CardTitle>
            <CardDescription>
              Total on-hand value: NZD ${(data?.totalValue ?? 0).toLocaleString()}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search parts or models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={availability} onValueChange={setAvailability}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="ok">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock levels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.partName}</TableCell>
                  <TableCell>{item.vehicleModel}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>${item.price.toLocaleString()}</TableCell>
                  <TableCell>${item.value.toLocaleString()}</TableCell>
                  <TableCell>
                    <AvailabilityBadge availability={item.availability} />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No inventory matches your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "blue",
}: {
  icon: typeof Package;
  label: string;
  value: number;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "text-[var(--workshop-primary)] bg-blue-50",
    green: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AvailabilityBadge({ availability }: { availability: "ok" | "low" | "out" }) {
  const map = {
    ok: { label: "In stock", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    low: { label: "Low", className: "bg-amber-50 text-amber-800 border-amber-200" },
    out: { label: "Out", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const m = map[availability];
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}

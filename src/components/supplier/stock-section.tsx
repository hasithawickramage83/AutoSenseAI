import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";

export function SupplierStockSection() {
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
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Inventory &amp; stock alerts</CardTitle>
        <CardDescription>All available stock by vehicle model</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
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
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No stock items found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Vehicle model</TableHead>
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
                    {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
                  </TableCell>
                  <TableCell>{s.vehicleModel}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell>${s.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {s.quantity === 0 ? (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Out of stock
                      </Badge>
                    ) : s.quantity <= 2 ? (
                      <Badge className="bg-amber-100 text-amber-700">Low</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Available
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

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  fetchStock,
  fetchParts,
  createStock,
  updateStock,
  updatePart,
  deleteStock,
  ApiError,
  type ApiPart,
  type ApiStock,
} from "@/lib/api";
import { CatalogFilterBar, partVehicleLabel, type CatalogFilters } from "@/components/admin/catalog-filter-bar";
import {
  VehicleMakeModelFields,
  useVehicleCatalog,
} from "@/components/admin/vehicle-make-model-fields";

const PAGE_SIZE = 50;

const defaultFilters: CatalogFilters = {
  makeId: "all",
  vehicleModelId: "all",
  search: "",
};

export function StockSection() {
  const { makes, modelsByMake } = useVehicleCatalog();
  const [stock, setStock] = useState<ApiStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stockFilter, setStockFilter] = useState("all");

  const [partsWithoutStock, setPartsWithoutStock] = useState<ApiPart[]>([]);
  const [addPartId, setAddPartId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);

  const [editStock, setEditStock] = useState<ApiStock | null>(null);
  const [editMakeId, setEditMakeId] = useState("");
  const [editModelId, setEditModelId] = useState("");
  const [editPartName, setEditPartName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [filters.makeId, filters.vehicleModelId, debouncedSearch, stockFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStock({
        makeId: filters.makeId,
        vehicleModelId: filters.vehicleModelId,
        search: debouncedSearch,
        page,
        limit: PAGE_SIZE,
        availability: stockFilter === "all" ? undefined : (stockFilter as "ok" | "low" | "out"),
      });
      setStock(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [filters.makeId, filters.vehicleModelId, debouncedSearch, page, stockFilter]);

  const loadPartsWithoutStock = useCallback(async () => {
    try {
      const res = await fetchParts({
        makeId: filters.makeId,
        vehicleModelId: filters.vehicleModelId,
        search: debouncedSearch,
        hasStock: "false",
        page: 1,
        limit: 200,
      });
      setPartsWithoutStock(res.data);
      setAddPartId((prev) => prev || res.data[0]?.id || "");
    } catch {
      setPartsWithoutStock([]);
    }
  }, [filters.makeId, filters.vehicleModelId, debouncedSearch]);

  useEffect(() => {
    load();
    loadPartsWithoutStock();
  }, [load, loadPartsWithoutStock]);

  async function handleCreate() {
    if (!addPartId) {
      toast.error("Select a part");
      return;
    }
    try {
      await createStock({ partId: addPartId, quantity, price });
      toast.success("Stock created");
      setQuantity(0);
      setPrice(0);
      load();
      loadPartsWithoutStock();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create stock");
    }
  }

  function openEdit(row: ApiStock) {
    setEditStock({ ...row });
    setEditMakeId(String(row.part?.vehicleModel?.makeId ?? row.part?.vehicleModel?.make?.id ?? ""));
    setEditModelId(String(row.part?.vehicleModelId ?? ""));
    setEditPartName(row.part?.name ?? "");
  }

  async function handleUpdate() {
    if (!editStock?.part) return;
    try {
      if (editModelId && editModelId !== editStock.part.vehicleModelId) {
        await updatePart(editStock.part.id, {
          name: editPartName.trim() || editStock.part.name,
          vehicleModelId: editModelId,
        });
      } else if (editPartName.trim() && editPartName !== editStock.part.name) {
        await updatePart(editStock.part.id, { name: editPartName.trim() });
      }

      await updateStock(editStock.id, {
        quantity: editStock.quantity,
        price: editStock.price,
      });
      toast.success("Stock updated");
      setEditStock(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update stock");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteStock(deleteId);
      toast.success("Stock deleted");
      setDeleteId(null);
      load();
      loadPartsWithoutStock();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete stock");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Stock</CardTitle>
          <CardDescription>
            Create stock for parts without inventory (filtered by make / model / keyword)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Part</Label>
            {partsWithoutStock.length === 0 ? (
              <p className="pt-2 text-sm text-slate-500">No parts without stock for current filters</p>
            ) : (
              <Select value={addPartId || partsWithoutStock[0]?.id} onValueChange={setAddPartId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {partsWithoutStock.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({partVehicleLabel(p)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Price (NZD)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleCreate} disabled={partsWithoutStock.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add Stock
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stock Levels</CardTitle>
            <CardDescription>Filtered by vehicle catalog make, model, and keyword</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <CatalogFilterBar
            makes={makes}
            modelsByMake={modelsByMake}
            filters={filters}
            onFiltersChange={setFilters}
            searchPlaceholder="Search part, make, model…"
          />
          <div className="mb-4">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All availability</SelectItem>
                <SelectItem value="ok">In stock</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="out">Out of stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : stock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No stock matches your filters
                  </TableCell>
                </TableRow>
              ) : (
                stock.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.part?.name ?? "—"}</TableCell>
                    <TableCell>{s.part?.vehicleModel?.make?.name ?? "—"}</TableCell>
                    <TableCell>{s.part?.vehicleModel?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.quantity === 0 ? "destructive" : "secondary"}>
                        {s.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>${s.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              {total} stock record(s) · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editStock} onOpenChange={(open) => !open && setEditStock(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Stock</DialogTitle>
          </DialogHeader>
          {editStock && (
            <div className="grid gap-4 py-2">
              <VehicleMakeModelFields
                makeId={editMakeId}
                vehicleModelId={editModelId}
                onMakeIdChange={setEditMakeId}
                onVehicleModelIdChange={setEditModelId}
                required
              />
              <div className="grid gap-2">
                <Label>Part name</Label>
                <Input value={editPartName} onChange={(e) => setEditPartName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={editStock.quantity}
                  onChange={(e) =>
                    setEditStock({ ...editStock, quantity: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Price (NZD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editStock.price}
                  onChange={(e) => setEditStock({ ...editStock, price: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStock(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock record?</AlertDialogTitle>
            <AlertDialogDescription>The part will remain but have no stock entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

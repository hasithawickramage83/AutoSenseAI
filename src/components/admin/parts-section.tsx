import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  fetchParts,
  createPart,
  updatePart,
  deletePart,
  ApiError,
  type ApiPart,
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

export function PartsSection() {
  const { makes, modelsByMake } = useVehicleCatalog();
  const [parts, setParts] = useState<ApiPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [createMakeId, setCreateMakeId] = useState("");
  const [createModelId, setCreateModelId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editPart, setEditPart] = useState<ApiPart | null>(null);
  const [editMakeId, setEditMakeId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [filters.makeId, filters.vehicleModelId, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchParts({
        makeId: filters.makeId,
        vehicleModelId: filters.vehicleModelId,
        search: debouncedSearch,
        page,
        limit: PAGE_SIZE,
      });
      setParts(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load parts");
    } finally {
      setLoading(false);
    }
  }, [filters.makeId, filters.vehicleModelId, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!createMakeId && makes.length > 0) setCreateMakeId(makes[0].id);
  }, [makes, createMakeId]);

  async function handleCreate() {
    if (!name.trim() || !createModelId) {
      toast.error("Enter part name and select make + model");
      return;
    }
    try {
      await createPart({ name: name.trim(), description, vehicleModelId: createModelId });
      toast.success(`Created part: ${name.trim()}`);
      setName("");
      setDescription("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create part");
    }
  }

  function openEdit(part: ApiPart) {
    setEditPart({ ...part });
    setEditMakeId(String(part.vehicleModel?.makeId ?? part.vehicleModel?.make?.id ?? ""));
  }

  async function handleUpdate() {
    if (!editPart) return;
    try {
      await updatePart(editPart.id, {
        name: editPart.name,
        description: editPart.description ?? undefined,
        vehicleModelId: editPart.vehicleModelId,
      });
      toast.success("Part updated");
      setEditPart(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update part");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePart(deleteId);
      toast.success("Part deleted");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete part");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Part</CardTitle>
          <CardDescription>
            Parts are linked to makes and models from Vehicle Catalog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VehicleMakeModelFields
            makeId={createMakeId}
            vehicleModelId={createModelId}
            onMakeIdChange={setCreateMakeId}
            onVehicleModelIdChange={setCreateModelId}
            required
          />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Part name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Front Bumper"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={makes.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Parts</CardTitle>
            <CardDescription>Filter by make, model, or keyword — loaded from server</CardDescription>
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
            searchPlaceholder="Search part name, description, make, model…"
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Stock</TableHead>
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
              ) : parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No parts match your filters
                  </TableCell>
                </TableRow>
              ) : (
                parts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.vehicleModel?.make?.name ?? "—"}</TableCell>
                    <TableCell>{p.vehicleModel?.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-500">{p.description ?? "—"}</TableCell>
                    <TableCell>
                      {p.stocks.length > 0 ? (
                        <Badge variant="secondary">
                          {p.stocks[0].quantity} @ ${p.stocks[0].price}
                        </Badge>
                      ) : (
                        <Badge variant="outline">No stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}>
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
              {total} part(s) · showing page {page} of {totalPages}
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

      <Dialog open={!!editPart} onOpenChange={(open) => !open && setEditPart(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Part</DialogTitle>
          </DialogHeader>
          {editPart && (
            <div className="grid gap-4 py-2">
              <VehicleMakeModelFields
                makeId={editMakeId}
                vehicleModelId={editPart.vehicleModelId}
                onMakeIdChange={setEditMakeId}
                onVehicleModelIdChange={(vehicleModelId) =>
                  setEditPart({ ...editPart, vehicleModelId })
                }
                required
              />
              <div className="grid gap-2">
                <Label>Part name</Label>
                <Input
                  value={editPart.name}
                  onChange={(e) => setEditPart({ ...editPart, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={editPart.description ?? ""}
                  onChange={(e) => setEditPart({ ...editPart, description: e.target.value })}
                />
              </div>
              <p className="text-xs text-slate-500">
                Catalog: {partVehicleLabel(editPart)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPart(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete part?</AlertDialogTitle>
            <AlertDialogDescription>The part will be marked inactive.</AlertDialogDescription>
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

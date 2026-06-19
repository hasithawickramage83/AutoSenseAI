import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  fetchVehicleMakes,
  createVehicleMake,
  updateVehicleMake,
  deleteVehicleMake,
  fetchCatalogVehicleModels,
  createCatalogVehicleModel,
  updateCatalogVehicleModel,
  deleteCatalogVehicleModel,
  ApiError,
  type ApiVehicleMake,
  type ApiVehicleModel,
} from "@/lib/api";

export function VehicleCatalogTab() {
  return (
    <Tabs defaultValue="makes">
      <TabsList>
        <TabsTrigger value="makes">Vehicle Makes</TabsTrigger>
        <TabsTrigger value="models">Vehicle Models</TabsTrigger>
      </TabsList>
      <TabsContent value="makes">
        <VehicleMakesPanel />
      </TabsContent>
      <TabsContent value="models">
        <VehicleModelsPanel />
      </TabsContent>
    </Tabs>
  );
}

function VehicleMakesPanel() {
  const [makes, setMakes] = useState<ApiVehicleMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editMake, setEditMake] = useState<ApiVehicleMake | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return makes;
    return makes.filter((m) => m.name.toLowerCase().includes(q));
  }, [makes, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMakes(await fetchVehicleMakes());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load makes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Enter a make name");
      return;
    }
    try {
      const make = await createVehicleMake(name.trim());
      setMakes((prev) => [...prev, make].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      toast.success(`Added ${make.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add make");
    }
  }

  async function handleUpdate() {
    if (!editMake) return;
    try {
      const updated = await updateVehicleMake(editMake.id, editMake.name.trim());
      setMakes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditMake(null);
      toast.success("Make updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update make");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteVehicleMake(deleteId);
      setMakes((prev) => prev.filter((m) => m.id !== deleteId));
      toast.success("Make deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete make");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Vehicle Make</CardTitle>
          <CardDescription>e.g. Toyota, Nissan, Ford</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="max-w-sm"
            placeholder="Make name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Make
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vehicle Makes</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter makes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Make</TableHead>
                <TableHead>Models</TableHead>
                <TableHead>Vendors</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.modelCount ?? 0}</TableCell>
                  <TableCell>{m.vendorCount ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditMake({ ...m })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    No vehicle makes yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editMake} onOpenChange={(open) => !open && setEditMake(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Make</DialogTitle>
          </DialogHeader>
          <Input
            value={editMake?.name ?? ""}
            onChange={(e) => setEditMake((m) => (m ? { ...m, name: e.target.value } : m))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMake(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete make?</AlertDialogTitle>
            <AlertDialogDescription>
              Makes with linked models cannot be deleted.
            </AlertDialogDescription>
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

function VehicleModelsPanel() {
  const [makes, setMakes] = useState<ApiVehicleMake[]>([]);
  const [models, setModels] = useState<ApiVehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMakeId, setFilterMakeId] = useState("all");
  const [makeId, setMakeId] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editModel, setEditModel] = useState<ApiVehicleModel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [makeRows, modelRows] = await Promise.all([
        fetchVehicleMakes(),
        fetchCatalogVehicleModels(),
      ]);
      setMakes(makeRows);
      setModels(modelRows);
      if (!makeId && makeRows.length > 0) setMakeId(makeRows[0].id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, [makeId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return models.filter((m) => {
      const matchMake = filterMakeId === "all" || m.makeId === filterMakeId;
      const label = (m.fullName ?? m.name).toLowerCase();
      const matchSearch = !q || label.includes(q);
      return matchMake && matchSearch;
    });
  }, [models, search, filterMakeId]);

  async function handleCreate() {
    if (!makeId) {
      toast.error("Select a make first");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter a model name");
      return;
    }
    try {
      const model = await createCatalogVehicleModel({ makeId, name: name.trim() });
      setModels((prev) =>
        [...prev, model].sort((a, b) =>
          (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name),
        ),
      );
      setName("");
      toast.success(`Added ${model.fullName ?? model.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add model");
    }
  }

  async function handleUpdate() {
    if (!editModel) return;
    try {
      const updated = await updateCatalogVehicleModel(editModel.id, {
        makeId: editModel.makeId,
        name: editModel.name.trim(),
      });
      setModels((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditModel(null);
      toast.success("Model updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update model");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteCatalogVehicleModel(deleteId);
      setModels((prev) => prev.filter((m) => m.id !== deleteId));
      toast.success("Model deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete model");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Vehicle Model</CardTitle>
          <CardDescription>e.g. Corolla, Camry, Ranger</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-2">
            <Label>Make</Label>
            <Select value={makeId} onValueChange={setMakeId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select make" />
              </SelectTrigger>
              <SelectContent>
                {makes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 flex-1">
            <Label>Model</Label>
            <Input
              className="max-w-sm"
              placeholder="Model name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vehicle Models</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filter models…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMakeId} onValueChange={setFilterMakeId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All makes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All makes</SelectItem>
                {makes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Full name</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.make?.name ?? "—"}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.fullName ?? m.name}</Badge>
                  </TableCell>
                  <TableCell>{m._count?.parts ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditModel({ ...m })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No vehicle models yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editModel} onOpenChange={(open) => !open && setEditModel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Make</Label>
              <Select
                value={editModel?.makeId ?? ""}
                onValueChange={(v) =>
                  setEditModel((m) => (m ? { ...m, makeId: v } : m))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {makes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Model name</Label>
              <Input
                value={editModel?.name ?? ""}
                onChange={(e) =>
                  setEditModel((m) => (m ? { ...m, name: e.target.value } : m))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModel(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete model?</AlertDialogTitle>
            <AlertDialogDescription>
              Models with linked parts cannot be deleted.
            </AlertDialogDescription>
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

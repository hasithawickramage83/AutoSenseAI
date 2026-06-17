import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore, type Role, ApiError } from "../lib/store";
import { DashboardShell, normalizeHash } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Textarea } from "../components/ui/textarea";
import { Users, Package, Pencil, Trash2, Plus, RefreshCw, Search, LayoutDashboard, Building2 } from "lucide-react";
import { InventoryDashboardTab } from "@/components/admin/inventory-dashboard";
import { VendorsTab } from "@/components/admin/vendors-section";
import { toast } from "sonner";
import {
  fetchUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  fetchVehicleModels,
  createVehicleModel,
  updateVehicleModel,
  deleteVehicleModel,
  fetchParts,
  createPart,
  updatePart,
  deletePart,
  fetchStock,
  createStock,
  updateStock,
  upsertStockByPart,
  deleteStock,
  type ApiUser,
  type ApiVehicleModel,
  type ApiPart,
  type ApiStock,
} from "../lib/api";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminSection = "users" | "parts" | "inventory" | "vendors";
type PartTab = "models" | "parts" | "stock";

function hashKey(hash: string) {
  return normalizeHash(hash).replace(/^#/, "");
}

function parseAdminRoute(hash: string): { section: AdminSection; partTab: PartTab } {
  const key = hashKey(hash);
  if (key === "inventory") {
    return { section: "inventory", partTab: "stock" };
  }
  if (key === "vendors") {
    return { section: "vendors", partTab: "models" };
  }
  if (key === "parts" || key.startsWith("parts-")) {
    const partTab: PartTab =
      key === "parts-stock" ? "stock" : key === "parts-list" ? "parts" : "models";
    return { section: "parts", partTab };
  }
  return { section: "users", partTab: "models" };
}

const USERS_HASH = "users";

const PART_TAB_HASH: Record<PartTab, string> = {
  models: "parts-models",
  parts: "parts-list",
  stock: "parts-stock",
};

function AdminPage() {
  const navigate = useNavigate();
  const routerHash = useRouterState({ select: (s) => s.location.hash ?? "" });
  const [windowHash, setWindowHash] = useState(
    () => (typeof window !== "undefined" ? window.location.hash : ""),
  );

  useEffect(() => {
    const onHash = () => setWindowHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const effectiveHash = routerHash || windowHash;
  const { section, partTab } = parseAdminRoute(effectiveHash);

  return (
    <DashboardShell
      role="admin"
      title={
        section === "users"
          ? "User Management"
          : section === "inventory"
            ? "Inventory Dashboard"
            : section === "vendors"
              ? "Vendor Management"
              : "Part Management"
      }
      nav={[
        {
          label: "Users",
          to: "/admin",
          hash: USERS_HASH,
          section: "users",
          icon: <Users className="h-4 w-4" />,
          children: [{ label: "User Management", hash: USERS_HASH }],
        },
        {
          label: "Inventory",
          to: "/admin",
          hash: "inventory",
          section: "inventory",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Vendors",
          to: "/admin",
          hash: "vendors",
          section: "vendors",
          icon: <Building2 className="h-4 w-4" />,
        },
        {
          label: "Part Management",
          to: "/admin",
          hash: "parts-models",
          section: "parts",
          icon: <Package className="h-4 w-4" />,
          children: [
            { label: "Vehicle Models", hash: "parts-models" },
            { label: "Parts", hash: "parts-list" },
            { label: "Stock", hash: "parts-stock" },
          ],
        },
      ]}
    >
      {section === "users" ? (
        <UsersTab />
      ) : section === "inventory" ? (
        <InventoryDashboardTab />
      ) : section === "vendors" ? (
        <VendorsTab />
      ) : (
        <PartManagementTab
          tab={partTab}
          onTabChange={(tab) => navigate({ to: "/admin", hash: PART_TAB_HASH[tab] })}
        />
      )}
    </DashboardShell>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function UsersTab() {
  const { state, addLog } = useStore();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("workshop");
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchRole = roleFilter === "all" || u.role.toLowerCase() === roleFilter;
      const matchSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [users, search, roleFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!name || !email || !password) {
      toast.error("Enter name, email, and password");
      return;
    }
    try {
      const { user } = await createAdminUser({ name, email, password, role });
      setUsers((prev) => [user, ...prev]);
      addLog(`Admin created ${role} account ${email}`, "user");
      toast.success(`Created ${role}: ${email}`);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create user");
    }
  }

  async function handleUpdate() {
    if (!editUser) return;
    try {
      const payload: { name?: string; email?: string; role?: Role; password?: string } = {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role.toLowerCase() as Role,
      };
      const pwd = (document.getElementById("edit-password") as HTMLInputElement)?.value;
      if (pwd) payload.password = pwd;

      const { user } = await updateAdminUser(editUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      addLog(`Admin updated user ${user.email}`, "user");
      toast.success("User updated");
      setEditUser(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update user");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteAdminUser(deleteId);
      setUsers((prev) => prev.filter((u) => u.id !== deleteId));
      addLog(`Admin deleted user ${deleteId}`, "user");
      toast.success("User deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>Add a workshop, supplier, or admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{u.role.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditUser({ ...u })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={u.id === state.user?.id}
                      onClick={() => setDeleteId(u.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    {users.length === 0 ? "No users found" : "No users match your filters"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label>New password (leave blank to keep)</Label>
                <Input id="edit-password" type="password" />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={editUser.role.toLowerCase()}
                  onValueChange={(v) => setEditUser({ ...editUser, role: v.toUpperCase() as ApiUser["role"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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

// ─── Part Management ─────────────────────────────────────────────────────────

function PartManagementTab({
  tab,
  onTabChange,
}: {
  tab: PartTab;
  onTabChange: (tab: PartTab) => void;
}) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as PartTab)}>
      <TabsList className="mb-4">
        <TabsTrigger value="models">Vehicle Models</TabsTrigger>
        <TabsTrigger value="parts">Parts</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
      </TabsList>
      <TabsContent value="models"><VehicleModelsTab /></TabsContent>
      <TabsContent value="parts"><PartsTab /></TabsContent>
      <TabsContent value="stock"><StockTab /></TabsContent>
    </Tabs>
  );
}

function VehicleModelsTab() {
  const [models, setModels] = useState<ApiVehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editModel, setEditModel] = useState<ApiVehicleModel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredModels = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return models;
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModels(await fetchVehicleModels());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load vehicle models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Enter a model name");
      return;
    }
    try {
      const model = await createVehicleModel(name.trim());
      setModels((prev) => [...prev, model].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Created ${model.name}`);
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create model");
    }
  }

  async function handleUpdate() {
    if (!editModel) return;
    try {
      const updated = await updateVehicleModel(editModel.id, editModel.name.trim());
      setModels((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      toast.success("Vehicle model updated");
      setEditModel(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update model");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteVehicleModel(deleteId);
      setModels((prev) => prev.filter((m) => m.id !== deleteId));
      toast.success("Vehicle model deleted");
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
          <CardDescription>e.g. Toyota CHR, Honda Civic</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            className="max-w-sm"
            placeholder="Model name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vehicle Models</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m._count?.parts ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditModel({ ...m })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredModels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500">
                    {models.length === 0 ? "No vehicle models yet" : "No models match your filter"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editModel} onOpenChange={(open) => !open && setEditModel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Vehicle Model</DialogTitle></DialogHeader>
          {editModel && (
            <Input
              value={editModel.name}
              onChange={(e) => setEditModel({ ...editModel, name: e.target.value })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModel(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle model?</AlertDialogTitle>
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

function PartsTab() {
  const [parts, setParts] = useState<ApiPart[]>([]);
  const [models, setModels] = useState<ApiVehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vehicleModelId, setVehicleModelId] = useState("");
  const [editPart, setEditPart] = useState<ApiPart | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");

  const filteredParts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parts.filter((p) => {
      const matchModel =
        modelFilter === "all" || p.vehicleModelId === modelFilter;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.vehicleModel.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false);
      return matchModel && matchSearch;
    });
  }, [parts, search, modelFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partsData, modelsData] = await Promise.all([fetchParts(), fetchVehicleModels()]);
      setParts(partsData);
      setModels(modelsData);
      setVehicleModelId((prev) => prev || modelsData[0]?.id || "");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load parts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!name.trim() || !vehicleModelId) {
      toast.error("Enter part name and select a vehicle model");
      return;
    }
    try {
      const part = await createPart({ name: name.trim(), description, vehicleModelId });
      setParts((prev) => [...prev, part].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Created part: ${part.name}`);
      setName("");
      setDescription("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create part");
    }
  }

  async function handleUpdate() {
    if (!editPart) return;
    try {
      const updated = await updatePart(editPart.id, {
        name: editPart.name,
        description: editPart.description ?? undefined,
        vehicleModelId: editPart.vehicleModelId,
      });
      setParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast.success("Part updated");
      setEditPart(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update part");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePart(deleteId);
      setParts((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success("Part deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete part");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Part</CardTitle>
          <CardDescription>Link each part to a vehicle model</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Front Bumper" />
          </div>
          <div>
            <Label>Vehicle Model</Label>
            {models.length === 0 ? (
              <p className="text-sm text-slate-500 pt-2">Add a vehicle model first</p>
            ) : (
              <Select
                value={vehicleModelId || models[0].id}
                onValueChange={setVehicleModelId}
              >
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleCreate} disabled={models.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Part
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Parts</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search parts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {models.map((m) => (
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
                <TableHead>Name</TableHead>
                <TableHead>Vehicle Model</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.vehicleModel.name}</TableCell>
                  <TableCell className="text-slate-500">{p.description ?? "—"}</TableCell>
                  <TableCell>
                    {p.stocks.length > 0 ? (
                      <Badge variant="secondary">{p.stocks[0].quantity} @ ${p.stocks[0].price}</Badge>
                    ) : (
                      <Badge variant="outline">No stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditPart({ ...p })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredParts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {parts.length === 0 ? "No parts yet" : "No parts match your filters"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editPart} onOpenChange={(open) => !open && setEditPart(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Part</DialogTitle></DialogHeader>
          {editPart && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={editPart.name}
                  onChange={(e) => setEditPart({ ...editPart, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Vehicle Model</Label>
                <Select
                  value={editPart.vehicleModelId}
                  onValueChange={(v) => setEditPart({ ...editPart, vehicleModelId: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editPart.description ?? ""}
                  onChange={(e) => setEditPart({ ...editPart, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPart(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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

function StockTab() {
  const [stock, setStock] = useState<ApiStock[]>([]);
  const [parts, setParts] = useState<ApiPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [editStock, setEditStock] = useState<ApiStock | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const filteredStock = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stock.filter((s) => {
      const avail =
        s.quantity <= 0 ? "out" : s.quantity <= 2 ? "low" : "ok";
      const matchFilter = stockFilter === "all" || stockFilter === avail;
      const matchSearch =
        !q ||
        (s.part?.name ?? "").toLowerCase().includes(q) ||
        (s.part?.vehicleModel?.name ?? "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [stock, search, stockFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stockData, partsData] = await Promise.all([fetchStock(), fetchParts()]);
      setStock(stockData);
      setParts(partsData);
      const withoutStock = partsData.filter((p) => !p.stocks.length);
      setPartId((prev) => prev || withoutStock[0]?.id || "");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partsWithoutStock = parts.filter((p) => !p.stocks.length);

  async function handleCreate() {
    if (!partId) {
      toast.error("Select a part");
      return;
    }
    try {
      const row = await createStock({ partId, quantity, price });
      setStock((prev) => [...prev, row].sort((a, b) => (a.part?.name ?? "").localeCompare(b.part?.name ?? "")));
      setParts((prev) =>
        prev.map((p) => (p.id === partId ? { ...p, stocks: [row] } : p)),
      );
      toast.success("Stock created");
      setQuantity(0);
      setPrice(0);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create stock");
    }
  }

  async function handleUpdate() {
    if (!editStock) return;
    try {
      const updated = await updateStock(editStock.id, {
        quantity: editStock.quantity,
        price: editStock.price,
      });
      setStock((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Stock updated");
      setEditStock(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update stock");
    }
  }

  async function handleUpsert(partId: string, quantity: number, price: number) {
    try {
      const row = await upsertStockByPart({ partId, quantity, price });
      setStock((prev) => {
        const exists = prev.find((s) => s.partId === partId);
        if (exists) return prev.map((s) => (s.partId === partId ? row : s));
        return [...prev, row];
      });
      toast.success("Stock saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update stock");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteStock(deleteId);
      const removed = stock.find((s) => s.id === deleteId);
      setStock((prev) => prev.filter((s) => s.id !== deleteId));
      if (removed) {
        setParts((prev) =>
          prev.map((p) => (p.id === removed.partId ? { ...p, stocks: [] } : p)),
        );
      }
      toast.success("Stock deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete stock");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Stock</CardTitle>
          <CardDescription>Create stock for a part that has no stock record yet</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <Label>Part</Label>
            {partsWithoutStock.length === 0 ? (
              <p className="text-sm text-slate-500 pt-2">All parts already have stock</p>
            ) : (
              <Select
                value={partId || partsWithoutStock[0].id}
                onValueChange={setPartId}
              >
                <SelectTrigger><SelectValue placeholder="Select part" /></SelectTrigger>
                <SelectContent>
                  {partsWithoutStock.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.vehicleModel.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div>
            <Label>Price (NZD)</Label>
            <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleCreate} disabled={partsWithoutStock.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Stock
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Stock Levels</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search stock…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
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
                <TableHead>Vehicle Model</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.part?.name ?? "—"}</TableCell>
                  <TableCell>{s.part?.vehicleModel?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.quantity === 0 ? "destructive" : "secondary"}>{s.quantity}</Badge>
                  </TableCell>
                  <TableCell>${s.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditStock({ ...s })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredStock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {stock.length === 0 ? "No stock records yet" : "No stock matches your filters"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {parts.filter((p) => p.stocks.length > 0).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Update by Part</CardTitle>
            <CardDescription>Upsert quantity and price for any part</CardDescription>
          </CardHeader>
          <CardContent>
            <QuickStockUpdate parts={parts} onSave={handleUpsert} />
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editStock} onOpenChange={(open) => !open && setEditStock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stock — {editStock?.part?.name}</DialogTitle>
          </DialogHeader>
          {editStock && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={editStock.quantity}
                  onChange={(e) => setEditStock({ ...editStock, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
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
            <Button variant="outline" onClick={() => setEditStock(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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

function QuickStockUpdate({
  parts,
  onSave,
}: {
  parts: ApiPart[];
  onSave: (partId: string, quantity: number, price: number) => Promise<void>;
}) {
  const withStock = parts.filter((p) => p.stocks.length > 0);
  const [partId, setPartId] = useState(withStock[0]?.id ?? "");
  const selected = withStock.find((p) => p.id === partId);
  const [quantity, setQuantity] = useState(selected?.stocks[0]?.quantity ?? 0);
  const [price, setPrice] = useState(selected?.stocks[0]?.price ?? 0);

  useEffect(() => {
    const p = withStock.find((x) => x.id === partId);
    setQuantity(p?.stocks[0]?.quantity ?? 0);
    setPrice(p?.stocks[0]?.price ?? 0);
  }, [partId, withStock]);

  if (withStock.length === 0) return null;

  return (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <Label>Part</Label>
        <Select value={partId || withStock[0].id} onValueChange={setPartId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {withStock.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.vehicleModel.name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Quantity</Label>
        <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div>
        <Label>Price (NZD)</Label>
        <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      </div>
      <div className="flex items-end">
        <Button className="w-full" onClick={() => onSave(partId, quantity, price)}>
          Update Stock
        </Button>
      </div>
    </div>
  );
}

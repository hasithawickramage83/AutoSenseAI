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
import { Users, Package, Pencil, Trash2, Plus, RefreshCw, Search, LayoutDashboard, Building2, Car } from "lucide-react";
import { InventoryDashboardTab } from "@/components/admin/inventory-dashboard";
import { VendorsTab } from "@/components/admin/vendors-section";
import { VehicleCatalogTab } from "@/components/admin/vehicle-catalog-section";
import { PartsSection } from "@/components/admin/parts-section";
import { StockSection } from "@/components/admin/stock-section";
import { toast } from "sonner";
import {
  fetchUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type ApiUser,
} from "../lib/api";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminSection = "users" | "parts" | "inventory" | "vendors" | "vehicle-catalog";
type PartTab = "parts" | "stock";

function hashKey(hash: string) {
  return normalizeHash(hash).replace(/^#/, "");
}

function parseAdminRoute(hash: string): { section: AdminSection; partTab: PartTab } {
  const key = hashKey(hash);
  if (key === "inventory") {
    return { section: "inventory", partTab: "stock" };
  }
  if (key === "vendors") {
    return { section: "vendors", partTab: "parts" };
  }
  if (key === "vehicle-catalog") {
    return { section: "vehicle-catalog", partTab: "parts" };
  }
  if (key === "parts" || key.startsWith("parts-")) {
    if (key === "parts-models") {
      return { section: "parts", partTab: "parts" };
    }
    const partTab: PartTab = key === "parts-stock" ? "stock" : "parts";
    return { section: "parts", partTab };
  }
  return { section: "users", partTab: "parts" };
}

const USERS_HASH = "users";

const PART_TAB_HASH: Record<PartTab, string> = {
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
              : section === "vehicle-catalog"
                ? "Vehicle Catalog"
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
          label: "Vehicle Catalog",
          to: "/admin",
          hash: "vehicle-catalog",
          section: "vehicle-catalog",
          icon: <Car className="h-4 w-4" />,
        },
        {
          label: "Part Management",
          to: "/admin",
          hash: "parts-list",
          section: "parts",
          icon: <Package className="h-4 w-4" />,
          children: [
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
      ) : section === "vehicle-catalog" ? (
        <VehicleCatalogTab />
      ) : (
        <PartManagementTab
          tab={partTab}
          onTabChange={(tab) => navigate({ to: "/admin", hash: PART_TAB_HASH[tab] })}
        />
      )}
    </DashboardShell>
  );
}

// â”€â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                placeholder="Search name or emailâ€¦"
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
        <TabsTrigger value="parts">Parts</TabsTrigger>
        <TabsTrigger value="stock">Stock</TabsTrigger>
      </TabsList>
      <TabsContent value="parts">
        <PartsSection />
      </TabsContent>
      <TabsContent value="stock">
        <StockSection />
      </TabsContent>
    </Tabs>
  );
}

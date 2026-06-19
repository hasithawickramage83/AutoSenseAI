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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchVendors,
  fetchVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  fetchPublicVendorCatalog,
  ApiError,
  type ApiVendor,
} from "@/lib/api";
import { VendorCatalogPicker } from "@/components/admin/vendor-catalog-picker";

const emptyForm = {
  companyName: "",
  contactPerson: "",
  email: "",
  address: "",
  contactNumber: "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  makeIds: [] as string[],
  vehicleModelIds: [] as string[],
};

function vendorRegisterUrl() {
  if (typeof window === "undefined") return "/vendor-register";
  return `${window.location.origin}/vendor-register`;
}

export function VendorsTab() {
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [catalog, setCatalog] = useState<
    { id: string; name: string; models: { id: string; name: string; fullName?: string }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("companyName");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiVendor | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchPublicVendorCatalog();
      setCatalog(data.makes);
    } catch {
      // Admin may use catalog endpoint; public is fine without auth
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVendors({
        search,
        status: statusFilter,
        sort,
        order,
        page,
        limit: 10,
      });
      setVendors(res.data ?? []);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, order, page]);

  useEffect(() => {
    load();
    loadCatalog();
  }, [load, loadCatalog]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  async function openEdit(v: ApiVendor) {
    try {
      const full = await fetchVendor(v.id);
      setEditId(full.id);
      setForm({
        companyName: full.companyName,
        contactPerson: full.contactPerson,
        email: full.email,
        address: full.address,
        contactNumber: full.contactNumber,
        status: full.status,
        makeIds: (full.makes ?? []).map((m) => m.id),
        vehicleModelIds: (full.vehicleModels ?? []).map((m) => String(m.id)),
      });
      setFormOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load vendor");
    }
  }

  async function handleSave() {
    if (!form.companyName.trim() || !form.contactPerson.trim() || !form.email.trim()) {
      toast.error("Company name, contact person, and email are required");
      return;
    }
    if (form.makeIds.length === 0 && form.vehicleModelIds.length === 0) {
      toast.error("Select at least one vehicle make or model");
      return;
    }
    try {
      const payload = {
        companyName: form.companyName,
        contactPerson: form.contactPerson,
        email: form.email,
        address: form.address,
        contactNumber: form.contactNumber,
        status: form.status,
        makeIds: form.makeIds,
        vehicleModelIds: form.vehicleModelIds,
      };
      if (editId) {
        await updateVendor(editId, payload);
        toast.success("Vendor updated");
      } else {
        await createVendor(payload);
        toast.success("Vendor created");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteVendor(deleteId);
      toast.success("Vendor deleted");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function copyRegisterLink() {
    const url = vendorRegisterUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Registration link copied");
    } catch {
      toast.message("Registration link", { description: url });
    }
  }

  const statusBadge = useMemo(
    () => (status: string) =>
      status === "ACTIVE" ? (
        <Badge className="bg-emerald-600">Active</Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      ),
    [],
  );

  function catalogSummary(v: ApiVendor) {
    const makeCount = v.makes?.length ?? 0;
    const modelCount = v.vehicleModels?.length ?? 0;
    if (makeCount === 0 && modelCount === 0) return "—";
    const parts = [];
    if (makeCount > 0) parts.push(`${makeCount} make(s)`);
    if (modelCount > 0) parts.push(`${modelCount} model(s)`);
    return parts.join(", ");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Self-Registration</CardTitle>
          <CardDescription>
            Share this public link so vendors can register themselves with their vehicle makes and
            models.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
            <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{vendorRegisterUrl()}</span>
          </div>
          <Button variant="outline" onClick={copyRegisterLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Vendor Management</CardTitle>
            <CardDescription>Manage parts vendors for quotation requests</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search company, contact, email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="companyName">Company name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Select value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vehicle catalog</TableHead>
                  <TableHead>Status</TableHead>
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
                ) : vendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      No vendors found
                    </TableCell>
                  </TableRow>
                ) : (
                  vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.companyName}</TableCell>
                      <TableCell>{v.contactPerson}</TableCell>
                      <TableCell>{v.email}</TableCell>
                      <TableCell className="text-sm text-slate-600">{catalogSummary(v)}</TableCell>
                      <TableCell>{statusBadge(v.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(v)}>
                          View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(v.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{total} vendor(s)</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {page} of {totalPages || 1}
              </span>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Company Name</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Contact Number</Label>
              <Input
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as "ACTIVE" | "INACTIVE" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <VendorCatalogPicker
              makes={catalog}
              selection={{ makeIds: form.makeIds, vehicleModelIds: form.vehicleModelIds }}
              onChange={(selection) =>
                setForm((prev) => ({
                  ...prev,
                  makeIds: selection.makeIds,
                  vehicleModelIds: selection.vehicleModelIds,
                }))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.companyName}</DialogTitle>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Contact</dt>
                <dd>{detail.contactPerson}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd>{detail.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Phone</dt>
                <dd>{detail.contactNumber || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Address</dt>
                <dd className="mt-1">{detail.address || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>{statusBadge(detail.status)}</dd>
              </div>
              {(detail.makes?.length ?? 0) > 0 && (
                <div>
                  <dt className="mb-2 text-slate-500">Makes supplied</dt>
                  <dd className="flex flex-wrap gap-2">
                    {detail.makes!.map((m) => (
                      <Badge key={m.id} variant="outline">
                        {m.name}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
              {(detail.vehicleModels?.length ?? 0) > 0 && (
                <div>
                  <dt className="mb-2 text-slate-500">Models supplied</dt>
                  <dd className="flex flex-wrap gap-2">
                    {detail.vehicleModels!.map((m) => (
                      <Badge key={m.id}>{m.fullName ?? m.name}</Badge>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Vendors with active quotation requests cannot be deleted.
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

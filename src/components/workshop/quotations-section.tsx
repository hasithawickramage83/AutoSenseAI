import { useEffect, useMemo, useState } from "react";
import { useStore, type Quotation } from "@/lib/store";
import { updateWorkshopQuotation, deleteWorkshopQuotation, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuotationStatusBadge, SeverityBadge } from "./status-badge";
import { format } from "date-fns";
import { Pencil, Trash2, Search, Filter, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function severityFromPartCount(count: number): "Low" | "Medium" | "High" {
  return count >= 3 ? "High" : count === 2 ? "Medium" : "Low";
}

function EditQuotationDialog({
  quotation,
  open,
  onOpenChange,
  onSave,
}: {
  quotation: Quotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Quotation) => void;
}) {
  const [vehicle, setVehicle] = useState("");
  const [description, setDescription] = useState("");
  const [partsText, setPartsText] = useState("");

  useEffect(() => {
    if (!quotation) return;
    setVehicle(quotation.vehicle);
    setDescription(quotation.description);
    setPartsText(quotation.parts.map((p) => p.name).join(", "));
  }, [quotation]);

  function handleSave() {
    if (!quotation) return;
    const partNames = partsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (partNames.length === 0) {
      toast.error("Add at least one part");
      return;
    }
    const parts = partNames.map((name) => {
      const existing = quotation.parts.find((p) => p.name === name);
      return existing ?? { name, qty: 1, price: 0 };
    });
    const severity = severityFromPartCount(parts.length);
    onSave({
      ...quotation,
      vehicle,
      description,
      parts,
      damages: parts.map((p) => p.name.toLowerCase().replace(/ panel| assembly/g, "")),
      severity,
      labourCost: 350 + parts.length * 120,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit quotation</DialogTitle>
          <DialogDescription>
            Update details before the supplier processes this request. Only pending quotations can be edited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Parts (comma-separated)</Label>
            <Input value={partsText} onChange={(e) => setPartsText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationsSection() {
  const { state, addLog, refreshWorkshopData } = useStore();
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState<Quotation | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    return state.quotations.filter((q) => {
      const matchSearch =
        !search.trim() ||
        q.vehicle.toLowerCase().includes(search.toLowerCase()) ||
        q.id.toLowerCase().includes(search.toLowerCase()) ||
        q.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        q.status === statusFilter ||
        (statusFilter === "Pending" && q.status === "Processing");
      const matchDate =
        dateFilter === "all" ||
        (dateFilter === "7d" && now - q.createdAt < 7 * day) ||
        (dateFilter === "30d" && now - q.createdAt < 30 * day) ||
        (dateFilter === "90d" && now - q.createdAt < 90 * day);
      return matchSearch && matchStatus && matchDate;
    });
  }, [state.quotations, search, statusFilter, dateFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
    [filtered],
  );

  async function saveQuotation(updated: Quotation) {
    try {
      await updateWorkshopQuotation(updated.id, {
        vehicle: updated.vehicle,
        description: updated.description,
        parts: updated.parts,
      });
      await refreshWorkshopData();
      addLog(`Quotation ${updated.id} updated`, "user");
      toast.success("Quotation updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  async function deleteQuotation(id: string) {
    try {
      await deleteWorkshopQuotation(id);
      await refreshWorkshopData();
      addLog(`Quotation ${id} deleted`, "user");
      toast.success("Quotation deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by vehicle, ID, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Invoiced">Completed</SelectItem>
              <SelectItem value="PO Raised">PO Raised</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <EditQuotationDialog
        quotation={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={saveQuotation}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove quotation {deleting?.id}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleting && deleteQuotation(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No quotations match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sorted.map((q) => (
            <Card
              key={q.id}
              className={`border-slate-200/80 shadow-sm transition hover:shadow-md ${
                q.severity === "High" ? "border-l-4 border-l-red-400" : ""
              }`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{q.vehicle}</h3>
                      <QuotationStatusBadge status={q.status} />
                      <SeverityBadge severity={q.severity} />
                      {q.severity === "High" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="font-mono text-xs text-slate-500">{q.id}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{q.description}</p>
                    <p className="text-xs text-slate-400">{format(q.createdAt, "dd MMM yyyy, HH:mm")}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {q.parts.map((p) => (
                        <span
                          key={p.name}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {q.status === "Pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleting(q)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5 text-red-600" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

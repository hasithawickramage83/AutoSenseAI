import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type DamagePhoto, type Quotation } from "../lib/store";
import {
  analyzeDamagePreview,
  processDamage,
  updateWorkshopQuotation,
  deleteWorkshopQuotation,
  ApiError,
} from "../lib/api";
import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  LayoutDashboard,
  Upload,
  FileText,
  Receipt,
  History,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
});

type Tab = "dashboard" | "upload" | "quotations" | "invoices" | "history";

function WorkshopPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { refreshWorkshopData } = useStore();

  useEffect(() => {
    refreshWorkshopData();
  }, [refreshWorkshopData]);

  return (
    <DashboardShell
      role="workshop"
      title="Workshop Dashboard"
      nav={[
        { label: "Dashboard", to: "/workshop", icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: "New Damage Upload", to: "/workshop", icon: <Upload className="h-4 w-4" /> },
        { label: "Quotations", to: "/workshop", icon: <FileText className="h-4 w-4" /> },
        { label: "Invoices", to: "/workshop", icon: <Receipt className="h-4 w-4" /> },
        { label: "History", to: "/workshop", icon: <History className="h-4 w-4" /> },
      ]}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Overview</TabsTrigger>
          <TabsTrigger value="upload">New Damage Upload</TabsTrigger>
          <TabsTrigger value="quotations">My Quotations</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><Overview onUpload={() => setTab("upload")} /></TabsContent>
        <TabsContent value="upload"><DamageUpload onDone={() => setTab("quotations")} /></TabsContent>
        <TabsContent value="quotations"><Quotations /></TabsContent>
        <TabsContent value="invoices"><Invoices /></TabsContent>
        <TabsContent value="history"><HistoryView /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function Overview({ onUpload }: { onUpload: () => void }) {
  const { state } = useStore();
  const myQuotes = state.quotations;
  const pending = myQuotes.filter((q) => q.status === "Pending" || q.status === "Processing").length;
  const invoiced = myQuotes.filter((q) => q.status === "Invoiced").length;
  const totalInvoices = state.invoices.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Pending Quotations" value={pending} tone="amber" />
        <StatCard label="Invoiced Jobs" value={invoiced} tone="emerald" />
        <StatCard label="Total Invoiced (NZD)" value={`$${totalInvoices.toLocaleString()}`} tone="blue" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>Upload damage photos and let AutoSense AI quote it instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" /> New Damage Upload
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: "amber" | "emerald" | "blue" }) {
  const map = {
    amber: "from-amber-50 to-white border-amber-200 text-amber-700",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
    blue: "from-blue-50 to-white border-blue-200 text-blue-700",
  } as const;
  return (
    <div className={`rounded-lg border bg-gradient-to-br p-5 ${map[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-2 text-slate-900">{value}</div>
    </div>
  );
}

interface DamageReportView {
  parts: string[];
  damages: string[];
  recommendations: string[];
  severity: "Low" | "Medium" | "High";
  quotationId?: string;
}

function DamageUpload({ onDone }: { onDone: () => void }) {
  const { state, addLog, refreshWorkshopData } = useStore();
  const [photos, setPhotos] = useState<DamagePhoto[]>([]);
  const [vehicle, setVehicle] = useState("Toyota CHR");
  const [description, setDescription] = useState(
    "Front bumper smashed in motorway accident. Headlight cracked.",
  );
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DamageReportView | null>(null);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const quotationSavedRef = useRef(false);

  function togglePart(part: string) {
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }

  function severityFromCount(count: number): "Low" | "Medium" | "High" {
    return count >= 3 ? "High" : count === 2 ? "Medium" : "Low";
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6);
    let loaded = 0;
    setProgress(5);
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        loaded += 1;
        setPhotos((p) => [...p, { name: f.name, dataUrl: reader.result as string }]);
        setProgress(Math.round((loaded / arr.length) * 100));
      };
      reader.readAsDataURL(f);
    });
  }

  useEffect(() => {
    if (!description.trim() || !state.user) {
      setReport(null);
      setSelectedParts(new Set());
      quotationSavedRef.current = false;
      return;
    }
    if (quotationSavedRef.current) return;

    const timer = setTimeout(async () => {
      setScanning(true);
      try {
        const data = await analyzeDamagePreview({ vehicle, description });
        const parts = data.parts ?? [];
        setReport({
          parts,
          damages: data.damages,
          recommendations: data.recommendations,
          severity: data.severity as "Low" | "Medium" | "High",
        });
        setSelectedParts(new Set(parts));
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          const msg = err instanceof ApiError ? err.message : "Failed to scan damage";
          toast.error(msg);
        }
        setReport(null);
        setSelectedParts(new Set());
      } finally {
        setScanning(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [vehicle, description, state.user]);

  async function runAnalysis() {
    if (!description.trim()) {
      toast.error("Enter a damage description");
      return;
    }
    if (!state.user) {
      toast.error("Sign in to run analysis");
      return;
    }
    if (!report || report.parts.length === 0) {
      toast.error("No parts detected — update the description first");
      return;
    }
    if (selectedParts.size === 0) {
      toast.error("Select at least one part for the quotation");
      return;
    }
    setAnalyzing(true);
    addLog("AI started analyzing vehicle damage", "ai");
    try {
      const data = await processDamage({
        vehicle,
        description,
        selectedParts: Array.from(selectedParts),
      });
      const r: DamageReportView = {
        parts: data.quotation.parts.map((p) => p.name),
        damages: data.quotation.damages as string[],
        recommendations: data.quotation.recommendations as string[],
        severity: data.quotation.severity as "Low" | "Medium" | "High",
        quotationId: data.quotation.id,
      };
      setReport(r);
      setSelectedParts(new Set(r.parts));
      quotationSavedRef.current = true;
      await refreshWorkshopData();
      addLog(`Quotation submitted with ${selectedParts.size} part(s) (severity ${r.severity})`, "ai");
      toast.success("Quotation submitted — awaiting supplier processing");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Analysis failed";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  function viewQuotation() {
    if (!report?.quotationId) return;
    setPhotos([]);
    setReport(null);
    setSelectedParts(new Set());
    setProgress(0);
    quotationSavedRef.current = false;
    onDone();
  }

  const selectedReportItems = report
    ? report.parts
        .filter((p) => selectedParts.has(p))
        .map((part) => {
          const idx = report.parts.indexOf(part);
          return {
            part,
            damage: report.damages[idx] ?? part,
            recommendation: report.recommendations[idx] ?? `Replace ${part}`,
          };
        })
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New Damage Upload</CardTitle>
          <CardDescription>Drag &amp; drop photos and describe the damage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition"
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm text-slate-700 font-medium">Drag &amp; drop images</div>
            <div className="text-xs text-slate-500">or click to browse (front bumper, headlights, hood…)</div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>
          {progress > 0 && progress < 100 && <Progress value={progress} />}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative rounded-md overflow-hidden border border-slate-200 aspect-square">
                  <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" /> AI Damage Report
          </CardTitle>
          <CardDescription>Select parts to include, then run analysis to create the quotation</CardDescription>
        </CardHeader>
        <CardContent>
          {(scanning || analyzing) && (
            <div className="py-12 text-center text-slate-500">
              <div className="animate-pulse">
                {analyzing ? "Creating quotation from selected parts…" : "Scanning damage description…"}
              </div>
              <Progress value={analyzing ? 75 : 40} className="mt-4 animate-pulse" />
            </div>
          )}
          {!scanning && !analyzing && !report && (
            <div className="py-12 text-center text-slate-400 text-sm">
              Enter a damage description to see detected parts.
            </div>
          )}
          {!scanning && !analyzing && report && !report.quotationId && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Parts to Quote</div>
                  <span className="text-xs text-slate-500">
                    {selectedParts.size} of {report.parts.length} selected
                  </span>
                </div>
                {report.parts.length === 0 ? (
                  <p className="text-sm text-slate-400">No parts detected. Try a more detailed description.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.parts.map((part) => (
                      <li key={part} className="flex items-start gap-2">
                        <Checkbox
                          id={`part-${part}`}
                          checked={selectedParts.has(part)}
                          onCheckedChange={() => togglePart(part)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`part-${part}`}
                          className={`text-sm cursor-pointer select-none ${
                            selectedParts.has(part) ? "text-slate-800" : "text-slate-400 line-through"
                          }`}
                        >
                          {part}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Severity</span>
                {(() => {
                  const severity = severityFromCount(selectedParts.size);
                  return (
                    <Badge className={severity === "High" ? "bg-red-100 text-red-700" : severity === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                      {severity === "High" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {severity}
                    </Badge>
                  );
                })()}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Recommended Repairs</div>
                {selectedReportItems.length === 0 ? (
                  <p className="text-sm text-slate-400">Select parts above to include repairs in the quotation.</p>
                ) : (
                  <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
                    {selectedReportItems.map((item) => (
                      <li key={item.part}>{item.recommendation}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                onClick={runAnalysis}
                disabled={analyzing || selectedParts.size === 0 || report.parts.length === 0}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Run AI Analysis
              </Button>
            </div>
          )}
          {!scanning && !analyzing && report?.quotationId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm">Quotation saved with {report.parts.length} part(s).</span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Quoted Parts</div>
                <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
                  {report.parts.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ul>
              </div>
              <Button onClick={viewQuotation} className="w-full">
                View Saved Quotation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

function Quotations() {
  const { state, addLog, refreshWorkshopData } = useStore();
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    return {
      Pending: state.quotations.filter((q) => q.status === "Pending" || q.status === "Processing"),
      Approved: state.quotations.filter((q) => q.status === "Approved" || q.status === "PO Raised"),
      Invoiced: state.quotations.filter((q) => q.status === "Invoiced"),
    };
  }, [state.quotations]);

  async function saveQuotation(updated: Quotation) {
    setSaving(true);
    try {
      await updateWorkshopQuotation(updated.id, {
        vehicle: updated.vehicle,
        description: updated.description,
        parts: updated.parts,
      });
      await refreshWorkshopData();
      addLog(`Quotation ${updated.id.slice(0, 8)} updated`, "user");
      toast.success("Quotation updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuotation(id: string) {
    try {
      await deleteWorkshopQuotation(id);
      await refreshWorkshopData();
      addLog(`Quotation ${id.slice(0, 8)} deleted`, "user");
      toast.success("Quotation deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="grid gap-4">
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

      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-base">
              {key} ({grouped[key].length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {grouped[key].length === 0 ? (
              <div className="text-sm text-slate-400">No quotations.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    {key === "Pending" && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[key].map((q) => (
                    <TableRow
                      key={q.id}
                      className={q.severity === "High" ? "bg-red-50 hover:bg-red-100/70" : undefined}
                    >
                      <TableCell className="font-mono text-xs">{q.id}</TableCell>
                      <TableCell>{q.vehicle}</TableCell>
                      <TableCell>{q.parts.map((p) => p.name).join(", ")}</TableCell>
                      <TableCell>
                        {q.severity === "High" ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            High
                          </Badge>
                        ) : (
                          q.severity
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{q.status}</Badge>
                      </TableCell>
                      {key === "Pending" && (
                        <TableCell className="text-right">
                          {q.status === "Pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDeleting(q)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1 text-red-600" />
                                Delete
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Invoices() {
  const { state } = useStore();
  function downloadInvoice(invId: string) {
    const inv = state.invoices.find((i) => i.id === invId);
    if (!inv) return;
    const lines = [
      `AutoSense AI — Invoice ${inv.id}`,
      `Workshop: ${inv.workshopName}`,
      `Quotation: ${inv.quotationId}`,
      "",
      "Parts:",
      ...inv.parts.map((p) => `  ${p.name} x${p.qty} — NZD $${p.price}`),
      `Labour: NZD $${inv.labourCost}`,
      `Total: NZD $${inv.total}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Generated automatically by supplier AI</CardDescription>
      </CardHeader>
      <CardContent>
        {state.invoices.length === 0 ? (
          <div className="text-sm text-slate-400">No invoices yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Quotation</TableHead>
                <TableHead>Total (NZD)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.quotationId}</TableCell>
                  <TableCell>${inv.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => downloadInvoice(inv.id)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
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

function HistoryView() {
  const { state } = useStore();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {state.logs.slice(0, 50).map((l) => (
            <li key={l.id} className="flex items-start gap-2">
              {l.type === "ai" ? <Sparkles className="h-3.5 w-3.5 text-blue-600 mt-0.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 mt-0.5" />}
              <div>
                <div className="text-slate-800">{l.message}</div>
                <div className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

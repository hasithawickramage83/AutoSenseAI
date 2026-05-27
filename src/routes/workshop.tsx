import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useStore, uid, type DamagePhoto, type Quotation } from "../lib/store";
import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { LayoutDashboard, Upload, FileText, Receipt, History, Sparkles, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
});

type Tab = "dashboard" | "upload" | "quotations" | "invoices" | "history";

function WorkshopPage() {
  const [tab, setTab] = useState<Tab>("dashboard");

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

const AI_PART_POOL = [
  { name: "Front Bumper", recommend: "Replace front bumper" },
  { name: "Headlight Assembly", recommend: "Replace left headlight assembly" },
  { name: "Hood Panel", recommend: "Realign hood frame" },
  { name: "Side Mirror", recommend: "Replace side mirror" },
  { name: "Fender Panel", recommend: "Repair fender panel" },
  { name: "Tail Light", recommend: "Replace tail light" },
];

function analyzeDamage(photoCount: number, description: string) {
  const text = description.toLowerCase();
  const hits = new Set<number>();
  AI_PART_POOL.forEach((p, i) => {
    if (text.includes(p.name.toLowerCase().split(" ")[0])) hits.add(i);
  });
  while (hits.size < Math.min(3, Math.max(2, photoCount))) {
    hits.add(Math.floor(Math.random() * AI_PART_POOL.length));
  }
  const selected = Array.from(hits).map((i) => AI_PART_POOL[i]);
  const severity = selected.length >= 3 ? "High" : selected.length === 2 ? "Medium" : "Low";
  return {
    damages: selected.map((s) => s.recommend.replace(/^(Replace|Repair|Realign) /, "")),
    recommendations: selected.map((s) => s.recommend),
    parts: selected.map((s) => ({ name: s.name, qty: 1, price: 0 })),
    severity: severity as "Low" | "Medium" | "High",
  };
}

function DamageUpload({ onDone }: { onDone: () => void }) {
  const { state, setState, addLog } = useStore();
  const [photos, setPhotos] = useState<DamagePhoto[]>([]);
  const [vehicle, setVehicle] = useState("Toyota Corolla 2019 — Plate JKL456");
  const [description, setDescription] = useState(
    "Front bumper smashed in motorway accident. Headlight cracked. Hood appears misaligned.",
  );
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<ReturnType<typeof analyzeDamage> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function runAnalysis() {
    if (photos.length === 0 && !description.trim()) {
      toast.error("Add at least one photo or a description");
      return;
    }
    setAnalyzing(true);
    setReport(null);
    addLog("AI started analyzing vehicle damage", "ai");
    setTimeout(() => {
      const r = analyzeDamage(photos.length, description);
      setReport(r);
      setAnalyzing(false);
      addLog(`AI detected ${r.damages.length} damages (severity ${r.severity})`, "ai");
    }, 1600);
  }

  function generateQuotation() {
    if (!report || !state.user) return;
    const q: Quotation = {
      id: uid("Q"),
      workshopId: state.user.id,
      workshopName: state.user.name,
      vehicle,
      description,
      photos,
      damages: report.damages,
      severity: report.severity,
      recommendations: report.recommendations,
      parts: report.parts,
      labourCost: 350 + report.parts.length * 120,
      status: "Pending",
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, quotations: [q, ...s.quotations] }));
    addLog(`Quotation ${q.id} sent to supplier AI system`, "ai");
    toast.success("Your request has been sent to the supplier AI system.");
    setPhotos([]);
    setReport(null);
    setProgress(0);
    onDone();
  }

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
          <Button onClick={runAnalysis} disabled={analyzing} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {analyzing ? "AI is analyzing vehicle damage…" : "Run AI Analysis"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" /> AI Damage Report
          </CardTitle>
          <CardDescription>Detected damages, severity and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {analyzing && (
            <div className="py-12 text-center text-slate-500">
              <div className="animate-pulse">AI is analyzing vehicle damage…</div>
              <Progress value={60} className="mt-4 animate-pulse" />
            </div>
          )}
          {!analyzing && !report && (
            <div className="py-12 text-center text-slate-400 text-sm">Upload photos and run AI analysis to see results.</div>
          )}
          {report && (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Detected Damage</div>
                <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
                  {report.damages.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Severity</span>
                <Badge className={report.severity === "High" ? "bg-red-100 text-red-700" : report.severity === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                  {report.severity === "High" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {report.severity}
                </Badge>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Recommended Repairs</div>
                <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
                  {report.recommendations.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
              <Button onClick={generateQuotation} className="w-full">
                Generate Quotation Request
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Quotations() {
  const { state } = useStore();
  const grouped = useMemo(() => {
    return {
      Pending: state.quotations.filter((q) => q.status === "Pending" || q.status === "Processing"),
      Approved: state.quotations.filter((q) => q.status === "Approved" || q.status === "PO Raised"),
      Invoiced: state.quotations.filter((q) => q.status === "Invoiced"),
    };
  }, [state.quotations]);

  return (
    <div className="grid gap-4">
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-base">{key} ({grouped[key].length})</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[key].map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">{q.id}</TableCell>
                      <TableCell>{q.vehicle}</TableCell>
                      <TableCell>{q.parts.map((p) => p.name).join(", ")}</TableCell>
                      <TableCell>{q.severity}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{q.status}</Badge>
                      </TableCell>
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

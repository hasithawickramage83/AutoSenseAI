import { useEffect, useRef, useState } from "react";
import { useStore, type DamagePhoto } from "@/lib/store";
import { analyzeDamagePreview, processDamage, ApiError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { SeverityBadge } from "./status-badge";
import { QuotationStatusBadge } from "./status-badge";
import { format } from "date-fns";
import {
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Car,
  FileImage,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface DamageReportView {
  parts: string[];
  damages: string[];
  recommendations: string[];
  severity: "Low" | "Medium" | "High";
  quotationId?: string;
}

export function DamageUploadSection({ onDone }: { onDone: () => void }) {
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
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const quotationSavedRef = useRef(false);

  const previousUploads = [...state.quotations].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

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

  function removePhoto(index: number) {
    setPhotos((p) => p.filter((_, i) => i !== index));
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
      if (data.processing?.allInStock) {
        addLog(`Invoice ${data.processing.invoiceId ?? ""} sent automatically`, "system");
        toast.success("All parts in stock — invoice sent to your email and available under Invoices");
      } else if (data.processing) {
        toast.warning(
          `Stock shortage — invoice queued at supplier (${data.processing.purchaseOrderCount} purchase order(s) created)`,
        );
      } else {
        toast.success("Quotation submitted — supplier will process shortly");
      }
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileImage className="h-5 w-5 text-[var(--workshop-primary)]" />
              New damage upload
            </CardTitle>
            <CardDescription>Drag and drop photos, then describe the damage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Car className="h-4 w-4 text-[var(--workshop-primary)]" />
                Vehicle information
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle make / model</Label>
                <Input id="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="bg-white" />
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                onFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                dragActive
                  ? "border-[var(--workshop-accent)] bg-orange-50/50 scale-[1.01]"
                  : "border-slate-300 bg-white hover:border-[var(--workshop-primary)] hover:bg-blue-50/30"
              }`}
            >
              <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Drag & drop images here</p>
              <p className="mt-1 text-xs text-slate-500">or click to browse — up to 6 images</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </div>

            {progress > 0 && progress < 100 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                    <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(i);
                      }}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <MessageSquare className="h-4 w-4 text-[var(--workshop-primary)]" />
                Damage details & notes
              </div>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white resize-none"
                placeholder="Describe visible damage, location, and any notes for assessors…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[var(--workshop-accent)]" />
              AI damage report
            </CardTitle>
            <CardDescription>Select parts, then run analysis to create the quotation</CardDescription>
          </CardHeader>
          <CardContent>
            {(scanning || analyzing) && (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-[var(--workshop-primary)]/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-[var(--workshop-primary)]" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {analyzing ? "Creating quotation from selected parts…" : "Scanning damage description…"}
                </p>
                <Progress value={analyzing ? 75 : 40} className="mx-auto mt-4 max-w-xs animate-pulse" />
              </div>
            )}
            {!scanning && !analyzing && !report && (
              <div className="py-16 text-center text-sm text-slate-400">
                Enter a damage description to see detected parts.
              </div>
            )}
            {!scanning && !analyzing && report && !report.quotationId && (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parts to quote</span>
                    <span className="text-xs text-slate-500">
                      {selectedParts.size} of {report.parts.length} selected
                    </span>
                  </div>
                  {report.parts.length === 0 ? (
                    <p className="text-sm text-slate-400">No parts detected. Try a more detailed description.</p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-3">
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
                            className={`cursor-pointer select-none text-sm ${
                              selectedParts.has(part) ? "font-medium text-slate-800" : "text-slate-400 line-through"
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</span>
                  <SeverityBadge severity={severityFromCount(selectedParts.size)} />
                  {severityFromCount(selectedParts.size) === "High" && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended repairs</div>
                  {selectedReportItems.length === 0 ? (
                    <p className="text-sm text-slate-400">Select parts above to include repairs.</p>
                  ) : (
                    <ul className="list-inside list-disc space-y-1 text-sm text-slate-800">
                      {selectedReportItems.map((item) => (
                        <li key={item.part}>{item.recommendation}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button
                  onClick={runAnalysis}
                  disabled={analyzing || selectedParts.size === 0 || report.parts.length === 0}
                  className="w-full bg-[var(--workshop-primary)] hover:bg-[var(--workshop-primary-dark)]"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI analysis
                </Button>
              </div>
            )}
            {!scanning && !analyzing && report?.quotationId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">Quotation saved with {report.parts.length} part(s).</span>
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-800">
                  {report.parts.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ul>
                <Button onClick={viewQuotation} className="w-full">
                  View saved quotation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {previousUploads.length > 0 && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Previous damage reports</CardTitle>
            <CardDescription>Recently submitted assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {previousUploads.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-[var(--workshop-primary)]/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{q.vehicle}</p>
                    <QuotationStatusBadge status={q.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{q.description}</p>
                  <p className="mt-2 text-xs text-slate-400">{format(q.createdAt, "dd MMM yyyy, HH:mm")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

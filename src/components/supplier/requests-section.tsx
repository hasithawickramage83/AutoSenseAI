import { useState } from "react";
import { useStore, type Quotation } from "@/lib/store";
import { processSupplierQuotation, ApiError } from "@/lib/api";
import { downloadQuotationPdf } from "@/lib/pdf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QuotationDetailDialog } from "./detail-dialogs";
import { Sparkles, Download, Eye } from "lucide-react";
import { toast } from "sonner";

export function SupplierRequestsSection() {
  const { state, addLog, refreshSupplierData } = useStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);
  const incoming = state.quotations.filter(
    (q) => q.status === "Pending" || q.status === "Processing",
  );

  async function processRequest(q: Quotation) {
    setProcessing(q.id);
    addLog(`AI processing supplier request for ${q.id}`, "ai");
    try {
      const data = await processSupplierQuotation(q.id);
      await refreshSupplierData();
      if (data.invoice) {
        addLog(`AI generated invoice ${data.invoice.id} for ${q.id}`, "ai");
        toast.success(`Invoice ready for ${q.workshopName}`);
      }
      if (data.purchaseOrders.length > 0) {
        addLog(`AI created purchase order(s) due to stock shortage`, "ai");
        toast.warning(`Stock insufficient — Purchase order drafted`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Processing failed");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <>
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Incoming quotation requests</CardTitle>
        <CardDescription>
          New quotations are auto-processed on submit. Use manual process only if auto-processing failed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {incoming.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No incoming requests. Workshops submit damage reports to create quotations.
          </div>
        ) : (
          <div className="space-y-3">
            {incoming.map((q) => (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      Quotation from {q.workshopName}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      {q.id} · {q.vehicle}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{q.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.parts.map((p) => (
                        <Badge key={p.name} variant="secondary">
                          {p.name} ×{p.qty}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline">{q.severity} severity</Badge>
                      <Badge variant="outline">{q.status}</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewQuote(q)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadQuotationPdf({
                          id: q.id,
                          workshopName: q.workshopName,
                          vehicle: q.vehicle,
                          description: q.description,
                          parts: q.parts,
                          damages: q.damages,
                          recommendations: q.recommendations,
                          severity: q.severity,
                          labourCost: q.labourCost,
                          createdAt: q.createdAt,
                        })
                      }
                    >
                      <Download className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button onClick={() => processRequest(q)} disabled={processing === q.id}>
                      <Sparkles className="mr-1 h-4 w-4" />
                      {processing === q.id ? "Processing…" : "Process with AI"}
                    </Button>
                  </div>
                </div>
                {processing === q.id && <Progress value={70} className="mt-3 animate-pulse" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    <QuotationDetailDialog
      quotation={viewQuote}
      open={viewQuote !== null}
      onOpenChange={(o) => !o && setViewQuote(null)}
    />
    </>
  );
}

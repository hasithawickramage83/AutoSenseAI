import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import {
  fetchVendorResponseForm,
  submitVendorResponse,
  ApiError,
} from "@/lib/api";

export const Route = createFileRoute("/vendor-quotation-response/$token")({
  component: VendorQuotationResponsePage,
});

function VendorQuotationResponsePage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<{
    vendorName: string;
    vehicleNumber: string;
    quotationNumber: string;
    expiresAt: number;
    parts: { partName: string; quantity: number }[];
  } | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [deliveryTime, setDeliveryTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVendorResponseForm(token)
      .then((data) => {
        setForm(data);
        const init: Record<string, string> = {};
        data.parts.forEach((p) => {
          init[p.partName] = "";
        });
        setPrices(init);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Invalid or expired link");
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    for (const p of form.parts) {
      const val = Number(prices[p.partName]);
      if (!Number.isFinite(val) || val < 0) {
        setError(`Enter a valid price for ${p.partName}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitVendorResponse(token, {
        lineItems: form.parts.map((p) => ({
          partName: p.partName,
          unitPrice: Number(prices[p.partName]),
        })),
        estimatedDeliveryTime: deliveryTime,
        remarks,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f2847] to-slate-900">
      <header className="border-b border-white/10 bg-[#0a1628]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--workshop-accent)]">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white">Ceylon Automobile</p>
            <p className="text-xs text-slate-400">Vendor Quotation Response</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">Loading form…</CardContent>
          </Card>
        )}

        {error && !form && !loading && (
          <Card className="border-red-200">
            <CardContent className="flex items-center gap-3 py-8 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <p>{error}</p>
            </CardContent>
          </Card>
        )}

        {submitted && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <h2 className="text-xl font-semibold text-emerald-900">Quotation Submitted</h2>
              <p className="text-emerald-700">
                Thank you! Your quotation has been recorded successfully.
              </p>
            </CardContent>
          </Card>
        )}

        {form && !submitted && !loading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quotation Request Details</CardTitle>
                <CardDescription>
                  Please provide your best pricing for the parts listed below
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Vendor</span>
                  <p className="font-medium">{form.vendorName}</p>
                </div>
                <div>
                  <span className="text-slate-500">Vehicle No.</span>
                  <p className="font-medium">{form.vehicleNumber}</p>
                </div>
                <div>
                  <span className="text-slate-500">Quotation No.</span>
                  <p className="font-mono font-medium">{form.quotationNumber}</p>
                </div>
                <div>
                  <span className="text-slate-500">Valid until</span>
                  <p className="font-medium">{new Date(form.expiresAt).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Part Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="w-40">Unit Price (NZD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.parts.map((p) => (
                      <TableRow key={p.partName}>
                        <TableCell>{p.partName}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            placeholder="0.00"
                            value={prices[p.partName] ?? ""}
                            onChange={(e) =>
                              setPrices({ ...prices, [p.partName]: e.target.value })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 pt-6">
                <div className="grid gap-2">
                  <Label>Estimated Delivery Time</Label>
                  <Input
                    placeholder="e.g. 3–5 business days"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Optional notes about availability, warranty, etc."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-[var(--workshop-primary)] hover:bg-[var(--workshop-primary)]/90"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Quotation"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}

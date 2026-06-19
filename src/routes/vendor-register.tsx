import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchPublicVendorCatalog, registerVendorPublic, ApiError } from "@/lib/api";
import { VendorCatalogPicker } from "@/components/admin/vendor-catalog-picker";

export const Route = createFileRoute("/vendor-register")({
  component: VendorRegisterPage,
});

function VendorRegisterPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [catalog, setCatalog] = useState<
    { id: string; name: string; models: { id: string; name: string }[] }[]
  >([]);
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    address: "",
    contactNumber: "",
    makeIds: [] as string[],
    vehicleModelIds: [] as string[],
  });

  useEffect(() => {
    fetchPublicVendorCatalog()
      .then((data) => setCatalog(data.makes))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load vehicle catalog"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() || !form.contactPerson.trim() || !form.email.trim()) {
      setError("Company name, contact person, and email are required");
      return;
    }
    if (form.makeIds.length === 0 && form.vehicleModelIds.length === 0) {
      setError("Select at least one vehicle make or model you supply");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerVendorPublic(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-500">Loading registration form…</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h2 className="text-xl font-semibold">Registration submitted</h2>
            <p className="mt-2 text-slate-600">
              Thank you for registering. Our team will review your details and contact you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-slate-900 p-2 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendor Registration</h1>
            <p className="text-slate-600">Register as a parts supplier for AutoSenseAI</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>
              Tell us about your business and which vehicle makes and models you supply.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Company name *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact person *</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
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
                <Label>Contact number</Label>
                <Input
                  value={form.contactNumber}
                  onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                />
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

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit registration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

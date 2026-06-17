import { useEffect, useMemo, useState } from "react";
import { useStore, ApiError } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSupplierActiveVendors,
  sendVendorQuotationRequests,
  fetchVendorQuotationRequests,
  type VendorQuotationRequest,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-slate-500",
  Sent: "bg-blue-600",
  Opened: "bg-amber-600",
  Responded: "bg-emerald-600",
  Expired: "bg-red-600",
};

export function SupplierVendorRequestSection() {
  const { state, addLog } = useStore();
  const [vendors, setVendors] = useState<
    { id: string; companyName: string; contactPerson: string; email: string }[]
  >([]);
  const [quotationId, setQuotationId] = useState("");
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<VendorQuotationRequest[]>([]);

  const quotations = useMemo(
    () =>
      state.quotations.filter((q) =>
        ["Pending", "Processing", "PO Raised", "Invoiced"].includes(q.status),
      ),
    [state.quotations],
  );

  const selectedQuotation = useMemo(
    () => quotations.find((q) => q.id === quotationId),
    [quotations, quotationId],
  );

  const parts = useMemo(() => {
    if (!selectedQuotation) return [];
    return (selectedQuotation.parts ?? []).map((p) => ({
      name: p.name,
      qty: p.qty ?? 1,
    }));
  }, [selectedQuotation]);

  useEffect(() => {
    fetchSupplierActiveVendors()
      .then(setVendors)
      .catch(() => toast.error("Failed to load vendors"));
  }, []);

  useEffect(() => {
    if (quotationId) {
      fetchVendorQuotationRequests({ quotationId })
        .then((r) => setRequests(r.data))
        .catch(() => setRequests([]));
    } else {
      setRequests([]);
    }
  }, [quotationId, sending]);

  useEffect(() => {
    if (parts.length > 0) {
      setSelectedParts(new Set(parts.map((p) => p.name)));
    }
  }, [parts]);

  function togglePart(name: string) {
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!quotationId) {
      toast.error("Select a quotation");
      return;
    }
    if (selectedParts.size === 0) {
      toast.error("Select at least one part");
      return;
    }
    if (selectedVendors.size === 0) {
      toast.error("Select at least one vendor");
      return;
    }

    setSending(true);
    try {
      const partRows = parts
        .filter((p) => selectedParts.has(p.name))
        .map((p) => ({ partName: p.name, quantity: p.qty }));

      const res = await sendVendorQuotationRequests({
        quotationId,
        vendorIds: [...selectedVendors],
        parts: partRows,
      });

      toast.success(res.message);
      addLog(`Vendor quotation requests sent for ${quotationId}`, "system");
      setSelectedVendors(new Set());
      const updated = await fetchVendorQuotationRequests({ quotationId });
      setRequests(updated.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send requests");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Vendor Quotation Request</CardTitle>
          <CardDescription>
            Select parts and vendors to email secure quotation response links
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 max-w-md">
            <Label>Customer Quotation</Label>
            <Select value={quotationId} onValueChange={setQuotationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select quotation" />
              </SelectTrigger>
              <SelectContent>
                {quotations.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.id} — {q.vehicle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQuotation && (
            <>
              <div>
                <Label className="mb-3 block">Parts to quote</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {parts.map((p) => (
                    <label
                      key={p.name}
                      className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={selectedParts.has(p.name)}
                        onCheckedChange={() => togglePart(p.name)}
                      />
                      <span className="text-sm">
                        {p.name} <span className="text-slate-500">×{p.qty}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Select vendors</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((v) => (
                    <label
                      key={v.id}
                      className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-slate-50"
                    >
                      <Checkbox
                        className="mt-1"
                        checked={selectedVendors.has(v.id)}
                        onCheckedChange={() => toggleVendor(v.id)}
                      />
                      <div>
                        <p className="font-medium text-sm">{v.companyName}</p>
                        <p className="text-xs text-slate-500">{v.contactPerson}</p>
                        <p className="text-xs text-slate-400">{v.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending…" : "Send Quotation Requests"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Request Status — {quotationId}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Responded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.vendorName}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] ?? "bg-slate-500"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {r.respondedAt ? new Date(r.respondedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

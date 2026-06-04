import type { ReactNode } from "react";
import type { Invoice, PurchaseOrder, Quotation } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export function QuotationDetailDialog({
  quotation,
  open,
  onOpenChange,
}: {
  quotation: Quotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!quotation) return null;
  const partsTotal = quotation.parts.reduce((s, p) => s + p.price * p.qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quotation details</DialogTitle>
          <DialogDescription className="font-mono text-xs">{quotation.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <DetailRow label="Workshop" value={quotation.workshopName} />
          <DetailRow label="Vehicle" value={quotation.vehicle} />
          <DetailRow label="Status" value={<Badge variant="outline">{quotation.status}</Badge>} />
          <DetailRow label="Severity" value={quotation.severity} />
          <DetailRow label="Created" value={format(quotation.createdAt, "dd MMM yyyy, HH:mm")} />
          <DetailRow label="Labour (NZD)" value={`$${quotation.labourCost.toLocaleString()}`} />
          {quotation.invoiceId && <DetailRow label="Invoice ref" value={quotation.invoiceId} />}
          {quotation.poId && <DetailRow label="PO ref" value={quotation.poId} />}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p className="text-slate-800">{quotation.description}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parts</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.parts.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.qty}</TableCell>
                    <TableCell>${p.price.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Parts subtotal
                  </TableCell>
                  <TableCell>${partsTotal.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {quotation.damages?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Damages</p>
              <ul className="list-inside list-disc text-slate-700">
                {quotation.damages.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {quotation.recommendations?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</p>
              <ul className="list-inside list-disc text-slate-700">
                {quotation.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!invoice) return null;
  const partsTotal = invoice.parts.reduce((s, p) => s + p.price * p.qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice details</DialogTitle>
          <DialogDescription className="font-mono text-xs">{invoice.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <DetailRow label="Workshop" value={invoice.workshopName} />
          {invoice.vehicle && <DetailRow label="Vehicle" value={invoice.vehicle} />}
          <DetailRow label="Quotation ref" value={invoice.quotationId} />
          <DetailRow
            label="Status"
            value={
              <Badge variant="outline" className={invoice.status === "Sent" ? "border-emerald-300 text-emerald-800" : ""}>
                {invoice.status ?? "Draft"}
              </Badge>
            }
          />
          <DetailRow label="Created" value={format(invoice.createdAt, "dd MMM yyyy, HH:mm")} />
          <DetailRow label="Labour (NZD)" value={`$${invoice.labourCost.toLocaleString()}`} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.parts.map((p, i) => (
                  <TableRow key={`${p.name}-${i}`}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.qty}</TableCell>
                    <TableCell>${p.price.toLocaleString()}</TableCell>
                    <TableCell>${(p.price * p.qty).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Parts subtotal
                  </TableCell>
                  <TableCell>${partsTotal.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Labour
                  </TableCell>
                  <TableCell>${invoice.labourCost.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">
                    Total
                  </TableCell>
                  <TableCell className="font-bold">${invoice.total.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PurchaseOrderDetailDialog({
  purchaseOrder,
  open,
  onOpenChange,
}: {
  purchaseOrder: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!purchaseOrder) return null;
  const total = purchaseOrder.parts.reduce((s, p) => s + (p.price ?? 0) * p.qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase order details</DialogTitle>
          <DialogDescription className="font-mono text-xs">{purchaseOrder.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <DetailRow label="Workshop" value={purchaseOrder.workshopName ?? "—"} />
          {purchaseOrder.vehicle && <DetailRow label="Vehicle" value={purchaseOrder.vehicle} />}
          <DetailRow label="Quotation ref" value={purchaseOrder.quotationId} />
          <DetailRow label="Vendor email" value={purchaseOrder.vendorEmail} />
          <DetailRow label="Urgency" value={purchaseOrder.urgency} />
          <DetailRow label="Status" value={<Badge variant="outline">{purchaseOrder.status ?? "Draft"}</Badge>} />
          <DetailRow label="Created" value={format(purchaseOrder.createdAt, "dd MMM yyyy, HH:mm")} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parts</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.parts.map((p, i) => (
                  <TableRow key={p.id ?? i}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.qty}</TableCell>
                    <TableCell>${(p.price ?? 0).toLocaleString()}</TableCell>
                    <TableCell>${((p.price ?? 0) * p.qty).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">
                    Total
                  </TableCell>
                  <TableCell className="font-bold">${total.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

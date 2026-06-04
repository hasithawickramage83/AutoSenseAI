import { cn } from "@/lib/utils";

const quotationStyles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Processing: "bg-amber-50 text-amber-800 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "PO Raised": "bg-blue-50 text-blue-800 border-blue-200",
  Invoiced: "bg-[var(--workshop-primary)]/10 text-[var(--workshop-primary)] border-[var(--workshop-primary)]/20",
  Completed: "bg-[var(--workshop-primary)]/10 text-[var(--workshop-primary)] border-[var(--workshop-primary)]/20",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

const invoiceStyles: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Partially Paid": "bg-blue-50 text-blue-800 border-blue-200",
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  Overdue: "bg-red-50 text-red-700 border-red-200",
};

export function QuotationStatusBadge({ status }: { status: string }) {
  const label = status === "Invoiced" ? "Completed" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        quotationStyles[status === "Invoiced" ? "Completed" : status] ?? quotationStyles.Pending,
      )}
    >
      {label}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        invoiceStyles[status] ?? invoiceStyles.Pending,
      )}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "Low" | "Medium" | "High" }) {
  const styles = {
    Low: "bg-emerald-50 text-emerald-800 border-emerald-200",
    Medium: "bg-amber-50 text-amber-800 border-amber-200",
    High: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[severity])}>
      {severity}
    </span>
  );
}

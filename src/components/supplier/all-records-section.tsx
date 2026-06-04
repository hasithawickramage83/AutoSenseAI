import { SupplierRecordsBrowser } from "./records-browser";

export function SupplierAllQuotationsSection() {
  return <SupplierRecordsBrowser defaultTab="quotations" />;
}

export function SupplierAllInvoicesSection() {
  return <SupplierRecordsBrowser defaultTab="invoices" />;
}

export function SupplierAllPurchaseOrdersSection() {
  return <SupplierRecordsBrowser defaultTab="pos" />;
}

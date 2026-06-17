import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useStore } from "../lib/store";
import { DashboardShell, normalizeHash } from "../components/DashboardShell";
import { SupplierOverviewSection } from "@/components/supplier/overview-section";
import { SupplierRequestsSection } from "@/components/supplier/requests-section";
import { SupplierStockSection } from "@/components/supplier/stock-section";
import { SupplierInvoicesSection } from "@/components/supplier/invoices-section";
import { SupplierPurchaseOrdersSection } from "@/components/supplier/purchase-orders-section";
import {
  SupplierAllQuotationsSection,
  SupplierAllInvoicesSection,
  SupplierAllPurchaseOrdersSection,
} from "@/components/supplier/all-records-section";
import {
  LayoutDashboard,
  Inbox,
  Boxes,
  FileText,
  ShoppingCart,
  Send,
  GitCompare,
} from "lucide-react";
import { SupplierVendorRequestSection } from "@/components/supplier/vendor-request-section";
import { SupplierVendorComparisonSection } from "@/components/supplier/vendor-comparison-section";
import { SupplierCustomQuotationSection } from "@/components/supplier/custom-quotation-section";

export const Route = createFileRoute("/supplier")({
  component: SupplierPage,
});

type SupplierSection =
  | "dashboard"
  | "requests"
  | "quotations-all"
  | "stock"
  | "invoices"
  | "invoices-all"
  | "pos"
  | "pos-all"
  | "vendor-request"
  | "vendor-custom"
  | "vendor-comparison";

function parseSection(hash: string): SupplierSection {
  const key = normalizeHash(hash).replace(/^#/, "");
  if (key === "requests") return "requests";
  if (key === "quotations-all") return "quotations-all";
  if (key === "stock") return "stock";
  if (key === "invoices") return "invoices";
  if (key === "invoices-all") return "invoices-all";
  if (key === "pos") return "pos";
  if (key === "pos-all") return "pos-all";
  if (key === "vendor-request") return "vendor-request";
  if (key === "vendor-custom") return "vendor-custom";
  if (key === "vendor-comparison") return "vendor-comparison";
  return "dashboard";
}

const SECTION_HASH: Record<SupplierSection, string | undefined> = {
  dashboard: "dashboard",
  requests: "requests",
  "quotations-all": "quotations-all",
  stock: "stock",
  invoices: "invoices",
  "invoices-all": "invoices-all",
  pos: "pos",
  "pos-all": "pos-all",
  "vendor-request": "vendor-request",
  "vendor-custom": "vendor-custom",
  "vendor-comparison": "vendor-comparison",
};

const SECTION_TITLES: Record<SupplierSection, string> = {
  dashboard: "Dashboard",
  requests: "Incoming Requests",
  "quotations-all": "All Quotations",
  stock: "Stock Alerts",
  invoices: "Invoice Queue",
  "invoices-all": "All Invoices",
  pos: "Purchase Orders",
  "pos-all": "All Purchase Orders",
  "vendor-request": "Send Vendor Quotation",
  "vendor-custom": "Custom Quotation",
  "vendor-comparison": "Vendor Comparison",
};

function SupplierPage() {
  const { refreshSupplierData } = useStore();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const hash = routerState.location.hash ?? (typeof window !== "undefined" ? window.location.hash : "");
  const section = useMemo(() => parseSection(hash), [hash]);

  useEffect(() => {
    refreshSupplierData();
  }, [refreshSupplierData]);

  function goTo(s: SupplierSection) {
    navigate({ to: "/supplier", hash: SECTION_HASH[s] });
  }

  return (
    <DashboardShell
      role="supplier"
      title="Supplier Operations Center"
      pageTitle={SECTION_TITLES[section]}
      brandName="Parts Supply"
      brandSubtitle="Supplier portal"
      showSearch
      nav={[
        {
          label: "Dashboard",
          to: "/supplier",
          hash: "dashboard",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Quotations",
          to: "/supplier",
          hash: "requests",
          section: "quotations",
          icon: <Inbox className="h-4 w-4" />,
          children: [
            { label: "Incoming Requests", hash: "requests" },
            { label: "All Quotations", hash: "quotations-all" },
          ],
        },
        {
          label: "Inventory",
          to: "/supplier",
          hash: "stock",
          section: "supplier-inventory",
          icon: <Boxes className="h-4 w-4" />,
          children: [{ label: "Stock Alerts", hash: "stock" }],
        },
        {
          label: "Vendor Quotes",
          to: "/supplier",
          hash: "vendor-request",
          section: "vendor-quotes",
          icon: <Send className="h-4 w-4" />,
          children: [
            { label: "Send Request", hash: "vendor-request" },
            { label: "Custom Quotation", hash: "vendor-custom" },
            { label: "Compare & Summary", hash: "vendor-comparison" },
          ],
        },
        {
          label: "Billing",
          to: "/supplier",
          hash: "invoices",
          section: "billing",
          icon: <FileText className="h-4 w-4" />,
          children: [
            { label: "Invoice Queue", hash: "invoices" },
            { label: "All Invoices", hash: "invoices-all" },
            { label: "Purchase Orders", hash: "pos" },
            { label: "All Purchase Orders", hash: "pos-all" },
          ],
        },
      ]}
    >
      {section === "dashboard" && (
        <SupplierOverviewSection
          onViewRequests={() => goTo("requests")}
          onViewInvoices={() => goTo("invoices")}
          onViewStock={() => goTo("stock")}
          onViewAllQuotations={() => goTo("quotations-all")}
        />
      )}
      {section === "requests" && <SupplierRequestsSection />}
      {section === "quotations-all" && <SupplierAllQuotationsSection />}
      {section === "stock" && <SupplierStockSection />}
      {section === "invoices" && <SupplierInvoicesSection />}
      {section === "invoices-all" && <SupplierAllInvoicesSection />}
      {section === "pos" && <SupplierPurchaseOrdersSection />}
      {section === "pos-all" && <SupplierAllPurchaseOrdersSection />}
      {section === "vendor-request" && <SupplierVendorRequestSection />}
      {section === "vendor-custom" && <SupplierCustomQuotationSection />}
      {section === "vendor-comparison" && <SupplierVendorComparisonSection />}
    </DashboardShell>
  );
}

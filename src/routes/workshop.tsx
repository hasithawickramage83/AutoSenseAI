import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useStore } from "../lib/store";
import { DashboardShell, normalizeHash } from "../components/DashboardShell";
import { OverviewSection } from "@/components/workshop/overview-section";
import { DamageUploadSection } from "@/components/workshop/damage-upload-section";
import { QuotationsSection } from "@/components/workshop/quotations-section";
import { InvoicesSection } from "@/components/workshop/invoices-section";
import { HistorySection } from "@/components/workshop/history-section";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Receipt,
  History,
} from "lucide-react";

export const Route = createFileRoute("/workshop")({
  component: WorkshopPage,
});

type WorkshopSection = "dashboard" | "upload" | "quotations" | "invoices" | "history";

function parseSection(hash: string): WorkshopSection {
  const key = normalizeHash(hash).replace(/^#/, "");
  if (key === "upload") return "upload";
  if (key === "quotations") return "quotations";
  if (key === "invoices") return "invoices";
  if (key === "history") return "history";
  return "dashboard";
}

const SECTION_HASH: Record<WorkshopSection, string | undefined> = {
  dashboard: "dashboard",
  upload: "upload",
  quotations: "quotations",
  invoices: "invoices",
  history: "history",
};

const SECTION_TITLES: Record<WorkshopSection, string> = {
  dashboard: "Dashboard",
  upload: "New Damage Upload",
  quotations: "My Quotations",
  invoices: "Invoices",
  history: "History",
};

function WorkshopPage() {
  const { refreshWorkshopData } = useStore();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const hash = routerState.location.hash ?? (typeof window !== "undefined" ? window.location.hash : "");
  const section = useMemo(() => parseSection(hash), [hash]);

  useEffect(() => {
    refreshWorkshopData();
  }, [refreshWorkshopData]);

  function goTo(s: WorkshopSection) {
    const h = SECTION_HASH[s];
    navigate({ to: "/workshop", hash: h });
  }

  return (
    <DashboardShell
      role="workshop"
      title="Vehicle Workshop Repair Center"
      pageTitle={SECTION_TITLES[section]}
      brandName="Workshop Repair"
      brandSubtitle="Repair & assessment portal"
      showSearch
      nav={[
        { label: "Dashboard", to: "/workshop", hash: "dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: "New Damage Upload", to: "/workshop", hash: "upload", icon: <Upload className="h-4 w-4" /> },
        { label: "My Quotations", to: "/workshop", hash: "quotations", icon: <FileText className="h-4 w-4" /> },
        { label: "Invoices", to: "/workshop", hash: "invoices", icon: <Receipt className="h-4 w-4" /> },
        { label: "History", to: "/workshop", hash: "history", icon: <History className="h-4 w-4" /> },
      ]}
    >
      {section === "dashboard" && (
        <OverviewSection onUpload={() => goTo("upload")} onViewQuotations={() => goTo("quotations")} />
      )}
      {section === "upload" && <DamageUploadSection onDone={() => goTo("quotations")} />}
      {section === "quotations" && <QuotationsSection />}
      {section === "invoices" && <InvoicesSection />}
      {section === "history" && <HistorySection />}
    </DashboardShell>
  );
}

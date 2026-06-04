import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useStore, type Role } from "../lib/store";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Sparkles, LogOut, Bell } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  hash?: string;
  icon: ReactNode;
  section?: "users" | "parts";
  children?: { label: string; hash: string }[];
}

export function normalizeHash(hash?: string) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

function hashKey(hash?: string) {
  return normalizeHash(hash).replace(/^#/, "");
}

function isPartManagementSection(hash: string) {
  const key = hashKey(hash);
  return key === "parts" || key.startsWith("parts-");
}

function isUserManagementSection(hash: string) {
  const key = hashKey(hash);
  return key === "users" || key === "";
}

function isNavSectionActive(item: NavItem, hash: string) {
  if (item.section === "parts") return isPartManagementSection(hash);
  if (item.section === "users") return isUserManagementSection(hash);
  return false;
}

export function DashboardShell({
  role,
  title,
  nav,
  children,
}: {
  role: Role;
  title: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const { state, logout } = useStore();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const routerHash = routerState.location.hash ?? "";
  const windowHash = typeof window !== "undefined" ? window.location.hash : "";
  const currentHash = routerHash || windowHash;

  useEffect(() => {
    if (!state.user) {
      navigate({ to: "/" });
      return;
    }
    if (state.user.role !== role) {
      navigate({ to: `/${state.user.role}` });
    }
  }, [state.user, role, navigate]);

  if (!state.user) return null;

  const pending = state.quotations.filter((q) => q.status === "Pending" || q.status === "Processing").length;
  const aiJobs = state.logs.filter((l) => l.type === "ai").length;
  const invoiceAlerts = state.invoices.length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-semibold text-slate-900 leading-tight">AutoSense AI</div>
            <div className="text-xs text-slate-500 capitalize">{role} portal</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const itemKey = hashKey(item.hash);
            const currentKey = hashKey(currentHash);
            const isParentActive =
              routerState.location.pathname === item.to &&
              (itemKey
                ? item.children
                  ? isPartManagementSection(currentHash)
                  : currentKey === itemKey
                : !currentKey || currentKey === "");
            return (
              <div key={item.label}>
                <Link
                  to={item.to}
                  hash={item.children ? item.children[0]?.hash ?? item.hash : item.hash}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                    isParentActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
                {item.children && isParentActive && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
                    {item.children.map((child) => {
                      const childKey = hashKey(child.hash);
                      const isChildActive =
                        routerState.location.pathname === item.to &&
                        (currentKey === childKey ||
                          (childKey === "parts-models" && currentKey === "parts") ||
                          (childKey === "users" && currentKey === ""));
                      return (
                        <Link
                          key={child.hash}
                          to={item.to}
                          hash={child.hash}
                          className={`block px-3 py-1.5 rounded-md text-sm transition ${
                            isChildActive
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="text-xs text-slate-500 px-2 mb-1">Signed in as</div>
          <div className="px-2 mb-2">
            <div className="text-sm font-medium text-slate-900 truncate">{state.user.name}</div>
            <div className="text-xs text-slate-500 truncate">{state.user.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Bell className="h-3 w-3" /> {pending} pending
            </Badge>
            <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700">
              <Sparkles className="h-3 w-3" /> {aiJobs} AI jobs
            </Badge>
            <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700">
              {invoiceAlerts} invoices
            </Badge>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}

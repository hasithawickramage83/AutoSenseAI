import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useStore, type Role } from "../lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Bell,
  Menu,
  Search,
  ChevronLeft,
  ChevronRight,
  Wrench,
} from "lucide-react";

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

function isNavSectionActive(item: NavItem, hash: string, pathname: string) {
  if (item.hash) {
    const itemKey = hashKey(item.hash);
    const currentKey = hashKey(hash);
    if (pathname !== item.to) return false;
    if (itemKey === "dashboard" && (!currentKey || currentKey === "dashboard")) return true;
    return currentKey === itemKey;
  }
  if (item.section === "parts") return isPartManagementSection(hash);
  if (item.section === "users") return isUserManagementSection(hash);
  return pathname === item.to && (!hashKey(hash) || hashKey(hash) === "");
}

const ROLE_LABELS: Record<Role, string> = {
  workshop: "Workshop Manager",
  supplier: "Supplier Manager",
  admin: "System Administrator",
};

function SidebarNav({
  nav,
  currentHash,
  pathname,
  collapsed,
  onNavigate,
}: {
  nav: NavItem[];
  currentHash: string;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {nav.map((item) => {
        const active = isNavSectionActive(item, currentHash, pathname);
        return (
          <div key={item.label}>
            <Link
              to={item.to}
              hash={item.children ? item.children[0]?.hash ?? item.hash : item.hash}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-blue-100/90 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn("shrink-0", active && "text-[var(--workshop-accent)]")}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
            {item.children && active && !collapsed && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-white/20 pl-2">
                {item.children.map((child) => {
                  const childKey = hashKey(child.hash);
                  const currentKey = hashKey(currentHash);
                  const isChildActive =
                    pathname === item.to &&
                    (currentKey === childKey ||
                      (childKey === "parts-models" && currentKey === "parts") ||
                      (childKey === "users" && currentKey === ""));
                  return (
                    <Link
                      key={child.hash}
                      to={item.to}
                      hash={child.hash}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition",
                        isChildActive
                          ? "bg-white/15 font-medium text-white"
                          : "text-blue-100/80 hover:bg-white/10 hover:text-white",
                      )}
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
  );
}

export function DashboardShell({
  role,
  title,
  pageTitle,
  nav,
  children,
  showSearch = false,
  brandName = "Vehicle Workshop",
  brandSubtitle,
}: {
  role: Role;
  title: string;
  pageTitle?: string;
  nav: NavItem[];
  children: ReactNode;
  showSearch?: boolean;
  brandName?: string;
  brandSubtitle?: string;
}) {
  const { state, logout } = useStore();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const routerHash = routerState.location.hash ?? "";
  const windowHash = typeof window !== "undefined" ? window.location.hash : "";
  const currentHash = routerHash || windowHash;
  const pathname = routerState.location.pathname;
  const displayTitle = pageTitle ?? title;

  useEffect(() => {
    if (!state.user) {
      navigate({ to: "/" });
      return;
    }
    if (state.user.role !== role) {
      navigate({ to: `/${state.user.role}` });
    }
  }, [state.user, role, navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("workshop_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("workshop_sidebar_collapsed", String(next));
      return next;
    });
  }

  if (!state.user) return null;

  const pending = state.quotations.filter((q) => q.status === "Pending" || q.status === "Processing").length;
  const invoiceCount = state.invoices.length;

  const sidebarContent = (
    <>
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/10 px-4 py-5",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--workshop-accent)] shadow-lg">
          <Wrench className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight text-white">{brandName}</div>
            <div className="truncate text-xs text-blue-200/80">
              {brandSubtitle ?? `${role} portal`}
            </div>
          </div>
        )}
      </div>
      <SidebarNav
        nav={nav}
        currentHash={currentHash}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={() => setMobileOpen(false)}
      />
      <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
        {!collapsed && (
          <>
            <div className="mb-2 px-2 text-xs text-blue-200/70">Signed in as</div>
            <div className="mb-3 px-2">
              <div className="truncate text-sm font-medium text-white">{state.user.name}</div>
              <div className="truncate text-xs text-blue-200/70">{state.user.email}</div>
            </div>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white",
            collapsed && "px-2",
          )}
          onClick={() => {
            logout();
            navigate({ to: "/" });
          }}
        >
          <LogOut className={cn("h-3.5 w-3.5", !collapsed && "mr-1")} />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--workshop-surface)] flex">
      {!isMobile && (
        <aside
          className={cn(
            "sticky top-0 flex h-screen flex-col bg-gradient-to-b from-[var(--workshop-primary)] to-[var(--workshop-primary-dark)] transition-all duration-300 ease-in-out shrink-0",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          {sidebarContent}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </aside>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {isMobile && (
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 border-0 bg-gradient-to-b from-[var(--workshop-primary)] to-[var(--workshop-primary-dark)] p-0 text-white">
                    {sidebarContent}
                  </SheetContent>
                </Sheet>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{displayTitle}</h1>
                <p className="hidden text-xs text-slate-500 sm:block">{title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {showSearch && (
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search jobs, quotations…"
                    className="w-56 pl-9 lg:w-72"
                    readOnly
                    aria-label="Search"
                  />
                </div>
              )}
              <Badge variant="secondary" className="hidden gap-1 sm:flex bg-amber-50 text-amber-800 border-amber-200">
                <Bell className="h-3 w-3" />
                {pending} pending
              </Badge>
              <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
                <Bell className="h-5 w-5 text-slate-600" />
                {pending > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--workshop-accent)]" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden text-right sm:block rounded-lg px-3 py-1.5 transition hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      Welcome, {state.user.name}
                    </p>
                    <p className="text-xs text-[var(--workshop-primary)]">{ROLE_LABELS[role]}</p>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="font-medium">{state.user.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{state.user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    {invoiceCount} invoice{invoiceCount !== 1 ? "s" : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>{pending} pending quotation{pending !== 1 ? "s" : ""}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate({ to: "/" });
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--workshop-primary)] text-sm font-semibold text-white sm:hidden">
                {state.user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  apiUserToApp,
  fetchCurrentUser,
  fetchWorkshopHistory,
  fetchWorkshopInvoices,
  fetchWorkshopQuotations,
  fetchSupplierStock,
  fetchSupplierAllQuotations,
  fetchSupplierInvoices,
  fetchSupplierPurchaseOrders,
  getToken,
  loginUser,
  registerUser,
  setToken,
  ApiError,
} from "./api";

export type Role = "workshop" | "supplier" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DamagePhoto {
  name: string;
  dataUrl: string;
}

export interface Quotation {
  id: string;
  workshopId: string;
  workshopName: string;
  vehicle: string;
  description: string;
  photos: DamagePhoto[];
  damages: string[];
  severity: "Low" | "Medium" | "High";
  recommendations: string[];
  parts: { name: string; qty: number; price: number }[];
  labourCost: number;
  status: "Pending" | "Processing" | "Approved" | "Invoiced" | "PO Raised";
  createdAt: number;
  invoiceId?: string;
  poId?: string;
}

export interface Invoice {
  id: string;
  quotationId: string;
  workshopName: string;
  vehicle?: string;
  parts: { name: string; qty: number; price: number }[];
  labourCost: number;
  total: number;
  status?: string;
  createdAt: number;
}

export interface PurchaseOrder {
  id: string;
  quotationId: string;
  workshopName?: string;
  vehicle?: string;
  vendorEmail: string;
  parts: { id?: string; name: string; qty: number; price?: number }[];
  urgency: "Standard" | "Urgent" | "Critical";
  status?: string;
  createdAt: number;
}

export interface SupplierStockRow {
  id: string;
  partId: string;
  partName: string;
  vehicleModel: string;
  description: string | null;
  quantity: number;
  price: number;
}

export interface LogEntry {
  id: string;
  message: string;
  createdAt: number;
  type: "ai" | "system" | "user";
}

interface AppState {
  user: User | null;
  users: User[];
  quotations: Quotation[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  supplierStock: SupplierStockRow[];
  logs: LogEntry[];
  stock: Record<string, { qty: number; price: number }>;
  smtp: { host: string; port: number; from: string };
  authReady: boolean;
}

const DEFAULT_STOCK: Record<string, { qty: number; price: number }> = {
  "Front Bumper": { qty: 4, price: 890 },
  "Headlight Assembly": { qty: 2, price: 620 },
  "Hood Panel": { qty: 0, price: 1450 },
  "Side Mirror": { qty: 6, price: 240 },
  "Windshield": { qty: 3, price: 780 },
  "Fender Panel": { qty: 1, price: 540 },
  "Tail Light": { qty: 5, price: 310 },
  "Radiator": { qty: 0, price: 690 },
};

const STORAGE_KEY = "autosense_state_v1";

function loadState(): AppState {
  if (typeof window === "undefined") {
    return defaultState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, authReady: false };
    }
  } catch {}
  return defaultState();
}

function defaultState(): AppState {
  return {
    user: null,
    users: [],
    quotations: [],
    invoices: [],
    purchaseOrders: [],
    supplierStock: [],
    logs: [
      {
        id: "l0",
        message: "AutoSense AI Platform initialized",
        createdAt: Date.now(),
        type: "system",
      },
    ],
    stock: DEFAULT_STOCK,
    smtp: { host: "smtp.autosense.nz", port: 587, from: "noreply@autosense.nz" },
    authReady: false,
  };
}

interface StoreContext {
  state: AppState;
  setState: (updater: (s: AppState) => AppState) => void;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: Role) => Promise<User>;
  logout: () => void;
  addLog: (message: string, type?: LogEntry["type"]) => void;
  refreshWorkshopData: () => Promise<void>;
  refreshSupplierData: () => Promise<void>;
}

const Ctx = createContext<StoreContext | null>(null);

function upsertUser(users: User[], user: User): User[] {
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    const next = [...users];
    next[idx] = user;
    return next;
  }
  return [...users, user];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => loadState());

  useEffect(() => {
    try {
      const { authReady: _authReady, ...persisted } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {}
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getToken();
      if (!token) {
        if (!cancelled) setStateRaw((s) => ({ ...s, user: null, authReady: true }));
        return;
      }
      try {
        const { user } = await fetchCurrentUser();
        const appUser = apiUserToApp(user);
        if (!cancelled) {
          setStateRaw((s) => ({
            ...s,
            user: appUser,
            users: upsertUser(s.users, appUser),
            authReady: true,
          }));
        }
      } catch {
        setToken(null);
        if (!cancelled) {
          setStateRaw((s) => ({ ...s, user: null, authReady: true }));
        }
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const setState = (updater: (s: AppState) => AppState) =>
    setStateRaw((prev) => updater(prev));

  const login = async (email: string, password: string) => {
    const { token, user } = await loginUser(email, password);
    setToken(token);
    const appUser = apiUserToApp(user);
    setState((s) => ({
      ...s,
      user: appUser,
      users: upsertUser(s.users, appUser),
    }));
    if (appUser.role === "workshop") {
      try {
        const [quotations, invoices, history] = await Promise.all([
          fetchWorkshopQuotations(),
          fetchWorkshopInvoices(),
          fetchWorkshopHistory(),
        ]);
        setState((s) => ({
          ...s,
          quotations: quotations.map((q) => ({
            ...q,
            status: q.status as Quotation["status"],
            severity: q.severity as Quotation["severity"],
            recommendations: q.recommendations ?? [],
          })),
          invoices,
          logs: history.length > 0 ? history : s.logs,
        }));
      } catch {
        // ignore — user can refresh from workshop page
      }
    }
    if (appUser.role === "supplier") {
      try {
        await refreshSupplierDataInternal(setState);
      } catch {
        // ignore
      }
    }
    return appUser;
  };

  const register = async (name: string, email: string, password: string, role: Role) => {
    const { user } = await registerUser({ name, email, password, role });
    const appUser = apiUserToApp(user);
    setState((s) => ({
      ...s,
      users: upsertUser(s.users, appUser),
    }));
    return appUser;
  };

  const logout = () => {
    setToken(null);
    setState((s) => ({ ...s, user: null }));
  };

  const addLog: StoreContext["addLog"] = (message, type = "system") =>
    setState((s) => ({
      ...s,
      logs: [
        { id: `l${Date.now()}-${Math.random()}`, message, type, createdAt: Date.now() },
        ...s.logs,
      ].slice(0, 200),
    }));

  const refreshWorkshopData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [quotations, invoices, history] = await Promise.all([
        fetchWorkshopQuotations(),
        fetchWorkshopInvoices(),
        fetchWorkshopHistory(),
      ]);
      setStateRaw((s) => ({
        ...s,
        quotations: quotations.map((q) => ({
          ...q,
          status: q.status as Quotation["status"],
          severity: q.severity as Quotation["severity"],
          recommendations: q.recommendations ?? [],
        })),
        invoices,
        logs: history.length > 0 ? history : s.logs,
      }));
    } catch {
      // workshop endpoints unavailable — keep local state
    }
  }, []);

  async function refreshSupplierDataInternal(
    setter: (updater: (s: AppState) => AppState) => void,
  ) {
    const [stock, quotations, invoices, purchaseOrders] = await Promise.all([
      fetchSupplierStock(),
      fetchSupplierAllQuotations(),
      fetchSupplierInvoices(),
      fetchSupplierPurchaseOrders(),
    ]);
    setter((s) => ({
      ...s,
      supplierStock: stock,
      quotations: quotations.map((q) => ({
        ...q,
        photos: [],
        status: q.status as Quotation["status"],
        severity: q.severity as Quotation["severity"],
        recommendations: q.recommendations ?? [],
      })),
      invoices: invoices.map((i) => ({
        ...i,
        parts: i.parts,
      })),
      purchaseOrders: purchaseOrders.map((po) => ({
        ...po,
        urgency: po.urgency as PurchaseOrder["urgency"],
      })),
    }));
  }

  const refreshSupplierData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      await refreshSupplierDataInternal(setStateRaw);
    } catch {
      // supplier endpoints unavailable
    }
  }, []);

  return (
    <Ctx.Provider value={{ state, setState, login, register, logout, addLog, refreshWorkshopData, refreshSupplierData }}>{children}</Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export { ApiError };

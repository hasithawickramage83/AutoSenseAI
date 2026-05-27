import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  parts: { name: string; qty: number; price: number }[];
  labourCost: number;
  total: number;
  createdAt: number;
}

export interface PurchaseOrder {
  id: string;
  quotationId: string;
  vendorEmail: string;
  parts: { name: string; qty: number }[];
  urgency: "Standard" | "Urgent" | "Critical";
  createdAt: number;
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
  logs: LogEntry[];
  stock: Record<string, { qty: number; price: number }>;
  smtp: { host: string; port: number; from: string };
}

const DEFAULT_USERS: User[] = [
  { id: "w1", email: "workshop@autosense.nz", name: "Auckland Auto Repairs", role: "workshop" },
  { id: "s1", email: "supplier@autosense.nz", name: "NZ Parts Central", role: "supplier" },
  { id: "a1", email: "admin@autosense.nz", name: "System Admin", role: "admin" },
];

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
      return { ...defaultState(), ...parsed };
    }
  } catch {}
  return defaultState();
}

function defaultState(): AppState {
  return {
    user: null,
    users: DEFAULT_USERS,
    quotations: [],
    invoices: [],
    purchaseOrders: [],
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
  };
}

interface StoreContext {
  state: AppState;
  setState: (updater: (s: AppState) => AppState) => void;
  login: (email: string, role: Role) => User | null;
  logout: () => void;
  addLog: (message: string, type?: LogEntry["type"]) => void;
}

const Ctx = createContext<StoreContext | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => loadState());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const setState = (updater: (s: AppState) => AppState) =>
    setStateRaw((prev) => updater(prev));

  const login = (email: string, role: Role) => {
    const existing = state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role,
    );
    const user: User =
      existing ?? {
        id: `u${Date.now()}`,
        email,
        name: email.split("@")[0],
        role,
      };
    setState((s) => ({
      ...s,
      user,
      users: existing ? s.users : [...s.users, user],
    }));
    return user;
  };

  const logout = () => setState((s) => ({ ...s, user: null }));

  const addLog: StoreContext["addLog"] = (message, type = "system") =>
    setState((s) => ({
      ...s,
      logs: [
        { id: `l${Date.now()}-${Math.random()}`, message, type, createdAt: Date.now() },
        ...s.logs,
      ].slice(0, 200),
    }));

  return (
    <Ctx.Provider value={{ state, setState, login, logout, addLog }}>{children}</Ctx.Provider>
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

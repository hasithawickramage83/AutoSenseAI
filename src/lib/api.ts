import type { Role } from "./store";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const TOKEN_KEY = "autosense_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiUserRole = "ADMIN" | "WORKSHOP" | "SUPPLIER";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: ApiUserRole;
  createdAt?: string;
}

export function apiRoleToApp(role: ApiUserRole): Role {
  const map: Record<ApiUserRole, Role> = {
    WORKSHOP: "workshop",
    SUPPLIER: "supplier",
    ADMIN: "admin",
  };
  return map[role];
}

export function appRoleToApi(role: Role): ApiUserRole {
  const map: Record<Role, ApiUserRole> = {
    workshop: "WORKSHOP",
    supplier: "SUPPLIER",
    admin: "ADMIN",
  };
  return map[role];
}

export function apiUserToApp(user: ApiUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: apiRoleToApp(user.role),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };

  if (!res.ok) {
    const msg =
      (data as { message?: string }).message ??
      (data as { error?: string }).error ??
      res.statusText;
    throw new ApiError(msg, res.status);
  }
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  return request<{ message: string; user: ApiUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: appRoleToApi(payload.role),
    }),
  });
}

export async function loginUser(email: string, password: string) {
  return request<{ message: string; token: string; user: ApiUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser() {
  return request<{ user: ApiUser }>("/api/auth/me");
}

// ─── Admin: Users ────────────────────────────────────────────────────────────

export async function fetchUsers() {
  return request<ApiUser[]>("/api/admin/users");
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  return request<{ message: string; user: ApiUser }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: appRoleToApi(payload.role),
    }),
  });
}

export async function updateAdminUser(
  id: string,
  payload: { name?: string; email?: string; password?: string; role?: Role },
) {
  return request<{ message: string; user: ApiUser }>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      role: payload.role ? appRoleToApi(payload.role) : undefined,
    }),
  });
}

export async function deleteAdminUser(id: string) {
  return request<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" });
}

// ─── Admin: Vehicle Models ───────────────────────────────────────────────────

export interface ApiVehicleModel {
  id: string;
  name: string;
  _count?: { parts: number };
}

export async function fetchVehicleModels() {
  return request<ApiVehicleModel[]>("/api/admin/vehicle-models");
}

export async function createVehicleModel(name: string) {
  return request<ApiVehicleModel>("/api/admin/vehicle-models", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateVehicleModel(id: string, name: string) {
  return request<ApiVehicleModel>(`/api/admin/vehicle-models/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteVehicleModel(id: string) {
  return request<{ message: string }>(`/api/admin/vehicle-models/${id}`, { method: "DELETE" });
}

// ─── Admin: Parts ────────────────────────────────────────────────────────────

export interface ApiPart {
  id: string;
  name: string;
  description: string | null;
  activeStatus: number;
  vehicleModelId: string;
  vehicleModel: ApiVehicleModel;
  stocks: ApiStock[];
}

export async function fetchParts() {
  return request<ApiPart[]>("/api/admin/parts");
}

export async function createPart(payload: {
  name: string;
  description?: string;
  vehicleModelId: string;
}) {
  return request<ApiPart>("/api/admin/part", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePart(
  id: string,
  payload: { name?: string; description?: string; vehicleModelId?: string },
) {
  return request<ApiPart>(`/api/admin/parts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePart(id: string) {
  return request<{ message: string; part: ApiPart }>(`/api/admin/parts/${id}`, {
    method: "DELETE",
  });
}

// ─── Admin: Stock ────────────────────────────────────────────────────────────

export interface ApiStock {
  id: string;
  quantity: number;
  price: number;
  partId: string;
  part?: ApiPart & { vehicleModel?: ApiVehicleModel };
}

export async function fetchStock() {
  return request<ApiStock[]>("/api/admin/stock");
}

export async function createStock(payload: { partId: string; quantity: number; price: number }) {
  return request<ApiStock>("/api/admin/stock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStock(id: string, payload: { quantity?: number; price?: number }) {
  return request<ApiStock>(`/api/admin/stock/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function upsertStockByPart(payload: { partId: string; quantity: number; price: number }) {
  return request<ApiStock>("/api/admin/stock/by-part", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStock(id: string) {
  return request<{ message: string }>(`/api/admin/stock/${id}`, { method: "DELETE" });
}

// ─── Workshop: Damage Processing ─────────────────────────────────────────────

export interface AnalyzeDamageResponse {
  aiResult: {
    vehicleModel: string | null;
    parts: string[];
  };
  vehicle: string;
  parts: string[];
  damages: string[];
  recommendations: string[];
  severity: string;
}

export async function analyzeDamagePreview(payload: { vehicle: string; description: string }) {
  return request<AnalyzeDamageResponse>("/api/ai/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ProcessDamageResponse {
  aiResult: {
    vehicleModel: string | null;
    parts: string[];
  };
  quotation: {
    id: string;
    vehicle: string;
    description: string;
    parts: { name: string; qty: number; price: number }[];
    damages: string[];
    recommendations: string[];
    severity: string;
    status: string;
    labourCost: number;
    createdAt: string;
  };
}

export async function processDamage(payload: {
  vehicle: string;
  description: string;
  selectedParts: string[];
}) {
  return request<ProcessDamageResponse>("/api/ai/process", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWorkshopQuotations() {
  return request<
    {
      id: string;
      workshopId: string;
      workshopName: string;
      vehicle: string;
      description: string;
      photos: [];
      damages: string[];
      severity: "Low" | "Medium" | "High";
      recommendations: string[];
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      status: string;
      createdAt: number;
      invoiceId?: string;
      poId?: string;
    }[]
  >("/api/workshop/quotations");
}

export async function fetchWorkshopInvoices() {
  return request<
    {
      id: string;
      quotationId: string;
      workshopName: string;
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      total: number;
      createdAt: number;
    }[]
  >("/api/workshop/invoices");
}

export async function fetchWorkshopHistory() {
  return request<
    { id: string; message: string; type: "ai" | "system" | "user"; createdAt: number }[]
  >("/api/workshop/history");
}

export async function updateWorkshopQuotation(
  id: string,
  payload: { vehicle?: string; description?: string; parts?: { name: string; qty: number; price: number }[] },
) {
  return request<{
    id: string;
    workshopId: string;
    workshopName: string;
    vehicle: string;
    description: string;
    damages: string[];
    severity: string;
    parts: { name: string; qty: number; price: number }[];
    labourCost: number;
    status: string;
    createdAt: number;
  }>(`/api/workshop/quotations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkshopQuotation(id: string) {
  return request<{ message: string }>(`/api/workshop/quotations/${id}`, { method: "DELETE" });
}

// ─── Supplier ────────────────────────────────────────────────────────────────

export interface SupplierStockItem {
  id: string;
  partId: string;
  partName: string;
  vehicleModel: string;
  description: string | null;
  quantity: number;
  price: number;
}

export async function fetchSupplierStock() {
  return request<SupplierStockItem[]>("/api/supplier/stock");
}

export async function fetchSupplierQuotations() {
  return request<
    {
      id: string;
      workshopId: string;
      workshopName: string;
      vehicle: string;
      description: string;
      damages: string[];
      severity: string;
      recommendations: string[];
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      status: string;
      createdAt: number;
    }[]
  >("/api/supplier/quotations");
}

export async function processSupplierQuotation(id: string) {
  return request<{
    quotation: { id: string; status: string };
    invoice: {
      id: string;
      quotationId: string;
      workshopName: string;
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      total: number;
      status: string;
    } | null;
    purchaseOrders: {
      id: string;
      quotationId: string;
      workshopName: string;
      vendorEmail: string;
      urgency: string;
      status: string;
      parts: { id: string; name: string; qty: number; price: number }[];
    }[];
  }>(`/api/supplier/quotations/${id}/process`, { method: "POST" });
}

export async function fetchSupplierInvoices() {
  return request<
    {
      id: string;
      quotationId: string;
      workshopName: string;
      vehicle: string;
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      total: number;
      status: string;
      createdAt: number;
    }[]
  >("/api/supplier/invoices");
}

export async function updateSupplierInvoice(
  id: string,
  payload: {
    lineItems: { name: string; qty: number; price: number }[];
    labourCost?: number;
  },
) {
  return request<{
    id: string;
    quotationId: string;
    workshopName: string;
    vehicle: string;
    parts: { name: string; qty: number; price: number }[];
    labourCost: number;
    total: number;
    status: string;
    createdAt: number;
  }>(`/api/supplier/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function sendSupplierInvoice(id: string) {
  return request<{
    id: string;
    status: string;
    total: number;
  }>(`/api/supplier/invoices/${id}/send`, { method: "POST" });
}

export async function fetchSupplierPurchaseOrders() {
  return request<
    {
      id: string;
      quotationId: string;
      workshopName: string;
      vehicle: string;
      vendorEmail: string;
      urgency: string;
      status: string;
      createdAt: number;
      parts: { id: string; name: string; qty: number; price: number }[];
    }[]
  >("/api/supplier/purchase-orders");
}

export async function updateSupplierPurchaseOrder(
  quotationId: string,
  payload: {
    parts: { id: string; name: string; qty: number; price: number }[];
    vendorEmail?: string;
    urgency?: string;
  },
) {
  return request<{
    id: string;
    quotationId: string;
    workshopName: string;
    vehicle: string;
    vendorEmail: string;
    urgency: string;
    status: string;
    createdAt: number;
    parts: { id: string; name: string; qty: number; price: number }[];
  }>(`/api/supplier/purchase-orders/${quotationId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function sendSupplierPurchaseOrder(quotationId: string) {
  return request<{
    id: string;
    status: string;
  }>(`/api/supplier/purchase-orders/${quotationId}/send`, { method: "POST" });
}

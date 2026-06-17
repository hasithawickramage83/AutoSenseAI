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
  id: string | number;
  name: string;
  email: string;
  role: ApiUserRole;
  createdAt?: string;
}

function normalizeUser(u: ApiUser): ApiUser {
  return { ...u, id: String(u.id) };
}

function normalizeVehicleModel(m: ApiVehicleModel): ApiVehicleModel {
  return { ...m, id: String(m.id) };
}

function normalizeStock(s: ApiStock): ApiStock {
  return {
    ...s,
    id: String(s.id),
    partId: String(s.partId),
    part: s.part ? normalizePart(s.part) : s.part,
  };
}

function normalizePart(p: ApiPart): ApiPart {
  return {
    ...p,
    id: String(p.id),
    vehicleModelId: String(p.vehicleModelId),
    vehicleModel: p.vehicleModel ? normalizeVehicleModel(p.vehicleModel) : p.vehicleModel,
    stocks: (p.stocks ?? []).map(normalizeStock),
  };
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
    id: String(user.id),
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
  const rows = await request<ApiUser[]>("/api/admin/users");
  return rows.map(normalizeUser);
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  const res = await request<{ message: string; user: ApiUser }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: appRoleToApi(payload.role),
    }),
  });
  return { ...res, user: normalizeUser(res.user) };
}

export async function updateAdminUser(
  id: string,
  payload: { name?: string; email?: string; password?: string; role?: Role },
) {
  const res = await request<{ message: string; user: ApiUser }>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      role: payload.role ? appRoleToApi(payload.role) : undefined,
    }),
  });
  return { ...res, user: normalizeUser(res.user) };
}

export async function deleteAdminUser(id: string) {
  return request<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" });
}

// ─── Admin: Vehicle Models ───────────────────────────────────────────────────

export interface ApiVehicleModel {
  id: string | number;
  name: string;
  _count?: { parts: number };
}

export async function fetchVehicleModels() {
  const rows = await request<ApiVehicleModel[]>("/api/admin/vehicle-models");
  return rows.map(normalizeVehicleModel);
}

export async function createVehicleModel(name: string) {
  const row = await request<ApiVehicleModel>("/api/admin/vehicle-models", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return normalizeVehicleModel(row);
}

export async function updateVehicleModel(id: string, name: string) {
  const row = await request<ApiVehicleModel>(`/api/admin/vehicle-models/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  return normalizeVehicleModel(row);
}

export async function deleteVehicleModel(id: string) {
  return request<{ message: string }>(`/api/admin/vehicle-models/${id}`, { method: "DELETE" });
}

// ─── Admin: Parts ────────────────────────────────────────────────────────────

export interface ApiPart {
  id: string | number;
  name: string;
  description: string | null;
  activeStatus: number;
  vehicleModelId: string | number;
  vehicleModel: ApiVehicleModel;
  stocks: ApiStock[];
}

export async function fetchParts() {
  const rows = await request<ApiPart[]>("/api/admin/parts");
  return rows.map(normalizePart);
}

export async function createPart(payload: {
  name: string;
  description?: string;
  vehicleModelId: string;
}) {
  const row = await request<ApiPart>("/api/admin/part", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizePart(row);
}

export async function updatePart(
  id: string,
  payload: { name?: string; description?: string; vehicleModelId?: string },
) {
  const row = await request<ApiPart>(`/api/admin/parts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizePart(row);
}

export async function deletePart(id: string) {
  const res = await request<{ message: string; part: ApiPart }>(`/api/admin/parts/${id}`, {
    method: "DELETE",
  });
  return { ...res, part: normalizePart(res.part) };
}

// ─── Admin: Stock ────────────────────────────────────────────────────────────

export interface ApiStock {
  id: string | number;
  quantity: number;
  price: number;
  partId: string | number;
  part?: ApiPart & { vehicleModel?: ApiVehicleModel };
}

export async function fetchStock() {
  const rows = await request<ApiStock[]>("/api/admin/stock");
  return rows.map(normalizeStock);
}

export async function createStock(payload: { partId: string; quantity: number; price: number }) {
  const row = await request<ApiStock>("/api/admin/stock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeStock(row);
}

export async function updateStock(id: string, payload: { quantity?: number; price?: number }) {
  const row = await request<ApiStock>(`/api/admin/stock/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeStock(row);
}

export async function upsertStockByPart(payload: { partId: string; quantity: number; price: number }) {
  const row = await request<ApiStock>("/api/admin/stock/by-part", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeStock(row);
}

export async function deleteStock(id: string) {
  return request<{ message: string }>(`/api/admin/stock/${id}`, { method: "DELETE" });
}

export interface InventoryDashboard {
  totalSkus: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  totalValue: number;
  items: {
    id: string;
    partId: string;
    partName: string;
    vehicleModel: string;
    quantity: number;
    price: number;
    value: number;
    availability: "ok" | "low" | "out";
  }[];
}

export async function fetchInventoryDashboard() {
  const data = await request<InventoryDashboard>("/api/admin/inventory/dashboard");
  return {
    ...data,
    items: data.items.map((i) => ({
      ...i,
      id: String(i.id),
      partId: String(i.partId),
    })),
  };
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
  processing?: {
    allInStock: boolean;
    autoSent: boolean;
    invoiceId?: string;
    quotationStatus?: string;
    purchaseOrderCount: number;
  } | null;
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

export async function fetchWorkshopVehicleModels() {
  return request<{ id: string; name: string }[]>("/api/workshop/vehicle-models");
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
      vehicle?: string;
      parts: { name: string; qty: number; price: number }[];
      labourCost: number;
      total: number;
      status?: string;
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

export async function fetchSupplierStockBrowse(params: {
  search?: string;
  vehicleModel?: string;
  partName?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.vehicleModel && params.vehicleModel !== "all") {
    qs.set("vehicleModel", params.vehicleModel);
  }
  if (params.partName && params.partName !== "all") {
    qs.set("partName", params.partName);
  }
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return request<{
    data: SupplierStockItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/api/supplier/stock${query ? `?${query}` : ""}`);
}

export async function fetchSupplierStockFilters() {
  return request<{ vehicleModels: string[]; partNames: string[] }>(
    "/api/supplier/stock/filters",
  );
}

export type SupplierQuotation = {
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
  invoiceId?: string;
  poId?: string;
};

export async function fetchSupplierQuotations() {
  return request<SupplierQuotation[]>("/api/supplier/quotations");
}

export async function fetchSupplierAllQuotations() {
  return request<SupplierQuotation[]>("/api/supplier/quotations/all");
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
      stockReady?: boolean;
      awaitingStock?: boolean;
      stockItems?: {
        partName: string;
        requiredQty: number;
        availableQty: number;
        inStock: boolean;
      }[];
      createdAt: number;
    }[]
  >("/api/supplier/invoices");
}

export async function fetchSupplierWorkshops() {
  return request<{ id: string; name: string; email: string }[]>("/api/supplier/workshops");
}

export async function createSupplierCustomQuotation(payload: {
  vehicleModel: string;
  vehicleNumber: string;
  description?: string;
  vendorIds: string[];
  parts: { stockId: string; qty: number }[];
  images?: { name: string; dataUrl: string }[];
  emailMode?: "separate" | "bcc";
  primaryVendorId?: string;
}) {
  return request<{
    message: string;
    quotation: { id: string; status: string; vehicle: string; workshopName: string; source?: string };
    requests: VendorQuotationRequest[];
  }>("/api/supplier/quotations/custom", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupplierInvoice(
  id: string,
  payload: {
    lineItems: { stockId: string; qty: number; price: number }[];
  },
) {
  return request<{
    id: string;
    quotationId: string;
    workshopName: string;
    vehicle: string;
    parts: { name: string; qty: number; price: number; stockId?: string }[];
    labourCost: number;
    total: number;
    status: string;
    stockReady?: boolean;
    awaitingStock?: boolean;
    stockItems?: {
      partName: string;
      requiredQty: number;
      availableQty: number;
      inStock: boolean;
    }[];
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

// ─── Admin: Vendors ──────────────────────────────────────────────────────────

export interface ApiVendor {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  address: string;
  contactNumber: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: number;
  updatedAt: number;
}

export interface PaginatedVendors {
  data: ApiVendor[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchVendors(params?: {
  search?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.sort) q.set("sort", params.sort);
  if (params?.order) q.set("order", params.order);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<PaginatedVendors>(`/api/admin/vendors${qs ? `?${qs}` : ""}`);
}

export async function fetchVendor(id: string) {
  return request<ApiVendor>(`/api/admin/vendors/${id}`);
}

export async function createVendor(payload: {
  companyName: string;
  contactPerson: string;
  email: string;
  address?: string;
  contactNumber?: string;
  status?: "ACTIVE" | "INACTIVE";
}) {
  return request<ApiVendor>("/api/admin/vendors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVendor(
  id: string,
  payload: Partial<{
    companyName: string;
    contactPerson: string;
    email: string;
    address: string;
    contactNumber: string;
    status: "ACTIVE" | "INACTIVE";
  }>,
) {
  return request<ApiVendor>(`/api/admin/vendors/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteVendor(id: string) {
  return request<{ message: string }>(`/api/admin/vendors/${id}`, { method: "DELETE" });
}

// ─── Supplier: Vendor quotations ───────────────────────────────────────────

export interface VendorQuotationRequestPart {
  id?: number;
  partName: string;
  quantity: number;
}

export interface VendorQuotationRequest {
  id: number;
  quotationId: string;
  vendorId: number;
  vendorName: string;
  vendorEmail: string;
  vehicle?: string;
  status: string;
  expiresAt: number;
  sentAt: number | null;
  openedAt: number | null;
  respondedAt: number | null;
  createdAt: number;
  parts: VendorQuotationRequestPart[];
  response: {
    id: number;
    estimatedDeliveryTime: string | null;
    remarks: string | null;
    lineItems: { partName: string; quantity: number; unitPrice: number }[];
    submittedAt: number;
  } | null;
  activities: { id: number; message: string; type: string; createdAt: number }[];
}

export interface VendorComparisonOffer {
  requestId: number;
  vendorId: number;
  vendorName: string;
  unitPrice: number;
  lineTotal: number;
}

export interface VendorComparisonItem {
  partName: string;
  quantity: number;
  offers: VendorComparisonOffer[];
  lowestVendorId: number | null;
  lowestVendorName: string | null;
  lowestPrice: number | null;
}

export interface VendorComparison {
  items: VendorComparisonItem[];
  vendorTotals: {
    vendorId: number;
    vendorName: string;
    requestId: number;
    total: number;
    respondedAt: number;
  }[];
  overallCheapest: { vendorId: number; vendorName: string; total: number } | null;
  bestMixTotal: number;
  recommendedVendor: { vendorId: number; vendorName: string; total: number } | null;
  savingsVsHighest: number;
  savingsBestMix: number;
  allResponded: boolean;
  respondedCount: number;
  totalRequests: number;
}

export async function fetchSupplierActiveVendors() {
  return request<
    { id: string; companyName: string; contactPerson: string; email: string }[]
  >("/api/supplier/vendors");
}

export async function sendVendorQuotationRequests(payload: {
  quotationId: string;
  vendorIds: string[];
  parts: { partName: string; quantity: number }[];
}) {
  return request<{ message: string; requests: VendorQuotationRequest[] }>(
    "/api/supplier/vendor-quotations/send",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function fetchVendorQuotationRequests(params?: {
  quotationId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.quotationId) q.set("quotationId", params.quotationId);
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<{ data: VendorQuotationRequest[]; pagination: { total: number } }>(
    `/api/supplier/vendor-quotations${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchVendorComparisonQuotations() {
  return request<
    {
      id: string;
      vehicle: string;
      status: string;
      source: string;
      workshopName: string;
      description: string;
      createdAt: number;
    }[]
  >("/api/supplier/vendor-quotations/quotations-for-comparison");
}

export async function fetchVendorQuotationComparison(quotationId: string) {
  return request<{
    quotation: { id: string; vehicle: string; status: string };
    requests: VendorQuotationRequest[];
    comparison: VendorComparison;
  }>(`/api/supplier/vendor-quotations/${quotationId}/comparison`);
}

/** Public vendor form — no auth */
export async function fetchVendorResponseForm(token: string) {
  return request<{
    vendorName: string;
    vehicleNumber: string;
    quotationNumber: string;
    expiresAt: number;
    parts: { partName: string; quantity: number }[];
  }>(`/api/vendor-quotation/${token}`);
}

export async function submitVendorResponse(
  token: string,
  payload: {
    lineItems: { partName: string; unitPrice: number }[];
    estimatedDeliveryTime?: string;
    remarks?: string;
  },
) {
  return request<{ message: string }>(`/api/vendor-quotation/${token}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

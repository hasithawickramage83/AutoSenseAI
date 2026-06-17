import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, ApiError } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Send, X, Upload, FileImage } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  createSupplierCustomQuotation,
  fetchSupplierActiveVendors,
  fetchSupplierStockBrowse,
  fetchSupplierStockFilters,
  type SupplierStockItem,
} from "@/lib/api";

const MAX_IMAGES = 10;
const INITIAL_STOCK_LIMIT = 50;
const SEARCH_STOCK_LIMIT = 200;

interface QuotationImage {
  name: string;
  dataUrl: string;
}

export function SupplierCustomQuotationSection() {
  const { state, refreshSupplierData, addLog } = useStore();
  const [vendors, setVendors] = useState<
    { id: string; companyName: string; contactPerson: string; email: string }[]
  >([]);
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [partFilter, setPartFilter] = useState("all");
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [selectedStockMeta, setSelectedStockMeta] = useState<Map<string, SupplierStockItem>>(
    new Map(),
  );
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [emailMode, setEmailMode] = useState<"separate" | "bcc">("separate");
  const [primaryVendorId, setPrimaryVendorId] = useState<string | null>(null);
  const [stockRows, setStockRows] = useState<SupplierStockItem[]>([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockLoading, setStockLoading] = useState(false);
  const [vehicleModels, setVehicleModels] = useState<string[]>([]);
  const [partNames, setPartNames] = useState<string[]>([]);
  const [images, setImages] = useState<QuotationImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSupplierActiveVendors()
      .then(setVendors)
      .catch(() => toast.error("Failed to load vendors"));
    fetchSupplierStockFilters()
      .then((filters) => {
        setVehicleModels(filters.vehicleModels);
        setPartNames(filters.partNames);
      })
      .catch(() => toast.error("Failed to load catalog filters"));
  }, []);

  const searchActive = search.trim().length > 0;
  const hasFilters = modelFilter !== "all" || partFilter !== "all";

  useEffect(() => {
    const timer = setTimeout(async () => {
      setStockLoading(true);
      try {
        const limit = searchActive || hasFilters ? SEARCH_STOCK_LIMIT : INITIAL_STOCK_LIMIT;
        const res = await fetchSupplierStockBrowse({
          search: search.trim() || undefined,
          vehicleModel: modelFilter,
          partName: partFilter,
          limit,
          offset: 0,
        });
        setStockRows(res.data);
        setStockTotal(res.total);
      } catch {
        setStockRows([]);
        setStockTotal(0);
        toast.error("Failed to load catalog stock");
      } finally {
        setStockLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, modelFilter, partFilter, searchActive, hasFilters]);

  const selectedItems = useMemo(() => {
    return [...selected.entries()]
      .map(([stockId, qty]) => {
        const item = selectedStockMeta.get(stockId);
        return item ? { ...item, qty } : null;
      })
      .filter(Boolean) as (SupplierStockItem & { qty: number })[];
  }, [selected, selectedStockMeta]);

  function togglePart(item: SupplierStockItem, checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(item.id, 1);
      else next.delete(item.id);
      return next;
    });
    setSelectedStockMeta((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(item.id, item);
        if (!vehicleModel.trim()) {
          setVehicleModel(item.vehicleModel);
        }
      } else next.delete(item.id);
      return next;
    });
  }

  function setQty(stockId: string, qty: number) {
    setSelected((prev) => new Map(prev).set(stockId, Math.max(1, qty)));
  }

  function removePart(stockId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(stockId);
      return next;
    });
  }

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryVendorId === id) {
          const remaining = [...next];
          setPrimaryVendorId(remaining[0] ?? null);
        }
      } else {
        next.add(id);
        if (emailMode === "bcc" && next.size === 1) {
          setPrimaryVendorId(id);
        } else if (emailMode === "bcc" && !primaryVendorId) {
          setPrimaryVendorId(id);
        }
      }
      return next;
    });
  }

  const allVendorsSelected =
    vendors.length > 0 && vendors.every((v) => selectedVendors.has(v.id));
  const someVendorsSelected =
    selectedVendors.size > 0 && !allVendorsSelected;

  function toggleAllVendors() {
    if (allVendorsSelected) {
      setSelectedVendors(new Set());
      setPrimaryVendorId(null);
    } else {
      const all = new Set(vendors.map((v) => v.id));
      setSelectedVendors(all);
      if (emailMode === "bcc") {
        setPrimaryVendorId(vendors[0]?.id ?? null);
      }
    }
  }

  const selectedVendorList = useMemo(
    () => vendors.filter((v) => selectedVendors.has(v.id)),
    [vendors, selectedVendors],
  );

  function onImageFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const arr = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);

    if (arr.length === 0) {
      toast.error("Please select image files only");
      return;
    }

    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { name: f.name, dataUrl: reader.result as string }];
        });
      };
      reader.readAsDataURL(f);
    });
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!vehicleModel.trim()) {
      toast.error("Select or enter vehicle model");
      return;
    }
    if (!vehicleNumber.trim()) {
      toast.error("Vehicle number is required");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one part");
      return;
    }
    if (selectedVendors.size === 0) {
      toast.error("Select at least one vendor");
      return;
    }
    if (emailMode === "bcc" && selectedVendors.size > 1 && !primaryVendorId) {
      toast.error("Select which vendor receives the email as To");
      return;
    }
    if (emailMode === "bcc" && primaryVendorId && !selectedVendors.has(primaryVendorId)) {
      toast.error("Primary vendor must be one of the selected vendors");
      return;
    }

    setSubmitting(true);
    try {
      const parts = [...selected.entries()].map(([stockId, qty]) => ({ stockId, qty }));
      const res = await createSupplierCustomQuotation({
        vehicleModel: vehicleModel.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        description: description.trim() || undefined,
        vendorIds: [...selectedVendors],
        parts,
        images: images.length > 0 ? images : undefined,
        emailMode,
        primaryVendorId:
          emailMode === "bcc" && selectedVendors.size > 1
            ? (primaryVendorId ?? undefined)
            : undefined,
      });
      await refreshSupplierData();
      addLog(`Custom quotation ${res.quotation.id} sent to vendors`, "user");
      toast.success(res.message);
      setSelected(new Map());
      setSelectedStockMeta(new Map());
      setSelectedVendors(new Set());
      setPrimaryVendorId(null);
      setEmailMode("separate");
      setImages([]);
      setVehicleModel("");
      setVehicleNumber("");
      setDescription("");
      setSearch("");
      setModelFilter("all");
      setPartFilter("all");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Create Custom Quotation</CardTitle>
        <CardDescription>
          Search catalog stock, select parts, and send quotation requests to vendors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <div className="grid gap-2">
            <Label htmlFor="vehicle-model">Vehicle model</Label>
            <Input
              id="vehicle-model"
              list="vehicle-model-options"
              placeholder="e.g. Toyota Aqua"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
            <datalist id="vehicle-model-options">
              {vehicleModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-slate-500">
              Auto-filled from the first selected part when available.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vehicle-number">
              Vehicle number <span className="text-red-600">*</span>
            </Label>
            <Input
              id="vehicle-number"
              placeholder="e.g. QAY557"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              required
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Description (optional)</Label>
          <Textarea
            placeholder="Notes about the repair or parts required"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Reference images (optional)</Label>
          <p className="text-xs text-slate-500">
            Attach up to {MAX_IMAGES} images — they will be included as email attachments for
            vendors.
          </p>
          <div
            className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
              dragActive ? "border-blue-400 bg-blue-50/50" : "border-slate-200"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              onImageFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onImageFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
              >
                <Upload className="mr-2 h-4 w-4" />
                Add images
              </Button>
              <span className="text-xs text-slate-500">
                {images.length}/{MAX_IMAGES} attached
              </span>
            </div>
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div
                    key={`${img.name}-${i}`}
                    className="group relative aspect-square rounded-md border overflow-hidden bg-slate-100"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(i)}
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-[10px] text-white truncate flex items-center gap-1">
                      <FileImage className="h-3 w-3 shrink-0" />
                      {img.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Select parts from stock</Label>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search part, model, or keywords (e.g. Toyota bumper left)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vehicle model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicle models</SelectItem>
                {vehicleModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={partFilter} onValueChange={setPartFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Part name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All part names</SelectItem>
                {partNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mb-3 text-xs text-slate-500">
            {stockLoading
              ? "Loading catalog…"
              : searchActive || hasFilters
                ? `Showing ${stockRows.length} of ${stockTotal} matching items. Refine search with more keywords if needed.`
                : `Showing first ${stockRows.length} of ${stockTotal} items. Search or filter to find more.`}
          </p>

          {stockLoading && stockRows.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Loading catalog stock…</p>
          ) : stockRows.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              {stockTotal === 0 ? "No catalog stock loaded." : "No parts match your filters."}
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Part name</TableHead>
                    <TableHead>Vehicle model</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Price (NZD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((s) => {
                    const checked = selected.has(s.id);
                    return (
                      <TableRow key={s.id} className={checked ? "bg-blue-50/50" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => togglePart(s, Boolean(v))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{s.partName}</div>
                          {s.description && (
                            <div className="text-xs text-slate-500">{s.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{s.vehicleModel}</TableCell>
                        <TableCell className="text-sm">{s.quantity}</TableCell>
                        <TableCell className="text-sm">${s.price.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="rounded-lg border bg-slate-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Selected parts ({selectedItems.length})</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSelected(new Map());
                  setSelectedStockMeta(new Map());
                }}
              >
                Clear all
              </Button>
            </div>
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-white px-3 py-2"
                >
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{item.partName}</p>
                    <p className="text-xs text-slate-500">{item.vehicleModel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={item.qty}
                      onChange={(e) => setQty(item.id, Number(e.target.value))}
                    />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    NZD ${item.price.toFixed(2)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removePart(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Label>Select vendors</Label>
            {vendors.length > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={
                    allVendorsSelected ? true : someVendorsSelected ? "indeterminate" : false
                  }
                  onCheckedChange={() => toggleAllVendors()}
                />
                <span className="text-slate-600">Select all vendors</span>
              </label>
            )}
          </div>

          <div className="mb-4 rounded-lg border bg-slate-50/80 p-4 space-y-3">
            <Label className="text-sm">Email delivery</Label>
            <RadioGroup
              value={emailMode}
              onValueChange={(value) => {
                const mode = value as "separate" | "bcc";
                setEmailMode(mode);
                if (mode === "bcc" && selectedVendors.size > 0 && !primaryVendorId) {
                  setPrimaryVendorId([...selectedVendors][0] ?? null);
                }
              }}
              className="gap-3"
            >
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="separate" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Separate email to each vendor</p>
                  <p className="text-xs text-slate-500">
                    Each selected vendor receives their own email with a personal response link.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="bcc" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">One email — one To, others BCC</p>
                  <p className="text-xs text-slate-500">
                    Send a single email to one primary vendor; all other selected vendors are added
                    as BCC. Each vendor still gets their own response link in the message.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {emailMode === "bcc" && selectedVendorList.length > 1 && (
              <div className="grid gap-2 pt-1 border-t border-slate-200">
                <Label className="text-sm">Primary recipient (To)</Label>
                <Select
                  value={primaryVendorId ?? ""}
                  onValueChange={setPrimaryVendorId}
                >
                  <SelectTrigger className="max-w-md bg-white">
                    <SelectValue placeholder="Choose vendor for To field" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVendorList.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.companyName} — {v.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {selectedVendorList.length - 1} other vendor
                  {selectedVendorList.length - 1 === 1 ? "" : "s"} will be BCC on this email.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((v) => {
              const selected = selectedVendors.has(v.id);
              const isPrimary = emailMode === "bcc" && primaryVendorId === v.id;
              return (
              <label
                key={v.id}
                className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-slate-50 ${
                  isPrimary ? "border-blue-400 bg-blue-50/40" : ""
                }`}
              >
                <Checkbox
                  className="mt-1"
                  checked={selected}
                  onCheckedChange={() => toggleVendor(v.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm">{v.companyName}</p>
                    {isPrimary && selected && (
                      <Badge variant="secondary" className="text-[10px]">
                        To
                      </Badge>
                    )}
                    {emailMode === "bcc" && selected && !isPrimary && selectedVendorList.length > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        BCC
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{v.contactPerson}</p>
                  <p className="text-xs text-slate-400">{v.email}</p>
                </div>
              </label>
            );
            })}
          </div>
          {vendors.length === 0 && (
            <p className="text-sm text-slate-500 py-2">No active vendors available.</p>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={submitting}>
          <Send className="mr-2 h-4 w-4" />
          {submitting
            ? "Sending…"
            : emailMode === "bcc" && selectedVendorList.length > 1
              ? "Create & send one email (To + BCC)"
              : "Create & send to vendors"}
        </Button>
      </CardContent>
    </Card>
  );
}

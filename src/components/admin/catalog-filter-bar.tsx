import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApiVehicleMake, ApiVehicleModel } from "@/lib/api";

export interface CatalogFilters {
  makeId: string;
  vehicleModelId: string;
  search: string;
}

interface CatalogFilterBarProps {
  makes: ApiVehicleMake[];
  modelsByMake: Map<string, ApiVehicleModel[]>;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  searchPlaceholder?: string;
}

export function CatalogFilterBar({
  makes,
  modelsByMake,
  filters,
  onFiltersChange,
  searchPlaceholder = "Search by keyword…",
}: CatalogFilterBarProps) {
  const modelOptions =
    filters.makeId === "all" ? [] : (modelsByMake.get(filters.makeId) ?? []);

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <div className="grid gap-2">
        <Label>Make</Label>
        <Select
          value={filters.makeId}
          onValueChange={(makeId) =>
            onFiltersChange({ ...filters, makeId, vehicleModelId: "all" })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All makes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All makes</SelectItem>
            {makes.map((make) => (
              <SelectItem key={make.id} value={make.id}>
                {make.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Model</Label>
        <Select
          value={filters.vehicleModelId}
          onValueChange={(vehicleModelId) => onFiltersChange({ ...filters, vehicleModelId })}
          disabled={filters.makeId === "all"}
        >
          <SelectTrigger>
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {modelOptions.map((model) => (
              <SelectItem key={model.id} value={String(model.id)}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Keyword</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function partVehicleLabel(part?: { vehicleModel?: { make?: { name: string }; name: string; fullName?: string } }) {
  if (!part?.vehicleModel) return "—";
  const make = part.vehicleModel.make?.name;
  const model = part.vehicleModel.name;
  const full = part.vehicleModel.fullName;
  if (make && model) return `${make} · ${model}`;
  return full ?? model ?? "—";
}

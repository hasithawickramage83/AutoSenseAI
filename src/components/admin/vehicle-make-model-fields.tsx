import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchVehicleMakes,
  fetchCatalogVehicleModels,
  fetchWorkshopVehicleMakes,
  fetchWorkshopCatalogVehicleModels,
  type ApiVehicleMake,
  type ApiVehicleModel,
} from "@/lib/api";

interface VehicleMakeModelFieldsProps {
  makeId: string;
  vehicleModelId: string;
  onMakeIdChange: (makeId: string) => void;
  onVehicleModelIdChange: (vehicleModelId: string) => void;
  makeLabel?: string;
  modelLabel?: string;
  required?: boolean;
  /** Workshop users use read-only catalog endpoints instead of admin APIs. */
  apiSource?: "admin" | "workshop";
}

export function VehicleMakeModelFields({
  makeId,
  vehicleModelId,
  onMakeIdChange,
  onVehicleModelIdChange,
  makeLabel = "Make",
  modelLabel = "Model",
  required = false,
  apiSource = "admin",
}: VehicleMakeModelFieldsProps) {
  const [makes, setMakes] = useState<ApiVehicleMake[]>([]);
  const [models, setModels] = useState<ApiVehicleModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMakes = apiSource === "workshop" ? fetchWorkshopVehicleMakes : fetchVehicleMakes;
    loadMakes()
      .then(setMakes)
      .finally(() => setLoading(false));
  }, [apiSource]);

  useEffect(() => {
    if (!makeId || makeId === "all") {
      setModels([]);
      return;
    }
    const loadModels =
      apiSource === "workshop" ? fetchWorkshopCatalogVehicleModels : fetchCatalogVehicleModels;
    loadModels(makeId).then(setModels);
  }, [makeId, apiSource]);

  const modelsForMake = useMemo(() => {
    if (!makeId || makeId === "all") return [];
    return models.filter((m) => String(m.makeId) === String(makeId));
  }, [models, makeId]);

  useEffect(() => {
    if (!vehicleModelId || modelsForMake.length === 0) return;
    const exists = modelsForMake.some((m) => String(m.id) === String(vehicleModelId));
    if (!exists) {
      onVehicleModelIdChange(String(modelsForMake[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsForMake, vehicleModelId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicle catalog…</p>;
  }

  if (makes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No vehicle makes in catalog. Add makes and models under Vehicle Catalog first.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label>
          {makeLabel}
          {required ? " *" : ""}
        </Label>
        <Select
          value={makeId || makes[0]?.id}
          onValueChange={(value) => {
            onMakeIdChange(value);
            onVehicleModelIdChange("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select make" />
          </SelectTrigger>
          <SelectContent>
            {makes.map((make) => (
              <SelectItem key={make.id} value={make.id}>
                {make.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>
          {modelLabel}
          {required ? " *" : ""}
        </Label>
        <Select
          value={vehicleModelId || modelsForMake[0]?.id || ""}
          onValueChange={onVehicleModelIdChange}
          disabled={!makeId || modelsForMake.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={modelsForMake.length ? "Select model" : "No models"} />
          </SelectTrigger>
          <SelectContent>
            {modelsForMake.map((model) => (
              <SelectItem key={model.id} value={String(model.id)}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function useVehicleCatalog() {
  const [makes, setMakes] = useState<ApiVehicleMake[]>([]);
  const [allModels, setAllModels] = useState<ApiVehicleModel[]>([]);

  useEffect(() => {
    Promise.all([fetchVehicleMakes(), fetchCatalogVehicleModels()]).then(([makeRows, modelRows]) => {
      setMakes(makeRows);
      setAllModels(modelRows);
    });
  }, []);

  const modelsByMake = useMemo(() => {
    const map = new Map<string, ApiVehicleModel[]>();
    for (const model of allModels) {
      const makeId = String(model.makeId ?? "");
      if (!makeId) continue;
      const list = map.get(makeId) ?? [];
      list.push(model);
      map.set(makeId, list);
    }
    return map;
  }, [allModels]);

  return { makes, allModels, modelsByMake };
}

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ApiVehicleMake, ApiVehicleModel } from "@/lib/api";

type CatalogMake = ApiVehicleMake & { models?: ApiVehicleModel[] };

export interface VendorCatalogSelection {
  makeIds: string[];
  vehicleModelIds: string[];
}

interface VendorCatalogPickerProps {
  makes: CatalogMake[];
  selection: VendorCatalogSelection;
  onChange: (selection: VendorCatalogSelection) => void;
}

function sameId(a: string | number, b: string | number) {
  return String(a) === String(b);
}

export function VendorCatalogPicker({ makes, selection, onChange }: VendorCatalogPickerProps) {
  const { makeIds: selectedMakeIds, vehicleModelIds: selectedModelIds } = selection;

  const modelsByMake = useMemo(() => {
    const map = new Map<string, ApiVehicleModel[]>();
    for (const make of makes) {
      map.set(String(make.id), make.models ?? []);
    }
    return map;
  }, [makes]);

  const modelToMakeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const make of makes) {
      for (const model of make.models ?? []) {
        map.set(String(model.id), String(make.id));
      }
    }
    return map;
  }, [makes]);

  const selectedMakes = useMemo(
    () => makes.filter((make) => selectedMakeIds.some((id) => sameId(id, make.id))),
    [makes, selectedMakeIds],
  );

  function applySelection(makeIds: string[], vehicleModelIds: string[]) {
    onChange({ makeIds, vehicleModelIds });
  }

  function toggleMake(makeId: string, checked: boolean) {
    if (checked) {
      applySelection(
        [...new Set([...selectedMakeIds.map(String), makeId])],
        selectedModelIds,
      );
      return;
    }

    const modelIdsForMake = new Set(
      (modelsByMake.get(makeId) ?? []).map((m) => String(m.id)),
    );
    applySelection(
      selectedMakeIds.filter((id) => !sameId(id, makeId)),
      selectedModelIds.filter((id) => !modelIdsForMake.has(String(id))),
    );
  }

  function toggleModel(modelId: string, checked: boolean) {
    const makeId = modelToMakeId.get(modelId);
    if (checked) {
      const nextMakeIds =
        makeId && !selectedMakeIds.some((id) => sameId(id, makeId))
          ? [...new Set([...selectedMakeIds.map(String), makeId])]
          : selectedMakeIds;
      applySelection(nextMakeIds, [...new Set([...selectedModelIds.map(String), modelId])]);
      return;
    }
    applySelection(selectedMakeIds, selectedModelIds.filter((id) => !sameId(id, modelId)));
  }

  function selectAllModelsForMake(makeId: string) {
    const modelIds = (modelsByMake.get(makeId) ?? []).map((m) => String(m.id));
    const nextMakeIds = selectedMakeIds.some((id) => sameId(id, makeId))
      ? selectedMakeIds
      : [...new Set([...selectedMakeIds.map(String), makeId])];
    applySelection(nextMakeIds, [...new Set([...selectedModelIds.map(String), ...modelIds])]);
  }

  function clearModelsForMake(makeId: string) {
    const modelIds = new Set((modelsByMake.get(makeId) ?? []).map((m) => String(m.id)));
    applySelection(
      selectedMakeIds,
      selectedModelIds.filter((id) => !modelIds.has(String(id))),
    );
  }

  if (makes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No vehicle makes configured yet. Add makes and models in Vehicle Catalog first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Vehicle makes supplied</Label>
        <p className="mb-3 text-xs text-slate-500">
          Select one or more makes. Models for each selected make will appear below.
        </p>
        <div className="flex flex-wrap gap-2">
          {makes.map((make) => {
            const makeId = String(make.id);
            const checked = selectedMakeIds.some((id) => sameId(id, makeId));
            const inputId = `vendor-make-${makeId}`;
            return (
              <div
                key={makeId}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  checked ? "border-slate-900 bg-slate-50" : "border-slate-200"
                }`}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={(v) => toggleMake(makeId, v === true)}
                />
                <Label htmlFor={inputId} className="cursor-pointer font-normal">
                  {make.name}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Vehicle models supplied</Label>
        {selectedMakes.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-slate-500">
            Select at least one vehicle make above to choose specific models.
          </div>
        ) : (
          <div className="max-h-72 space-y-4 overflow-y-auto rounded-md border p-3">
            {selectedMakes.map((make) => {
              const makeId = String(make.id);
              const models = modelsByMake.get(makeId) ?? [];
              const selectedCount = models.filter((m) =>
                selectedModelIds.some((id) => sameId(id, m.id)),
              ).length;

              return (
                <div key={makeId} className="rounded-md border bg-slate-50/60 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{make.name}</p>
                    {models.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">
                          {selectedCount} of {models.length} selected
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => selectAllModelsForMake(makeId)}
                        >
                          Select all
                        </Button>
                        {selectedCount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => clearModelsForMake(makeId)}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {models.length === 0 ? (
                    <p className="text-sm text-slate-500">No models configured for this make.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {models.map((model) => {
                        const modelId = String(model.id);
                        const checked = selectedModelIds.some((id) => sameId(id, modelId));
                        const inputId = `vendor-model-${modelId}`;
                        return (
                          <div
                            key={modelId}
                            className={`flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-sm ${
                              checked ? "border-slate-900" : "border-slate-200"
                            }`}
                          >
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              onCheckedChange={(v) => toggleModel(modelId, v === true)}
                            />
                            <Label htmlFor={inputId} className="cursor-pointer font-normal">
                              {model.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(selectedMakeIds.length > 0 || selectedModelIds.length > 0) && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-500">Selected summary</Label>
          <div className="flex flex-wrap gap-2">
            {selectedMakeIds.map((id) => {
              const make = makes.find((m) => sameId(m.id, id));
              if (!make) return null;
              const makeModelIds = new Set(
                (modelsByMake.get(String(make.id)) ?? []).map((m) => String(m.id)),
              );
              const hasSpecificModels = selectedModelIds.some((modelId) =>
                makeModelIds.has(String(modelId)),
              );
              return (
                <Badge key={`make-${id}`} variant="outline">
                  {make.name}
                  {hasSpecificModels ? " + models" : ""}
                </Badge>
              );
            })}
            {selectedModelIds.map((id) => {
              for (const make of makes) {
                const model = (make.models ?? []).find((m) => sameId(m.id, id));
                if (model) {
                  return (
                    <Badge key={`model-${id}`}>
                      {make.name} {model.name}
                    </Badge>
                  );
                }
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

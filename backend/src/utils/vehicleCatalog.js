const MULTI_WORD_MAKES = ["Mercedes-Benz"];

export function splitMakeModel(fullName) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return { make: "", model: "" };

  for (const make of MULTI_WORD_MAKES) {
    if (trimmed.startsWith(`${make} `)) {
      return { make, model: trimmed.slice(make.length + 1).trim() };
    }
  }

  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { make: trimmed, model: trimmed };
  return { make: trimmed.slice(0, idx), model: trimmed.slice(idx + 1).trim() };
}

export function vehicleModelFullName(model) {
  if (!model) return "";
  if (model.make?.name) return `${model.make.name} ${model.name}`.trim();
  return model.name ?? "";
}

export function mapVehicleModel(model) {
  return {
    id: String(model.id),
    makeId: model.makeId != null ? String(model.makeId) : undefined,
    name: model.name,
    fullName: vehicleModelFullName(model),
    make: model.make
      ? { id: String(model.make.id), name: model.make.name }
      : undefined,
    _count: model._count,
  };
}

export function mapStockRecord(stock) {
  return {
    id: String(stock.id),
    quantity: stock.quantity,
    price: stock.price,
    partId: String(stock.partId),
    part: stock.part ? mapPartRecord(stock.part) : undefined,
  };
}

export function mapPartRecord(part) {
  return {
    id: String(part.id),
    name: part.name,
    description: part.description,
    activeStatus: part.activeStatus,
    vehicleModelId: String(part.vehicleModelId),
    vehicleModel: part.vehicleModel ? mapVehicleModel(part.vehicleModel) : undefined,
    stocks: (part.stocks ?? []).map((s) => ({
      id: String(s.id),
      quantity: s.quantity,
      price: s.price,
      partId: String(s.partId),
    })),
  };
}

export function buildPartCatalogWhere(query = {}) {
  const makeId = query.makeId != null ? Number(query.makeId) : null;
  const vehicleModelId = query.vehicleModelId != null ? Number(query.vehicleModelId) : null;
  const search = String(query.search ?? "").trim();
  const hasStock = query.hasStock;

  const filters = [{ activeStatus: 1 }];

  if (vehicleModelId && !Number.isNaN(vehicleModelId)) {
    filters.push({ vehicleModelId });
  } else if (makeId && !Number.isNaN(makeId)) {
    filters.push({ vehicleModel: { makeId } });
  }

  if (hasStock === "true") {
    filters.push({ stocks: { some: {} } });
  } else if (hasStock === "false") {
    filters.push({ stocks: { none: {} } });
  }

  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { vehicleModel: { name: { contains: search, mode: "insensitive" } } },
        { vehicleModel: { make: { name: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

/** Prisma filter for VehicleModel from a full display name (e.g. Toyota C-HR). */
export function buildVehicleModelFilter(fullVehicleName) {
  const trimmed = String(fullVehicleName ?? "").trim();
  if (!trimmed) return null;

  const { make, model: modelName } = splitMakeModel(trimmed);
  if (!make || !modelName) {
    return { name: { equals: trimmed, mode: "insensitive" } };
  }

  return {
    name: { equals: modelName, mode: "insensitive" },
    make: { name: { equals: make, mode: "insensitive" } },
  };
}


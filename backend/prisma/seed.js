import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { directDatabaseUrl } from "../src/config/databaseUrl.js";
import { splitMakeModel } from "../src/utils/vehicleCatalog.js";

dotenv.config();

const seedUrl = process.env.DIRECT_URL || directDatabaseUrl(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  datasources: {
    db: { url: seedUrl },
  },
});
const ADMIN = {
  name: process.env.ADMIN_NAME ?? "System Admin",
  email: (process.env.ADMIN_EMAIL ?? "admin@workshop.local").toLowerCase(),
  password: process.env.ADMIN_PASSWORD ?? "Admin@123",
  role: "ADMIN",
};

const WORKSHOP = {
  name: process.env.WORKSHOP_NAME ?? "Auckland Auto Repairs",
  email: (process.env.WORKSHOP_EMAIL ?? "workshop@workshop.local").toLowerCase(),
  password: process.env.WORKSHOP_PASSWORD ?? "Workshop@123",
  role: "WORKSHOP",
};

const SUPPLIER = {
  name: process.env.SUPPLIER_NAME ?? "NZ Parts Supply",
  email: (process.env.SUPPLIER_EMAIL ?? "supplier@workshop.local").toLowerCase(),
  password: process.env.SUPPLIER_PASSWORD ?? "Supplier@123",
  role: "SUPPLIER",
};

const VEHICLE_MODELS = [
  "Toyota Aqua",
  "Toyota Prius",
  "Toyota Yaris",
  "Toyota Corolla",
  "Toyota Camry",
  "Toyota C-HR",
  "Toyota RAV4",
  "Toyota Highlander",
  "Toyota Land Cruiser Prado",
  "Toyota Hilux",
  "Toyota 86",
  "Toyota GR86",
  "Toyota Supra",
  "Mazda Demio",
  "Mazda Axela",
  "Mazda Atenza",
  "Mazda CX-3",
  "Mazda CX-5",
  "Mazda CX-8",
  "Mazda MX-5",
  "Nissan Leaf",
  "Nissan Note",
  "Nissan Tiida",
  "Nissan X-Trail",
  "Nissan Qashqai",
  "Nissan Navara",
  "Nissan 350Z",
  "Nissan 370Z",
  "Nissan Serena",
  "Nissan Caravan",
  "Nissan Elgrand",
  "Honda Fit",
  "Honda Jazz",
  "Honda Civic",
  "Honda Accord",
  "Honda CR-V",
  "Honda Vezel",
  "Mitsubishi Mirage",
  "Mitsubishi Outlander",
  "Mitsubishi ASX",
  "Mitsubishi Triton",
  "Mitsubishi Pajero",
  "Mitsubishi Delica",
  "Mitsubishi Eclipse Cross",
  "Ford Ranger",
  "Ford Everest",
  "Ford Escape",
  "Ford Focus",
  "Ford Mustang",
  "Ford Transit",
  "Ford Transit Custom",
  "Hyundai i30",
  "Hyundai Kona",
  "Hyundai Tucson",
  "Hyundai Santa Fe",
  "Hyundai Ioniq",
  "Hyundai Staria",
  "Hyundai iLoad",
  "Kia Cerato",
  "Kia Seltos",
  "Kia Sportage",
  "Kia Sorento",
  "Kia Carnival",
  "Subaru Impreza",
  "Subaru XV",
  "Subaru Forester",
  "Subaru Outback",
  "Subaru WRX",
  "Subaru WRX STI",
  "Subaru BRZ",
  "Suzuki Swift",
  "Suzuki Vitara",
  "Suzuki S-Cross",
  "Suzuki Jimny",
  "Volkswagen Golf",
  "Volkswagen Golf GTI",
  "Volkswagen Tiguan",
  "Volkswagen Passat",
  "Volkswagen Transporter",
  "Volkswagen Caddy",
  "Volkswagen Crafter",
  "BMW 1 Series",
  "BMW 3 Series",
  "BMW X1",
  "BMW X3",
  "BMW M3",
  "Mercedes-Benz A-Class",
  "Mercedes-Benz C-Class",
  "Mercedes-Benz GLC",
  "Mercedes-Benz Sprinter",
  "Mercedes-Benz Vito",
  "Mercedes-Benz V-Class",
];

const CATALOG_PARTS = [
  "Front Bumper",
  "Front Bumper Reinforcement Bar",
  "Front Grille",
  "Bonnet / Hood",
  "Left Headlight",
  "Right Headlight",
  "Left Front Fender",
  "Right Front Fender",
  "Radiator Support Panel",
  "Radiator",
  "AC Condenser",
  "Front Under Tray",
  "Left Front Door",
  "Right Front Door",
  "Left Rear Door",
  "Right Rear Door",
  "Left Side Mirror",
  "Right Side Mirror",
  "Left Side Skirt",
  "Right Side Skirt",
  "Left Quarter Panel",
  "Right Quarter Panel",
  "Rear Bumper",
  "Rear Bumper Reinforcement Bar",
  "Left Tail Light",
  "Right Tail Light",
  "Boot / Trunk Lid",
  "Rear Glass / Windshield",
  "Rear Panel / Tail Panel",
  "Roof Panel",
  "A Pillar Left",
  "A Pillar Right",
  "B Pillar Left",
  "B Pillar Right",
  "C Pillar Left",
  "C Pillar Right",
  "D Pillar Left",
  "D Pillar Right",
  "Chassis Rail Left",
  "Chassis Rail Right",
  "Floor Pan",
  "Front Subframe",
  "Rear Subframe",
  "Left Wheel Arch",
  "Right Wheel Arch",
  "Left Alloy Wheel",
  "Right Alloy Wheel",
  "Spare Wheel",
  "Tyre",
  "Wheel Arch Liner Left",
  "Wheel Arch Liner Right",
  "Mud Flap Left",
  "Mud Flap Right",
  "Front Fog Light Left",
  "Front Fog Light Right",
  "Rear Fog Light Left",
  "Rear Fog Light Right",
  "Indicator Light Front Left",
  "Indicator Light Front Right",
  "Indicator Light Rear Left",
  "Indicator Light Rear Right",
  "Side Indicator Left",
  "Side Indicator Right",
  "Daytime Running Light Left",
  "Daytime Running Light Right",
  "Front Windshield",
  "Left Front Door Glass",
  "Right Front Door Glass",
  "Left Rear Door Glass",
  "Right Rear Door Glass",
  "Rear Door Glass / Quarter Glass Left",
  "Rear Door Glass / Quarter Glass Right",
  "Number Plate Front",
  "Number Plate Rear",
  "Number Plate Light Front",
  "Number Plate Light Rear",
  "Front Bumper Sensor",
  "Rear Bumper Sensor",
  "Parking Camera Front",
  "Parking Camera Rear",
  "Side Moulding Left",
  "Side Moulding Right",
  "Door Handle Left Front",
  "Door Handle Right Front",
  "Door Handle Left Rear",
  "Door Handle Right Rear",
  "Roof Rail Left",
  "Roof Rail Right",
  "Sunroof Glass",
  "Emblem Front",
  "Emblem Rear",
  "Chrome Trim Front",
  "Chrome Trim Rear",
];

async function migrateLegacyVehicleModels() {
  let models = [];
  try {
    models = await prisma.vehicleModel.findMany({
      where: { makeId: null },
    });
  } catch {
    return;
  }

  if (!models.length) return;

  for (const model of models) {
    if (!model.name.includes(" ")) continue;
    const { make, model: modelName } = splitMakeModel(model.name);
    if (!make || !modelName) continue;

    const makeRecord = await prisma.vehicleMake.upsert({
      where: { name: make },
      update: {},
      create: { name: make },
    });

    const existing = await prisma.vehicleModel.findFirst({
      where: { makeId: makeRecord.id, name: modelName },
    });

    if (existing && existing.id !== model.id) {
      await prisma.part.updateMany({
        where: { vehicleModelId: model.id },
        data: { vehicleModelId: existing.id },
      });
      await prisma.vendorVehicleModel.updateMany({
        where: { vehicleModelId: model.id },
        data: { vehicleModelId: existing.id },
      }).catch(() => {});
      await prisma.vehicleModel.delete({ where: { id: model.id } });
      continue;
    }

    await prisma.vehicleModel.update({
      where: { id: model.id },
      data: { makeId: makeRecord.id, name: modelName },
    });
  }

  console.log(`Migrated ${models.length} legacy vehicle model(s) to make + model structure.`);
}

async function upsertCatalogModel(fullName) {
  const { make, model: modelName } = splitMakeModel(fullName);
  const makeRecord = await prisma.vehicleMake.upsert({
    where: { name: make },
    update: {},
    create: { name: make },
  });

  return prisma.vehicleModel.upsert({
    where: { makeId_name: { makeId: makeRecord.id, name: modelName } },
    update: {},
    create: { makeId: makeRecord.id, name: modelName },
  });
}

async function seedCatalog() {
  await migrateLegacyVehicleModels();

  for (const name of VEHICLE_MODELS) {
    const model = await upsertCatalogModel(name);

    const existingParts = await prisma.part.findMany({
      where: {
        vehicleModelId: model.id,
        activeStatus: 1,
        name: { in: CATALOG_PARTS },
      },
    });
    const existingNames = new Set(existingParts.map((p) => p.name));

    const partsToCreate = CATALOG_PARTS.filter((partName) => !existingNames.has(partName));
    if (partsToCreate.length > 0) {
      await prisma.part.createMany({
        data: partsToCreate.map((partName) => ({
          name: partName,
          vehicleModelId: model.id,
        })),
        skipDuplicates: true,
      });
    }

    const parts = await prisma.part.findMany({
      where: {
        vehicleModelId: model.id,
        activeStatus: 1,
        name: { in: CATALOG_PARTS },
      },
    });

    const partIds = [...new Set(parts.map((p) => p.id))];
    const existingStocks = await prisma.stock.findMany({
      where: { partId: { in: partIds } },
      select: { partId: true },
    });
    const stockedPartIds = new Set(existingStocks.map((s) => s.partId));

    const stocksToCreate = partIds
      .filter((partId) => !stockedPartIds.has(partId))
      .map((partId) => ({ partId, quantity: 0, price: 0 }));

    if (stocksToCreate.length > 0) {
      await prisma.stock.createMany({ data: stocksToCreate, skipDuplicates: true });
    }

    if (partIds.length > 0) {
      await prisma.stock.updateMany({
        where: { partId: { in: partIds } },
        data: { quantity: 0, price: 0 },
      });
    }
  }

  console.log(
    `Catalog seeded: ${VEHICLE_MODELS.length} vehicle models, ${CATALOG_PARTS.length} parts per model (stock qty/price 0).`,
  );
}

async function seedVendors() {
  const vendors = [
    {
      companyName: "Auto Parts NZ Ltd",
      contactPerson: "James Wilson",
      email: "quotes@autopartsnz.co.nz",
      address: "12 Industrial Rd, Auckland",
      contactNumber: "+64 9 555 0101",
    },
    {
      companyName: "Pacific Spares Co.",
      contactPerson: "Sarah Chen",
      email: "sales@pacificspares.co.nz",
      address: "45 Harbor Drive, Wellington",
      contactNumber: "+64 4 555 0202",
    },
    {
      companyName: "Ceylon Auto Supplies",
      contactPerson: "Ravi Perera",
      email: "vendor@ceylonauto.co.nz",
      address: "78 Queen Street, Christchurch",
      contactNumber: "+64 3 555 0303",
    },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { email: v.email },
      update: {},
      create: { ...v, status: "ACTIVE" },
    });
  }
  console.log("Sample vendors seeded.");
}

async function seedUser({ name, email, password, role }, label) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${label} user already exists: ${email}`);
    return;
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
  });
  console.log(`${label} user created:`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name:  ${user.name}`);
  console.log(`  Role:  ${user.role}`);
}

async function main() {
  await seedUser(ADMIN, "Admin");
  await seedUser(WORKSHOP, "Workshop");
  await seedUser(SUPPLIER, "Supplier");
  await seedCatalog();
  await seedVendors();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

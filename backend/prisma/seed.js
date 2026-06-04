import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { directDatabaseUrl } from "../src/config/databaseUrl.js";

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

async function seedCatalog() {
  const models = [
    {
      name: "Toyota CHR",
      parts: [
        { name: "Front Bumper", description: "OEM front bumper assembly", qty: 12, price: 999 },
        { name: "Headlight", description: "Left headlight assembly", qty: 0, price: 150 },
      ],
    },
    {
      name: "Toyota GT86",
      parts: [{ name: "Brake Pads", description: "Front brake pad set", qty: 24, price: 89.99 }],
    },
  ];

  for (const { name, parts } of models) {
    const model = await prisma.vehicleModel.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    for (const part of parts) {
      const existing = await prisma.part.findFirst({
        where: { name: part.name, vehicleModelId: model.id, activeStatus: 1 },
      });
      const row =
        existing ??
        (await prisma.part.create({
          data: {
            name: part.name,
            description: part.description,
            vehicleModelId: model.id,
          },
        }));

      await prisma.stock.upsert({
        where: { partId: row.id },
        update: { quantity: part.qty, price: part.price },
        create: { partId: row.id, quantity: part.qty, price: part.price },
      });
    }
  }

  console.log("Sample vehicle models, parts, and stock seeded.");
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
}

main()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

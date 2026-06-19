import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const corsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];
if (process.env.APP_URL) corsOrigins.push(process.env.APP_URL);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "20mb" }));

// routes
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import workshopRoutes from "./routes/workshop.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import vendorQuotationRoutes from "./routes/vendorQuotation.routes.js";
import publicRoutes from "./routes/public.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/vendor-quotation", vendorQuotationRoutes);
app.use("/api/public", publicRoutes);
export default app;
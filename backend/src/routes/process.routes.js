import express from "express";

import { repairAgent } from "../agents/repair.agent.js";

import { authMiddleware }
from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  async (req, res) => {

    const result =
      await repairAgent(req.body.text);

    res.json(result);
  }
);

export default router;
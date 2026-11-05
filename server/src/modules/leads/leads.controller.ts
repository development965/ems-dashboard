import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  addLeadActivitySchema,
  convertLeadSchema,
  createLeadSchema,
  leadFiltersSchema,
  leadFunnelFiltersSchema,
  updateLeadSchema,
} from "@/modules/leads/leads.schema.js";
import * as leadsService from "@/modules/leads/leads.service.js";

export const listLeadsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = leadFiltersSchema.parse(req.query);
  const leads = await leadsService.listLeads(req.user!, filters);
  res.json({ leads });
});

export const getLeadHandler = asyncHandler(async (req: Request, res: Response) => {
  const lead = await leadsService.getLead(req.user!, req.params.id);
  res.json({ lead });
});

export const createLeadHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createLeadSchema.parse(req.body);
  const lead = await leadsService.createLead(req.user!, input);
  res.status(201).json({ lead });
});

export const updateLeadHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateLeadSchema.parse(req.body);
  const lead = await leadsService.updateLead(req.user!, req.params.id, input);
  res.json({ lead });
});

export const addLeadActivityHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = addLeadActivitySchema.parse(req.body);
  const activity = await leadsService.addLeadActivity(req.user!, req.params.id, input);
  res.status(201).json({ activity });
});

export const convertLeadHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = convertLeadSchema.parse(req.body);
  const student = await leadsService.convertLead(req.user!, req.params.id, input);
  res.status(201).json({ student });
});

export const getLeadFunnelHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters = leadFunnelFiltersSchema.parse(req.query);
  const funnel = await leadsService.getLeadFunnel(req.user!, filters);
  res.json(funnel);
});

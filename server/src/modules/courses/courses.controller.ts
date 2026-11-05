import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  createCourseSchema,
  createFeeStructureSchema,
  updateCourseSchema,
  updateFeeStructureSchema,
} from "@/modules/courses/courses.schema.js";
import * as coursesService from "@/modules/courses/courses.service.js";

export const listCoursesHandler = asyncHandler(async (req: Request, res: Response) => {
  const courses = await coursesService.listCourses(req.user!);
  res.json({ courses });
});

export const getCourseHandler = asyncHandler(async (req: Request, res: Response) => {
  const course = await coursesService.getCourse(req.user!, req.params.id);
  res.json({ course });
});

export const createCourseHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createCourseSchema.parse(req.body);
  const course = await coursesService.createCourse(req.user!, input);
  res.status(201).json({ course });
});

export const updateCourseHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateCourseSchema.parse(req.body);
  const course = await coursesService.updateCourse(req.user!, req.params.id, input);
  res.json({ course });
});

export const deleteCourseHandler = asyncHandler(async (req: Request, res: Response) => {
  await coursesService.deleteCourse(req.user!, req.params.id);
  res.status(204).send();
});

export const addFeeStructureHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createFeeStructureSchema.parse(req.body);
  const feeStructure = await coursesService.addFeeStructure(req.user!, req.params.id, input);
  res.status(201).json({ feeStructure });
});

export const updateFeeStructureHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateFeeStructureSchema.parse(req.body);
  const feeStructure = await coursesService.updateFeeStructure(req.user!, req.params.id, req.params.feeId, input);
  res.json({ feeStructure });
});

export const deleteFeeStructureHandler = asyncHandler(async (req: Request, res: Response) => {
  await coursesService.deleteFeeStructure(req.user!, req.params.id, req.params.feeId);
  res.status(204).send();
});

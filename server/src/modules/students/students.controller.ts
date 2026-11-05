import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { AppError } from "@/utils/AppError.js";
import { toPublicUploadUrl } from "@/middleware/upload.js";
import { createStudentSchema, updateStudentSchema } from "@/modules/students/students.schema.js";
import * as studentsService from "@/modules/students/students.service.js";

export const listStudentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const students = await studentsService.listStudents(req.user!, { courseId, status, search });
  res.json({ students });
});

export const getStudentHandler = asyncHandler(async (req: Request, res: Response) => {
  const student = await studentsService.getStudent(req.user!, req.params.id);
  res.json({ student });
});

export const createStudentHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createStudentSchema.parse(req.body);
  const student = await studentsService.createStudent(req.user!, input);
  res.status(201).json({ student });
});

export const updateStudentHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateStudentSchema.parse(req.body);
  const student = await studentsService.updateStudent(req.user!, req.params.id, input);
  res.json({ student });
});

export const uploadStudentDocumentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { photo?: Express.Multer.File[]; idProof?: Express.Multer.File[] } | undefined;
  if (!files?.photo && !files?.idProof) {
    throw new AppError('Attach at least one file ("photo" and/or "idProof")', 422);
  }

  const student = await studentsService.saveStudentDocuments(req.user!, req.params.id, {
    photoUrl: files.photo?.[0] ? toPublicUploadUrl(files.photo[0].path) : undefined,
    idProofUrl: files.idProof?.[0] ? toPublicUploadUrl(files.idProof[0].path) : undefined,
  });
  res.json({ student });
});

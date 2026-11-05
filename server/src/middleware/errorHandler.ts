import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError } from "@/utils/AppError.js";
import { env } from "@/config/env.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  // A streaming response (e.g. the backup download) may already have sent headers/data before
  // failing partway through — Express can't layer a JSON error on top of that, so hand off to
  // its default handler, which just closes the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: "Validation failed", details: err.flatten() });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof MulterError) {
    res.status(422).json({ error: `Upload failed: ${err.message}` });
    return;
  }

  // Thrown by our upload.ts fileFilter for unsupported file types.
  if (err instanceof Error && err.message.startsWith("Unsupported file type")) {
    res.status(422).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    ...(env.NODE_ENV === "development" && err instanceof Error ? { detail: err.message, stack: err.stack } : {}),
  });
}

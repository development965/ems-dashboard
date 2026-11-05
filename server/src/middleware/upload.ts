import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import type { Request } from "express";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const STUDENTS_DIR = path.join(UPLOADS_ROOT, "students");
const PETTY_CASH_DIR = path.join(UPLOADS_ROOT, "petty-cash");

// Includes HEIC/HEIF — the default format for photos straight off an iPhone camera, which
// would otherwise silently fail every upload for anyone using one.
const allowedByField: Record<string, RegExp> = {
  photo: /^image\/(jpeg|png|webp|heic|heif)$/,
  idProof: /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/,
};
const allowedExtByField: Record<string, RegExp> = {
  photo: /\.(jpe?g|png|webp|heic|heif)$/i,
  idProof: /\.(jpe?g|png|webp|heic|heif|pdf)$/i,
};

const storage = multer.diskStorage({
  destination: (req: Request, _file, callback) => {
    const dir = path.join(STUDENTS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

export const uploadStudentDocuments = multer({
  storage,
  // 5MB was too tight for an unedited phone camera photo — bumped to 15MB.
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    const mimePattern = allowedByField[file.fieldname];
    const extPattern = allowedExtByField[file.fieldname];
    // Browsers/OSes report HEIC (and sometimes other) files with an unhelpful generic mimetype
    // like "application/octet-stream" — fall back to the file extension in that case rather
    // than reject a genuinely fine file over a mislabeled mimetype.
    const mimeOk = Boolean(mimePattern?.test(file.mimetype));
    const extOk = Boolean(extPattern?.test(file.originalname));
    if (!mimeOk && !extOk) {
      callback(new Error(`Unsupported file type for "${file.fieldname}": ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "photo", maxCount: 1 },
  { name: "idProof", maxCount: 1 },
]);

const receiptStorage = multer.diskStorage({
  destination: (req: Request, _file, callback) => {
    const dir = path.join(PETTY_CASH_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `receipt-${Date.now()}${ext}`);
  },
});

const receiptMimePattern = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const receiptExtPattern = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

export const uploadPettyCashReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const mimeOk = receiptMimePattern.test(file.mimetype);
    const extOk = receiptExtPattern.test(file.originalname);
    if (!mimeOk && !extOk) {
      callback(new Error(`Unsupported file type for receipt: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).single("receipt");

// The entry doesn't have an id yet when its bill is uploaded alongside creation — file this
// under a fresh random folder rather than one keyed by an entry id that doesn't exist yet.
const newEntryReceiptStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const dir = path.join(PETTY_CASH_DIR, crypto.randomUUID());
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `receipt-${Date.now()}${ext}`);
  },
});

export const uploadNewPettyCashReceipt = multer({
  storage: newEntryReceiptStorage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const mimeOk = receiptMimePattern.test(file.mimetype);
    const extOk = receiptExtPattern.test(file.originalname);
    if (!mimeOk && !extOk) {
      callback(new Error(`Unsupported file type for receipt: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).single("receipt");

/** Path on disk -> URL the client can fetch, given app.ts serves UPLOADS_ROOT at /uploads. */
export function toPublicUploadUrl(absolutePath: string): string {
  return `/uploads/${path.relative(UPLOADS_ROOT, absolutePath).split(path.sep).join("/")}`;
}

/**
 * Imports the students originally skipped from the bulk import because their course had
 * no verified fee-catalog price at their branch — excluding TALLY per explicit instruction.
 * totalFee here is a best-effort estimate (max receipt totalFees, floored at paid+discount),
 * not a verified catalog price — flagged in each student's notes for manual review.
 *
 * Reuses existing Courses/Batches (all course names already exist in our catalog); only
 * creates new Student/Payment/Discount rows. Safe to re-run — skips any register_no already
 * present (matched via the notes field, same convention as the main import).
 *
 * Run: npx tsx scripts/import-gap-students.ts
 */
import fs from "node:fs";
import { PrismaClient, type PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

const IMPORT_PATH =
  "/private/tmp/claude-501/-Users-prahaladhsrikanth-Desktop-Techmaax-TM-EMS-NewWorking/caad82e2-212d-4b25-b595-9b3fb4fd0048/scratchpad/legacy_import/preview/gap_import.json";

interface GapPayload {
  batches: { branch_code: string; course_code: string; name: string }[];
  students: {
    branch_code: string;
    course_code: string;
    batch_name: string;
    name: string;
    phone: string;
    location: string;
    totalFee: number;
    status: string;
    createdAt: string;
    notes: string;
    payments: { amount: number; method: string; paidAt: string; notes: string }[];
    discounts: { amount: number; reason: string; createdAt: string }[];
  }[];
}

function mapMethod(m: string): PaymentMethod {
  if (m === "CASH" || m === "BANK_TRANSFER" || m === "OTHER" || m === "RAZORPAY_LINK") return m;
  return "OTHER";
}

async function main() {
  const payload: GapPayload = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf-8"));

  const company = await prisma.company.findFirstOrThrow();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const branchByCode = new Map(branches.map((b) => [b.code, b]));
  const courses = await prisma.course.findMany({ where: { companyId: company.id } });
  const courseIdByCode = new Map(courses.map((c) => [c.code, c.id]));

  const alreadyImported = new Set(
    (await prisma.student.findMany({ where: { companyId: company.id }, select: { notes: true } })).map((s) => s.notes),
  );

  const batchIdByKey = new Map<string, string>();
  for (const b of payload.batches) {
    const branch = branchByCode.get(b.branch_code);
    const courseId = courseIdByCode.get(b.course_code);
    if (!branch || !courseId) continue;
    const batch = await prisma.batch.upsert({
      where: { branchId_courseId_name: { branchId: branch.id, courseId, name: b.name } },
      update: {},
      create: { companyId: company.id, branchId: branch.id, courseId, name: b.name, mode: "OFFLINE", schedule: b.name },
    });
    batchIdByKey.set(`${b.branch_code}|${b.course_code}|${b.name}`, batch.id);
  }

  let created = 0;
  let skippedExisting = 0;
  let paymentsCreated = 0;
  let discountsCreated = 0;

  for (const s of payload.students) {
    if (alreadyImported.has(s.notes)) {
      skippedExisting++;
      continue;
    }
    const branch = branchByCode.get(s.branch_code);
    const courseId = courseIdByCode.get(s.course_code);
    if (!branch || !courseId) continue;
    const batchId = batchIdByKey.get(`${s.branch_code}|${s.course_code}|${s.batch_name}`) ?? null;

    const student = await prisma.student.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        courseId,
        batchId,
        name: s.name,
        phone: s.phone,
        location: s.location,
        mode: "OFFLINE",
        totalFee: s.totalFee,
        status: s.status as "ENROLLED" | "COMPLETED" | "DROPPED",
        notes: s.notes,
        createdById: admin.id,
        createdAt: new Date(s.createdAt),
      },
    });
    created++;

    for (const p of s.payments) {
      await prisma.payment.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          studentId: student.id,
          amount: p.amount,
          method: mapMethod(p.method),
          paidAt: new Date(p.paidAt),
          recordedById: admin.id,
          notes: p.notes,
        },
      });
      paymentsCreated++;
    }
    for (const d of s.discounts) {
      await prisma.discount.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          studentId: student.id,
          amount: d.amount,
          reason: d.reason,
          approvedById: admin.id,
          createdAt: new Date(d.createdAt),
        },
      });
      discountsCreated++;
    }
  }

  console.log(`Students created: ${created}`);
  console.log(`Skipped (already imported): ${skippedExisting}`);
  console.log(`Payments: ${paymentsCreated}`);
  console.log(`Discounts: ${discountsCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

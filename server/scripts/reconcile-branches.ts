/**
 * Focused reconciliation for specific branches: compares the freshly-rebuilt legacy-ERP
 * payload against what's actually in our DB for just those branches, and prints every
 * concrete gap (missing student, missing payment, missing discount) rather than aggregate
 * counts, which can look mismatched even when nothing is actually missing (e.g. organic
 * payments recorded directly in the new EMS that never existed in the legacy ERP at all).
 *
 * Run: npx tsx scripts/reconcile-branches.ts <branch_code> [<branch_code> ...]
 * Read-only — never writes anything.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMPORT_PATH =
  "/private/tmp/claude-501/-Users-prahaladhsrikanth-Desktop-Techmaax-TM-EMS-NewWorking/caad82e2-212d-4b25-b595-9b3fb4fd0048/scratchpad/legacy_import/preview/final_import.json";

interface ImportPayload {
  students: {
    branch_code: string;
    course_code: string;
    name: string;
    notes: string;
    totalFee: number;
    payments: { amount: number; method: string; paidAt: string; notes: string }[];
    discounts: { amount: number; reason: string; createdAt: string }[];
  }[];
}

async function main() {
  const branchCodes = process.argv.slice(2);
  if (branchCodes.length === 0) throw new Error("Usage: reconcile-branches.ts <branch_code> [<branch_code> ...]");

  const payload: ImportPayload = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf-8"));
  const scoped = payload.students.filter((s) => branchCodes.includes(s.branch_code));

  const company = await prisma.company.findFirstOrThrow();
  const branches = await prisma.branch.findMany({ where: { companyId: company.id, code: { in: branchCodes } } });
  const branchIds = branches.map((b) => b.id);

  const existingStudents = await prisma.student.findMany({
    where: { companyId: company.id, branchId: { in: branchIds } },
    select: {
      id: true,
      name: true,
      notes: true,
      course: { select: { code: true } },
      payments: { select: { amount: true, notes: true } },
      discounts: { select: { amount: true, reason: true } },
    },
  });
  const studentByKey = new Map(existingStudents.map((s) => [`${s.notes}|${s.course.code}`, s]));

  let missingStudents = 0;
  let missingStudentPayments = 0;
  let missingStudentPaymentsAmount = 0;
  let missingPaymentsForExisting = 0;
  let missingPaymentsAmount = 0;
  let missingDiscountsForExisting = 0;
  let missingDiscountsAmount = 0;
  const missingStudentDetails: string[] = [];
  const missingPaymentDetails: string[] = [];

  for (const s of scoped) {
    const key = `${s.notes}|${s.course_code}`;
    const existing = studentByKey.get(key);

    if (!existing) {
      missingStudents++;
      missingStudentPayments += s.payments.length;
      const amt = s.payments.reduce((sum, p) => sum + p.amount, 0);
      missingStudentPaymentsAmount += amt;
      missingStudentDetails.push(`  MISSING STUDENT: ${s.name} (${s.course_code}) — ${s.payments.length} receipt(s), ₹${amt.toLocaleString("en-IN")}`);
      continue;
    }

    const existingPaymentKeys = new Set(existing.payments.map((p) => `${p.notes}|${p.amount}`));
    const existingDiscountKeys = new Set(existing.discounts.map((d) => `${d.reason}|${d.amount}`));
    const newPayments = s.payments.filter((p) => !existingPaymentKeys.has(`${p.notes}|${p.amount}`));
    const newDiscounts = s.discounts.filter((d) => !existingDiscountKeys.has(`${d.reason}|${d.amount}`));

    for (const p of newPayments) {
      missingPaymentsForExisting++;
      missingPaymentsAmount += p.amount;
      missingPaymentDetails.push(`  MISSING RECEIPT: ₹${p.amount.toLocaleString("en-IN")} for ${s.name} (${p.notes})`);
    }
    for (const d of newDiscounts) {
      missingDiscountsForExisting++;
      missingDiscountsAmount += d.amount;
    }
  }

  console.log(`Branches checked: ${branchCodes.join(", ")}`);
  console.log(`Students in legacy pull for these branches: ${scoped.length}`);
  console.log(`Students already in our DB for these branches: ${existingStudents.length}`);
  console.log();
  console.log(`MISSING students entirely: ${missingStudents} (${missingStudentPayments} receipts, ₹${missingStudentPaymentsAmount.toLocaleString("en-IN")})`);
  console.log(`MISSING receipts for already-imported students: ${missingPaymentsForExisting} totaling ₹${missingPaymentsAmount.toLocaleString("en-IN")}`);
  console.log(`MISSING discounts for already-imported students: ${missingDiscountsForExisting} totaling ₹${missingDiscountsAmount.toLocaleString("en-IN")}`);
  console.log();
  missingStudentDetails.forEach((l) => console.log(l));
  missingPaymentDetails.forEach((l) => console.log(l));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

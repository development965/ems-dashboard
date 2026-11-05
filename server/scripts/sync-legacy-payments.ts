/**
 * Incremental sync: finds payment/discount receipts in the freshly-rebuilt
 * final_import.json that aren't already in our DB for students we previously
 * imported, and inserts only those. Dedup key: (studentId, notes, amount) —
 * the notes we write on import embed the exact legacy receipt date, so a
 * receipt already imported will always match and be skipped.
 *
 * Does NOT create new students/courses/batches — those only ever come from
 * the one-time bulk import. This script only catches late/backdated receipts
 * added to the legacy system for students we already have.
 *
 * Run: npx tsx scripts/sync-legacy-payments.ts [--apply]
 * Without --apply, it only prints what it would do (dry run).
 */
import fs from "node:fs";
import { PrismaClient, type PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

const IMPORT_PATH =
  "/private/tmp/claude-501/-Users-prahaladhsrikanth-Desktop-Techmaax-TM-EMS-NewWorking/caad82e2-212d-4b25-b595-9b3fb4fd0048/scratchpad/legacy_import/preview/final_import.json";

interface ImportPayload {
  students: {
    branch_code: string;
    course_code: string;
    batch_name: string;
    name: string;
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
  const apply = process.argv.includes("--apply");
  const payload: ImportPayload = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf-8"));

  const company = await prisma.company.findFirstOrThrow();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const branchByCode = new Map(branches.map((b) => [b.code, b]));

  // Match existing students by notes + course — notes alone ("Legacy ERP register no: X
  // (branch: Y)") is NOT unique: a register_no can cover more than one course enrollment
  // (67 such people in the original import), producing two Student rows with identical
  // notes. Keying by notes alone would collide and silently misattribute receipts between
  // a person's different course enrollments — course must be part of the key.
  const existingStudents = await prisma.student.findMany({
    where: { companyId: company.id, notes: { startsWith: "Legacy ERP register no:" } },
    select: {
      id: true,
      notes: true,
      course: { select: { code: true } },
      payments: { select: { amount: true, notes: true } },
      discounts: { select: { amount: true, reason: true } },
    },
  });
  const studentByKey = new Map(existingStudents.map((s) => [`${s.notes}|${s.course.code}`, s]));

  let newPaymentsTotal = 0;
  let newDiscountsTotal = 0;
  let newPaymentsCount = 0;
  let newDiscountsCount = 0;
  let studentsAffected = 0;
  const skippedNoMatch: string[] = [];
  const sample: string[] = [];

  for (const s of payload.students) {
    const key = `${s.notes}|${s.course_code}`;
    const existing = studentByKey.get(key);
    if (!existing) {
      skippedNoMatch.push(key);
      continue;
    }

    const existingPaymentKeys = new Set(existing.payments.map((p) => `${p.notes}|${p.amount}`));
    const existingDiscountKeys = new Set(existing.discounts.map((d) => `${d.reason}|${d.amount}`));

    const newPayments = s.payments.filter((p) => !existingPaymentKeys.has(`${p.notes}|${p.amount}`));
    const newDiscounts = s.discounts.filter((d) => !existingDiscountKeys.has(`${d.reason}|${d.amount}`));

    if (newPayments.length === 0 && newDiscounts.length === 0) continue;
    studentsAffected++;

    for (const p of newPayments) {
      newPaymentsTotal += p.amount;
      newPaymentsCount++;
      if (sample.length < 10) sample.push(`+ Payment ₹${p.amount} (${p.method}, ${p.paidAt.slice(0, 10)}) for ${s.name}`);
      if (apply) {
        const branch = branchByCode.get(s.branch_code)!;
        await prisma.payment.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            studentId: existing.id,
            amount: p.amount,
            method: mapMethod(p.method),
            paidAt: new Date(p.paidAt),
            recordedById: admin.id,
            notes: p.notes,
          },
        });
      }
    }
    for (const d of newDiscounts) {
      newDiscountsTotal += d.amount;
      newDiscountsCount++;
      if (sample.length < 10) sample.push(`+ Discount ₹${d.amount} for ${s.name}`);
      if (apply) {
        const branch = branchByCode.get(s.branch_code)!;
        await prisma.discount.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            studentId: existing.id,
            amount: d.amount,
            reason: d.reason,
            approvedById: admin.id,
            createdAt: new Date(d.createdAt),
          },
        });
      }
    }
  }

  console.log(`Mode: ${apply ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}`);
  console.log(`Students affected: ${studentsAffected}`);
  console.log(`New payments: ${newPaymentsCount} totaling ₹${newPaymentsTotal.toLocaleString("en-IN")}`);
  console.log(`New discounts: ${newDiscountsCount} totaling ₹${newDiscountsTotal.toLocaleString("en-IN")}`);
  console.log(`Students in fresh pull with no matching existing record (likely new-this-month, already excluded): ${skippedNoMatch.length}`);
  console.log("\nSample of changes:");
  sample.forEach((s) => console.log("  " + s));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

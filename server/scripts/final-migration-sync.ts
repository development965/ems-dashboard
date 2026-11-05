/**
 * Final migration pass — the legacy ERP is being retired, so this brings in everything
 * up to today with no month cutoff. For each student in the freshly-built payload:
 *   - if they don't exist yet in our DB (matched by notes+course, since a register_no can
 *     cover more than one course enrollment), create them + their payments/discounts.
 *   - if they already exist, add only payments/discounts not already on file (same
 *     notes+amount dedup key proven safe in sync-legacy-payments.ts).
 * Never modifies or removes an existing record — additive only.
 *
 * Run: npx tsx scripts/final-migration-sync.ts [--apply]
 * Without --apply, prints what it would do (dry run).
 */
import fs from "node:fs";
import { PrismaClient, type PaymentMethod } from "@prisma/client";

const prisma = new PrismaClient();

const IMPORT_PATH =
  "/private/tmp/claude-501/-Users-prahaladhsrikanth-Desktop-Techmaax-TM-EMS-NewWorking/caad82e2-212d-4b25-b595-9b3fb4fd0048/scratchpad/legacy_import/preview/final_import.json";

interface ImportPayload {
  courses: { name: string; code: string; fee_structures: { label: string; amount: number }[] }[];
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
  const apply = process.argv.includes("--apply");
  const payload: ImportPayload = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf-8"));

  const company = await prisma.company.findFirstOrThrow();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const branchByCode = new Map(branches.map((b) => [b.code, b]));

  // courses: all already exist from the original import, but upsert defensively
  const courseIdByCode = new Map<string, string>();
  for (const c of payload.courses) {
    const course = await prisma.course.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { companyId: company.id, name: c.name, code: c.code },
    });
    courseIdByCode.set(c.code, course.id);
  }

  const batchIdByKey = new Map<string, string>();
  for (const b of payload.batches) {
    const branch = branchByCode.get(b.branch_code);
    const courseId = courseIdByCode.get(b.course_code);
    if (!branch || !courseId) continue;
    if (apply) {
      const batch = await prisma.batch.upsert({
        where: { branchId_courseId_name: { branchId: branch.id, courseId, name: b.name } },
        update: {},
        create: { companyId: company.id, branchId: branch.id, courseId, name: b.name, mode: "OFFLINE", schedule: b.name },
      });
      batchIdByKey.set(`${b.branch_code}|${b.course_code}|${b.name}`, batch.id);
    } else {
      const existing = await prisma.batch.findFirst({ where: { branchId: branch.id, courseId, name: b.name } });
      if (existing) batchIdByKey.set(`${b.branch_code}|${b.course_code}|${b.name}`, existing.id);
    }
  }

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

  let newStudents = 0;
  let newStudentPayments = 0;
  let newStudentDiscounts = 0;
  let newPaymentsForExisting = 0;
  let newPaymentsAmount = 0;
  let newDiscountsForExisting = 0;
  let newDiscountsAmount = 0;
  const sample: string[] = [];

  for (const s of payload.students) {
    const key = `${s.notes}|${s.course_code}`;
    const existing = studentByKey.get(key);
    const branch = branchByCode.get(s.branch_code);
    const courseId = courseIdByCode.get(s.course_code);
    if (!branch || !courseId) continue;
    const batchId = batchIdByKey.get(`${s.branch_code}|${s.course_code}|${s.batch_name}`) ?? null;

    if (!existing) {
      // brand-new student (admitted this month, previously excluded by cutoff)
      newStudents++;
      newStudentPayments += s.payments.length;
      newStudentDiscounts += s.discounts.length;
      if (sample.length < 10) sample.push(`+ NEW STUDENT ${s.name} (${s.course_code} @ ${s.branch_code})`);
      if (apply) {
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
        }
      }
      continue;
    }

    // existing student — add only genuinely new receipts
    const existingPaymentKeys = new Set(existing.payments.map((p) => `${p.notes}|${p.amount}`));
    const existingDiscountKeys = new Set(existing.discounts.map((d) => `${d.reason}|${d.amount}`));
    const newPayments = s.payments.filter((p) => !existingPaymentKeys.has(`${p.notes}|${p.amount}`));
    const newDiscounts = s.discounts.filter((d) => !existingDiscountKeys.has(`${d.reason}|${d.amount}`));

    for (const p of newPayments) {
      newPaymentsForExisting++;
      newPaymentsAmount += p.amount;
      if (sample.length < 10) sample.push(`+ Payment ₹${p.amount} for ${s.name} (existing student)`);
      if (apply) {
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
      newDiscountsForExisting++;
      newDiscountsAmount += d.amount;
      if (apply) {
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
  console.log(`New students: ${newStudents} (with ${newStudentPayments} payments, ${newStudentDiscounts} discounts)`);
  console.log(`New payments for already-existing students: ${newPaymentsForExisting} totaling ₹${newPaymentsAmount.toLocaleString("en-IN")}`);
  console.log(`New discounts for already-existing students: ${newDiscountsForExisting} totaling ₹${newDiscountsAmount.toLocaleString("en-IN")}`);
  console.log("\nSample:");
  sample.forEach((s) => console.log("  " + s));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

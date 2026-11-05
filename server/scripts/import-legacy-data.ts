/**
 * One-off import of real historical data from the legacy School-ERP system,
 * up to end of last month. Reads the already-built, already-reviewed payload
 * at final_import.json (see ~/Desktop/Consol_Revenue_TM for extraction notes)
 * and loads it via Prisma. Safe to re-run — courses/batches upsert, and it
 * refuses to run if real students already exist (only clears throwaway
 * pre-import test data).
 *
 * Run: npx tsx scripts/import-legacy-data.ts
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
  const payload: ImportPayload = JSON.parse(fs.readFileSync(IMPORT_PATH, "utf-8"));

  const company = await prisma.company.findFirstOrThrow();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const branchByCode = new Map(branches.map((b) => [b.code, b]));

  // Clear throwaway smoke-test data created earlier this session (there should
  // only ever be a handful of rows here — this is not a blind wipe).
  const preExisting = await prisma.student.findMany({ where: { companyId: company.id } });
  if (preExisting.length > 20) {
    throw new Error(
      `Refusing to proceed: ${preExisting.length} students already exist (expected only leftover test data). Investigate before running this script.`
    );
  }
  for (const s of preExisting) {
    await prisma.payment.deleteMany({ where: { studentId: s.id } });
    await prisma.discount.deleteMany({ where: { studentId: s.id } });
    await prisma.paymentLink.deleteMany({ where: { studentId: s.id } });
    await prisma.student.delete({ where: { id: s.id } });
  }
  console.log(`Cleared ${preExisting.length} pre-existing (test) student(s).`);

  // ---- courses + fee structures ----
  const courseIdByCode = new Map<string, string>();
  for (const c of payload.courses) {
    const course = await prisma.course.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { companyId: company.id, name: c.name, code: c.code },
    });
    courseIdByCode.set(c.code, course.id);
    for (const fee of c.fee_structures) {
      const existing = await prisma.courseFeeStructure.findFirst({
        where: { courseId: course.id, label: fee.label, mode: "OFFLINE" },
      });
      if (!existing) {
        await prisma.courseFeeStructure.create({
          data: { courseId: course.id, label: fee.label, mode: "OFFLINE", amount: fee.amount },
        });
      }
    }
  }
  console.log(`Courses: ${courseIdByCode.size}`);

  // ---- batches ----
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
  console.log(`Batches: ${batchIdByKey.size}`);

  // ---- students + payments + discounts ----
  let created = 0;
  let paymentsCreated = 0;
  let discountsCreated = 0;
  for (const s of payload.students) {
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

    if (created % 200 === 0) console.log(`  ${created}/${payload.students.length} students...`);
  }

  console.log(`\nDone.`);
  console.log(`Students: ${created}`);
  console.log(`Payments: ${paymentsCreated}`);
  console.log(`Discounts: ${discountsCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

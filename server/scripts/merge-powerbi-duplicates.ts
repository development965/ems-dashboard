/**
 * One-off: merges "Power" (1 student) and "IT - Power Bi" (0 students, wrong ₹12,000 fee)
 * into the canonical "Power BI" (₹7,000, 5 students) — same pattern as the SAP FICO merges:
 * recreate the losing course's batch under the winner if needed, move students/leads, delete
 * the empty duplicates. Student.totalFee is left untouched (it's a per-enrollment snapshot).
 *
 * Run: npx tsx scripts/merge-powerbi-duplicates.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const CANONICAL_COURSE_ID = "cmsn61axj00272xyqtasz8b2e"; // "Power BI" — ₹7,000, 5 students
const DUPLICATE_COURSE_IDS = [
  "cmsn61axh00252xyqa0kjkb08", // "Power" — 1 student, no fee
  "cmsn61ax0001v2xyqvoyno1ra", // "IT - Power Bi" — 0 students, ₹12,000 fee
];

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  for (const dupId of DUPLICATE_COURSE_IDS) {
    const dup = await prisma.course.findUnique({ where: { id: dupId } });
    if (!dup) {
      console.log(`Skipping ${dupId} — already gone.`);
      continue;
    }

    const students = await prisma.student.findMany({ where: { courseId: dupId }, select: { id: true, name: true, batchId: true } });
    const leads = await prisma.lead.findMany({ where: { interestedCourseId: dupId }, select: { id: true, name: true } });
    const oldBatches = await prisma.batch.findMany({ where: { courseId: dupId } });

    console.log(`\n"${dup.name}" (${dupId}): ${students.length} students, ${leads.length} leads, ${oldBatches.length} batches`);
    students.forEach((s) => console.log("  student:", s.name));

    if (!apply) continue;

    const batchIdMap = new Map<string, string>();
    for (const b of oldBatches) {
      const existing = await prisma.batch.findFirst({ where: { courseId: CANONICAL_COURSE_ID, branchId: b.branchId, name: b.name } });
      const target =
        existing ??
        (await prisma.batch.create({
          data: {
            companyId: b.companyId,
            branchId: b.branchId,
            courseId: CANONICAL_COURSE_ID,
            name: b.name,
            mode: b.mode,
            schedule: b.schedule,
            startDate: b.startDate,
            endDate: b.endDate,
            capacity: b.capacity,
          },
        }));
      batchIdMap.set(b.id, target.id);
    }

    for (const s of students) {
      await prisma.student.update({
        where: { id: s.id },
        data: { courseId: CANONICAL_COURSE_ID, batchId: s.batchId ? (batchIdMap.get(s.batchId) ?? null) : null },
      });
    }

    await prisma.lead.updateMany({ where: { interestedCourseId: dupId }, data: { interestedCourseId: CANONICAL_COURSE_ID } });

    // Cascades to the duplicate's (now-empty) batches and fee structures.
    await prisma.course.delete({ where: { id: dupId } });
    console.log(`  -> merged and deleted.`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

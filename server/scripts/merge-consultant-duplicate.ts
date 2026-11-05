/**
 * One-off: merges the "SAP FICO Consultant" duplicate into the canonical "SAP FICO -
 * Consultant" course. Unlike the earlier merge, the losing course has a real student with a
 * batch assignment — this recreates the equivalent batch under the winning course (same
 * branch/name/mode/schedule) rather than letting it null out, then deletes the duplicate.
 *
 * Run: npx tsx scripts/merge-consultant-duplicate.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DUPLICATE_COURSE_ID = "cmsn61b0w003n2xyqtobm08vy"; // "SAP FICO Consultant"
const CANONICAL_COURSE_ID = "cmsn61b0g003f2xyqvcb3hpv7"; // "SAP FICO - Consultant"

async function main() {
  const apply = process.argv.includes("--apply");

  const students = await prisma.student.findMany({
    where: { courseId: DUPLICATE_COURSE_ID },
    select: { id: true, name: true, phone: true, batchId: true },
  });
  const leads = await prisma.lead.findMany({ where: { interestedCourseId: DUPLICATE_COURSE_ID }, select: { id: true, name: true } });
  const oldBatches = await prisma.batch.findMany({ where: { courseId: DUPLICATE_COURSE_ID } });

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Students to move: ${students.length}`, students);
  console.log(`Leads to move: ${leads.length}`, leads);
  console.log(`Batches to recreate under canonical course: ${oldBatches.length}`, oldBatches.map((b) => b.name));

  if (!apply) return;

  // For each batch the duplicate course had, find or create an equivalent one under the
  // canonical course (same branch/name/mode/schedule), and remember the id mapping.
  const batchIdMap = new Map<string, string>();
  for (const b of oldBatches) {
    const existing = await prisma.batch.findFirst({
      where: { courseId: CANONICAL_COURSE_ID, branchId: b.branchId, name: b.name },
    });
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
      data: {
        courseId: CANONICAL_COURSE_ID,
        batchId: s.batchId ? (batchIdMap.get(s.batchId) ?? null) : null,
      },
    });
  }

  await prisma.lead.updateMany({ where: { interestedCourseId: DUPLICATE_COURSE_ID }, data: { interestedCourseId: CANONICAL_COURSE_ID } });

  // Deleting the course cascades to its (now-empty) batches and fee structures.
  await prisma.course.delete({ where: { id: DUPLICATE_COURSE_ID } });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

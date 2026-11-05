import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { branchSeeds } from "./branches.data.js";

const prisma = new PrismaClient();

async function main() {
  const companyName = process.env.SEED_COMPANY_NAME ?? "Techmaax";
  const companySlug = process.env.SEED_COMPANY_SLUG ?? "techmaax";
  const adminName = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";
  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@techmaax.com";
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: {},
    create: { name: companyName, slug: companySlug },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      companyId: company.id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  // Drop the old placeholder branch from earlier scaffolding, if present and unused.
  const placeholder = await prisma.branch.findUnique({
    where: { companyId_code: { companyId: company.id, code: "HO" } },
    include: { _count: { select: { users: true } } },
  });
  if (placeholder && placeholder._count.users === 0) {
    await prisma.branch.delete({ where: { id: placeholder.id } });
  }

  for (const branch of branchSeeds) {
    await prisma.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: branch.code } },
      update: { name: branch.name, address: branch.address, phone: branch.phone },
      create: { companyId: company.id, ...branch },
    });
  }

  console.log("Seed complete:");
  console.log(`  Company: ${company.name} (${company.slug})`);
  console.log(`  Branches: ${branchSeeds.length} (${branchSeeds.map((b) => b.code).join(", ")})`);
  console.log(`  Super admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

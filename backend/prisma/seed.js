import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@padel.com" },
    update: {},
    create: {
      first_name: "Admin",
      last_name: "Padel",
      email: "admin@padel.com",
      password: passwordHash,
      role: "admin",
    },
  });

  console.log("✅ Admin creado");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

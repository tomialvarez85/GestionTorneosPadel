import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@padel.com",
      password: "123456", // bcrypt
      role: "ADMIN"
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });

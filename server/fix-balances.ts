import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: {
      starsBalance: 0,
      nmnhBalance: 1000,
      totalNmnhEarned: 1000
    }
  });
  console.log(`Updated ${result.count} users successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

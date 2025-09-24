// prisma/seed.ts
import prisma from '../src/lib/prisma';
import { createDefaultUser } from '../src/services/userService';
import { log as logUtil } from '../src/utils/logger';

declare global {
  var log: typeof logUtil;
}
global.log = logUtil;
async function main() {
  // delete existing data
  await prisma.user.deleteMany();

  await createDefaultUser();
}

main()
  .catch(() => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

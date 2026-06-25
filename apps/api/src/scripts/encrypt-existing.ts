import prisma from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { encrypt } from '../utils/encryption';


// A value is already encrypted if it has the "iv:tag:cipher" 3-part shape.
function isEncrypted(v: string | null): boolean {
  return typeof v === 'string' && v.split(':').length === 3;
}

async function main() {
  const customers = await prisma.customer.findMany();
  let updated = 0;

  for (const c of customers) {
    const data: any = {};
    if (c.aadhar && !isEncrypted(c.aadhar)) data.aadhar = encrypt(c.aadhar);
    if (c.pan && !isEncrypted(c.pan)) data.pan = encrypt(c.pan);

    if (Object.keys(data).length > 0) {
      await prisma.customer.update({ where: { id: c.id }, data });
      updated++;
      console.log(`Encrypted customer #${c.id} (${c.name})`);
    } else {
      console.log(`Skipped customer #${c.id} (${c.name}) — already encrypted`);
    }
  }

  console.log(`\nDone. ${updated} customer(s) newly encrypted.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

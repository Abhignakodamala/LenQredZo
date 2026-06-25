import prisma from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { encrypt } from '../utils/encryption';


function isEncrypted(v: string | null): boolean {
  return typeof v === 'string' && v.split(':').length === 3;
}

async function main() {
  const guarantors = await prisma.guarantor.findMany();
  let updated = 0;

  for (const g of guarantors) {
    const data: any = {};
    if (g.aadhar && !isEncrypted(g.aadhar)) data.aadhar = encrypt(g.aadhar);
    if (g.pan && !isEncrypted(g.pan)) data.pan = encrypt(g.pan);

    if (Object.keys(data).length > 0) {
      await prisma.guarantor.update({ where: { id: g.id }, data });
      updated++;
      console.log(`Encrypted guarantor #${g.id} (${g.name})`);
    } else {
      console.log(`Skipped guarantor #${g.id} (${g.name}) — already encrypted or no PII`);
    }
  }

  console.log(`\nDone. ${updated} guarantor(s) newly encrypted.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

// Add the training snapshots without resetting tables or historical sessions.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_sessions'
  `;
  if (!columns.length) throw new Error('Không tìm thấy bảng training_sessions trong database đã cấu hình.');
  const existing = new Set(columns.map(column => column.COLUMN_NAME));
  const additions = {
    plan: "ADD COLUMN `plan` JSON NULL COMMENT 'Ordered six drills and training environment snapshot'",
    results: "ADD COLUMN `results` JSON NULL COMMENT 'Committed per-player fitness, chances and attribute gains'",
  };
  const missing = Object.keys(additions).filter(column => !existing.has(column));
  if (missing.length) {
    // Only hard-coded identifiers/DDL are used here; no input is interpolated.
    await prisma.$executeRawUnsafe(`ALTER TABLE \`training_sessions\` ${missing.map(column => additions[column]).join(', ')}`);
    console.log(`Đã bổ sung cột: ${missing.join(', ')}.`);
  } else {
    console.log('Các cột tập luyện đã tồn tại; không thay đổi schema.');
  }
  // Same fields and relation as the sessions endpoint; do not print player data.
  const sessions = await prisma.training_sessions.findMany({
    include: { training_types: true }, orderBy: { id: 'desc' }, take: 1,
  });
  console.log(`Truy vấn lịch sử tập luyện thành công (${sessions.length} bản ghi kiểm tra).`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

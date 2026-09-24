require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function hashPasswords() {
  console.log('=== MEMULAI MIGRASI PASSWORD KE BCRYPT HASH ===');
  
  const users = await db.query('SELECT id, username, password FROM users');
  console.log(`Ditemukan ${users.length} user dalam database.`);

  let updatedCount = 0;
  let alreadyHashed = 0;

  for (const u of users) {
    const isBcrypt = u.password && (u.password.startsWith('$2a$') || u.password.startsWith('$2b$'));
    if (isBcrypt) {
      console.log(`  ℹ️ User "${u.username}" (ID: ${u.id}) sudah menggunakan bcrypt hash.`);
      alreadyHashed++;
      continue;
    }

    console.log(`  🔒 Meng-hash password untuk user "${u.username}" (ID: ${u.id})...`);
    const plain = u.password;
    const hashed = await bcrypt.hash(plain, 10);

    // Verifikasi sebelum simpan
    const isValid = await bcrypt.compare(plain, hashed);
    if (!isValid) {
      throw new Error(`Verifikasi hash gagal untuk user ${u.username}!`);
    }

    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, u.id]);
    updatedCount++;
    console.log(`  ✅ User "${u.username}" berhasil di-hash.`);
  }

  console.log('====================================================');
  console.log(`MIGRASI PASSWORD SELESAI: ${updatedCount} di-hash, ${alreadyHashed} sudah hash sebelumnya.`);
  console.log('====================================================');
}

if (require.main === module) {
  hashPasswords()
    .then(async () => {
      await db.closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Gagal:', err);
      await db.closePool();
      process.exit(1);
    });
}

module.exports = hashPasswords;

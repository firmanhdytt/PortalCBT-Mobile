const db = require('./db');

async function migratePhase8() {
  console.log('🔄 Running Phase 8 Migration: Indexes & Optimizations for Certificates and Cards...');
  try {
    // Check if idx_cert_siswa_ujian exists
    const [indexes] = await db.pool.query("SHOW INDEX FROM certificates WHERE Key_name = 'idx_cert_siswa_ujian'");
    if (!indexes || indexes.length === 0) {
      await db.pool.query("ALTER TABLE certificates ADD INDEX idx_cert_siswa_ujian (siswa_id, ujian_id)");
      console.log('  ✅ Added index idx_cert_siswa_ujian to certificates');
    } else {
      console.log('  ℹ️ Index idx_cert_siswa_ujian already exists');
    }

    const [verifIndexes] = await db.pool.query("SHOW INDEX FROM certificate_verifications WHERE Key_name = 'idx_cert_verif_date'");
    if (!verifIndexes || verifIndexes.length === 0) {
      await db.pool.query("ALTER TABLE certificate_verifications ADD INDEX idx_cert_verif_date (certificate_id, verified_at)");
      console.log('  ✅ Added index idx_cert_verif_date to certificate_verifications');
    } else {
      console.log('  ℹ️ Index idx_cert_verif_date already exists');
    }

    console.log('🎉 Phase 8 migration completed successfully!');
  } catch (err) {
    console.error('❌ Phase 8 migration error:', err.message);
    throw err;
  }
}

if (require.main === module) {
  migratePhase8().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migratePhase8;

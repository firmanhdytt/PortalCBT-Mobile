const db = require('../database/db');

class TokenRepository {
  async saveToken({ userId, refreshToken, expiresAt, ipAddress, userAgent }) {
    return await db.insert('user_tokens', {
      user_id: userId,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      is_revoked: 0
    });
  }

  async findValidToken(refreshToken) {
    return await db.getOne(
      'SELECT * FROM user_tokens WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > NOW()',
      [refreshToken]
    );
  }

  async revokeToken(refreshToken) {
    const result = await db.execute(
      'UPDATE user_tokens SET is_revoked = 1 WHERE refresh_token = ?',
      [refreshToken]
    );
    return result && result.affectedRows > 0;
  }

  async revokeAllUserTokens(userId) {
    const result = await db.execute(
      'UPDATE user_tokens SET is_revoked = 1 WHERE user_id = ?',
      [userId]
    );
    return result && result.affectedRows > 0;
  }
}

module.exports = new TokenRepository();

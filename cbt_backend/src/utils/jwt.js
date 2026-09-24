const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cbt_super_secure_jwt_access_secret_key_2026_antigravity';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cbt_ultra_secure_jwt_refresh_secret_key_2026_antigravity';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Sign JWT Access Token
 * @param {Object} user - User data { id, username, role, email }
 * @returns {String} access token
 */
function generateAccessToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email || null
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Sign JWT Refresh Token
 * @param {Object} user - User data { id, username, role }
 * @returns {String} refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify JWT Access Token
 * @param {String} token
 * @returns {Object} decoded payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Verify JWT Refresh Token
 * @param {String} token
 * @returns {Object} decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};

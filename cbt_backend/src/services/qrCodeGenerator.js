const QRCode = require('qrcode');

class QrCodeGenerator {
  /**
   * Generate QR Code as Base64 Data URL (image/png)
   * @param {string} text 
   * @param {object} options 
   * @returns {Promise<string>}
   */
  static async toDataURL(text, options = {}) {
    const defaultOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: options.width || 256,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    };
    return QRCode.toDataURL(text, { ...defaultOptions, ...options });
  }

  /**
   * Generate QR Code as SVG string
   * @param {string} text 
   * @param {object} options 
   * @returns {Promise<string>}
   */
  static async toSvg(text, options = {}) {
    const defaultOptions = {
      errorCorrectionLevel: 'M',
      type: 'svg',
      margin: 1,
      width: options.width || 200,
      color: {
        dark: options.darkColor || '#0f172a',
        light: options.lightColor || '#ffffff'
      }
    };
    return QRCode.toString(text, { ...defaultOptions, ...options });
  }
}

module.exports = QrCodeGenerator;

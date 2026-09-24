const ApiResponse = require('../utils/response');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Higher-order middleware generator for request payload validation
 * @param {Object} schema - Validation schema { field: { required, type, min, max, regex, message } }
 * @param {String} source - 'body' | 'query' | 'params'
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const val = data[field];

      // 1. Required check
      if (rules.required) {
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          errors.push({
            field,
            rule: 'required',
            message: rules.message || `${field} wajib diisi!`
          });
          continue;
        }
      }

      // If value is not provided and not required, skip further checks
      if (val === undefined || val === null) {
        continue;
      }

      // 2. Type check
      if (rules.type) {
        if (rules.type === 'number') {
          if (isNaN(Number(val))) {
            errors.push({ field, rule: 'type', message: `${field} harus berupa angka!` });
            continue;
          }
        } else if (rules.type === 'integer') {
          if (!Number.isInteger(Number(val))) {
            errors.push({ field, rule: 'type', message: `${field} harus berupa bilangan bulat!` });
            continue;
          }
        } else if (rules.type === 'string') {
          if (typeof val !== 'string') {
            errors.push({ field, rule: 'type', message: `${field} harus berupa string!` });
            continue;
          }
        } else if (rules.type === 'array') {
          if (!Array.isArray(val)) {
            errors.push({ field, rule: 'type', message: `${field} harus berupa array!` });
            continue;
          }
        } else if (rules.type === 'boolean') {
          if (typeof val !== 'boolean' && val !== 0 && val !== 1 && val !== '0' && val !== '1' && val !== 'true' && val !== 'false') {
            errors.push({ field, rule: 'type', message: `${field} harus berupa boolean!` });
            continue;
          }
        }
      }

      // 3. String Length checks
      if (typeof val === 'string') {
        if (rules.minLength && val.trim().length < rules.minLength) {
          errors.push({ field, rule: 'minLength', message: `${field} minimal ${rules.minLength} karakter!` });
        }
        if (rules.maxLength && val.trim().length > rules.maxLength) {
          errors.push({ field, rule: 'maxLength', message: `${field} maksimal ${rules.maxLength} karakter!` });
        }
        if (rules.regex && !rules.regex.test(val)) {
          errors.push({ field, rule: 'format', message: rules.message || `Format ${field} tidak valid!` });
        }
      }

      // 4. Number Range checks
      if (rules.type === 'number' || rules.type === 'integer') {
        const num = Number(val);
        if (rules.min !== undefined && num < rules.min) {
          errors.push({ field, rule: 'min', message: `${field} minimal bernilai ${rules.min}!` });
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push({ field, rule: 'max', message: `${field} maksimal bernilai ${rules.max}!` });
        }
      }

      // 5. Custom validator function
      if (typeof rules.custom === 'function') {
        const customError = rules.custom(val, data);
        if (customError) {
          errors.push({ field, rule: 'custom', message: customError });
        }
      }
    }

    if (errors.length > 0) {
      return ApiResponse.error(
        res,
        errors[0].message,
        ERROR_CODES.VALIDATION_ERROR || 'VALIDATION_ERROR',
        400,
        errors
      );
    }

    next();
  };
}

function validateBody(schema) {
  return validate(schema, 'body');
}

function validateParams(schema) {
  return validate(schema, 'params');
}

function validateQuery(schema) {
  return validate(schema, 'query');
}

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery
};

/**
 * Normalizes DB/form birthdate values to YYYY-MM-DD (MySQL DATE, ISO strings, Date objects).
 * @param {unknown} birthdate
 * @returns {string|null}
 */
function normalizeBirthdateToYYYYMMDD(birthdate) {
  if (birthdate == null || birthdate === '') return null;
  if (Object.prototype.toString.call(birthdate) === '[object Date]') {
    if (Number.isNaN(birthdate.getTime())) return null;
    const y = birthdate.getFullYear();
    const m = String(birthdate.getMonth() + 1).padStart(2, '0');
    const d = String(birthdate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(birthdate).trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match ? match[1] : null;
}

/**
 * Core age check on a normalized YYYY-MM-DD string.
 * @param {string} normalizedYyyyMmDd
 * @param {number} minAgeYears
 * @param {'register'|'login'} mode
 */
function validateAgeFromNormalizedDate(normalizedYyyyMmDd, minAgeYears, mode) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedYyyyMmDd);
  if (!m) {
    return { ok: false, message: 'Please enter a valid birthdate' };
  }

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return { ok: false, message: 'Please enter a valid birthdate' };
  }

  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) {
    return { ok: false, message: 'Please enter a valid birthdate' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birth.setHours(0, 0, 0, 0);

  if (birth > today) {
    return { ok: false, message: 'Birthdate cannot be in the future' };
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  if (age < minAgeYears) {
    return {
      ok: false,
      message:
        mode === 'login'
          ? `You must be at least ${minAgeYears} years old to sign in.`
          : `You must be at least ${minAgeYears} years old to create an account`
    };
  }

  return { ok: true };
}

/**
 * Registration / form: accepts YYYY-MM-DD or ISO-like strings from clients.
 * @param {string} birthdateStr
 * @param {number} [minAgeYears=18]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateRegistrationBirthdate(birthdateStr, minAgeYears = 18) {
  const normalized = normalizeBirthdateToYYYYMMDD(birthdateStr);
  if (!normalized) {
    return { ok: false, message: 'Birthdate is required' };
  }
  return validateAgeFromNormalizedDate(normalized, minAgeYears, 'register');
}

/**
 * Login / OAuth: uses stored user.birthdate (may be Date or MySQL string).
 * @param {unknown} birthdateFromDb
 * @param {number} [minAgeYears=18]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateLoginBirthdateEligibility(birthdateFromDb, minAgeYears = 18) {
  const normalized = normalizeBirthdateToYYYYMMDD(birthdateFromDb);
  if (!normalized) {
    return {
      ok: false,
      message:
        'Your account must have a valid date of birth on file before you can sign in. Please contact support.'
    };
  }
  return validateAgeFromNormalizedDate(normalized, minAgeYears, 'login');
}

function formatBirthdateForApi(birthdate) {
  return normalizeBirthdateToYYYYMMDD(birthdate);
}

module.exports = {
  normalizeBirthdateToYYYYMMDD,
  validateRegistrationBirthdate,
  validateLoginBirthdateEligibility,
  formatBirthdateForApi
};

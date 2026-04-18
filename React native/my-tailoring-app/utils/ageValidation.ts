/**
 * Validates birthdate for registration (YYYY-MM-DD). Ensures date is real, not in the future, and age >= minAgeYears.
 */
export function validateRegistrationBirthdate(
  birthdateStr: string,
  minAgeYears = 18
): { ok: true } | { ok: false; message: string } {
  if (!birthdateStr || typeof birthdateStr !== 'string') {
    return { ok: false, message: 'Birthdate is required' };
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthdateStr).trim());
  if (!m) {
    return { ok: false, message: 'Please use birthdate format YYYY-MM-DD' };
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
      message: `You must be at least ${minAgeYears} years old to create an account`,
    };
  }

  return { ok: true };
}

/**
 * Validates whether an existing account is old enough to sign in.
 */
export function validateLoginBirthdateEligibility(
  birthdateStr: string | null | undefined,
  minAgeYears = 18
): { ok: true } | { ok: false; message: string } {
  if (!birthdateStr || typeof birthdateStr !== 'string') {
    return {
      ok: false,
      message: 'Your account must have a valid date of birth on file before you can sign in. Please contact support.',
    };
  }

  const registrationCheck = validateRegistrationBirthdate(birthdateStr, minAgeYears);
  if (!registrationCheck.ok) {
    if (registrationCheck.message === `You must be at least ${minAgeYears} years old to create an account`) {
      return {
        ok: false,
        message: `You must be at least ${minAgeYears} years old to sign in.`,
      };
    }

    return registrationCheck;
  }

  return { ok: true };
}

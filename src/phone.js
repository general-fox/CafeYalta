import { parsePhoneNumberFromString } from 'libphonenumber-js/core';
import fullMetadata from 'libphonenumber-js/metadata.max';

// Keep both regions sharing +7 so Russian numbers can be distinguished from Kazakh numbers.
// Static property access lets the production build omit metadata for other calling codes.
export const phoneMetadata = {
  version: fullMetadata.version,
  country_calling_codes: { 7: fullMetadata.country_calling_codes['7'] },
  countries: { RU: fullMetadata.countries.RU, KZ: fullMetadata.countries.KZ },
};

export function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\p{Zs}.\-\u2010-\u2014]/gu, '');
  if (!/^\+?(?:\d+|\d*\(\d+\)\d+)$/.test(compact)) return null;
  const number = /^(?:\+7|7|8)?(\d{10})$/.exec(compact.replace(/[()]/g, ''));
  if (!number) return null;

  // Russia and Kazakhstan share +7. Check the national range as well as the length.
  const phone = parsePhoneNumberFromString('+7' + number[1], phoneMetadata);
  return phone?.country === 'RU' && phone.isValid() ? phone.number : null;
}

export function formatPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return typeof value === 'string' ? value : '';
  return phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4');
}

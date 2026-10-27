import type { VerificationStatus } from '../types';

export const STATES: [string, string][] = [
  ['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],['CG','Chhattisgarh'],['GA','Goa'],['GJ','Gujarat'],['HR','Haryana'],['HP','Himachal Pradesh'],['JH','Jharkhand'],['KA','Karnataka'],['KL','Kerala'],['MP','Madhya Pradesh'],['MH','Maharashtra'],['MN','Manipur'],['ML','Meghalaya'],['MZ','Mizoram'],['NL','Nagaland'],['OD','Odisha'],['PB','Punjab'],['RJ','Rajasthan'],['SK','Sikkim'],['TN','Tamil Nadu'],['TS','Telangana'],['TR','Tripura'],['UP','Uttar Pradesh'],['UK','Uttarakhand'],['WB','West Bengal'],
  ['AN','Andaman and Nicobar Islands'],['CH','Chandigarh'],['DD','Dadra and Nagar Haveli and Daman and Diu'],['DL','Delhi'],['JK','Jammu and Kashmir'],['LA','Ladakh'],['LD','Lakshadweep'],['PY','Puducherry'],
];

export const OCCUPATIONS = ['student', 'employed', 'unemployed', 'farmer', 'entrepreneur', 'homemaker', 'retired', 'other'] as const;

export const isVerified = (s: VerificationStatus) => s === 'verified';

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return iso; }
}

/** Only allow https links to be rendered as hrefs. */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { return new URL(url).protocol === 'https:' ? url : undefined; } catch { return undefined; }
}

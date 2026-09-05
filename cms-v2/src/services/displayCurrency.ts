/** ISO 3166-1 alpha-2 → ISO 4217. Used only for display; checkout stays USD. */
const COUNTRY_CURRENCY: Record<string, string> = {
  AD: 'EUR', AE: 'AED', AF: 'AFN', AG: 'XCD', AI: 'XCD', AL: 'ALL', AM: 'AMD',
  AO: 'AOA', AR: 'ARS', AS: 'USD', AT: 'EUR', AU: 'AUD', AW: 'AWG', AX: 'EUR',
  AZ: 'AZN', BA: 'BAM', BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF', BG: 'BGN',
  BH: 'BHD', BI: 'BIF', BJ: 'XOF', BL: 'EUR', BM: 'BMD', BN: 'BND', BO: 'BOB',
  BQ: 'USD', BR: 'BRL', BS: 'BSD', BT: 'BTN', BW: 'BWP', BY: 'BYN', BZ: 'BZD',
  CA: 'CAD', CC: 'AUD', CD: 'CDF', CF: 'XAF', CG: 'XAF', CH: 'CHF', CI: 'XOF',
  CK: 'NZD', CL: 'CLP', CM: 'XAF', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP',
  CV: 'CVE', CW: 'ANG', CX: 'AUD', CY: 'EUR', CZ: 'CZK', DE: 'EUR', DJ: 'DJF',
  DK: 'DKK', DM: 'XCD', DO: 'DOP', DZ: 'DZD', EC: 'USD', EE: 'EUR', EG: 'EGP',
  EH: 'MAD', ER: 'ERN', ES: 'EUR', ET: 'ETB', FI: 'EUR', FJ: 'FJD', FK: 'FKP',
  FM: 'USD', FO: 'DKK', FR: 'EUR', GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL',
  GF: 'EUR', GG: 'GBP', GH: 'GHS', GI: 'GIP', GL: 'DKK', GM: 'GMD', GN: 'GNF',
  GP: 'EUR', GQ: 'XAF', GR: 'EUR', GT: 'GTQ', GU: 'USD', GW: 'XOF', GY: 'GYD',
  HK: 'HKD', HN: 'HNL', HR: 'EUR', HT: 'HTG', HU: 'HUF', ID: 'IDR', IE: 'EUR',
  IL: 'ILS', IM: 'GBP', IN: 'INR', IQ: 'IQD', IR: 'IRR', IS: 'ISK', IT: 'EUR',
  JE: 'GBP', JM: 'JMD', JO: 'JOD', JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR',
  KI: 'AUD', KM: 'KMF', KN: 'XCD', KP: 'KPW', KR: 'KRW', KW: 'KWD', KY: 'KYD',
  KZ: 'KZT', LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF', LK: 'LKR', LR: 'LRD',
  LS: 'LSL', LT: 'EUR', LU: 'EUR', LV: 'EUR', LY: 'LYD', MA: 'MAD', MC: 'EUR',
  MD: 'MDL', ME: 'EUR', MF: 'EUR', MG: 'MGA', MH: 'USD', MK: 'MKD', ML: 'XOF',
  MM: 'MMK', MN: 'MNT', MO: 'MOP', MP: 'USD', MQ: 'EUR', MR: 'MRU', MS: 'XCD',
  MT: 'EUR', MU: 'MUR', MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN',
  NA: 'NAD', NC: 'XPF', NE: 'XOF', NF: 'AUD', NG: 'NGN', NI: 'NIO', NL: 'EUR',
  NO: 'NOK', NP: 'NPR', NR: 'AUD', NU: 'NZD', NZ: 'NZD', OM: 'OMR', PA: 'USD',
  PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PM: 'EUR',
  PN: 'NZD', PR: 'USD', PS: 'ILS', PT: 'EUR', PW: 'USD', PY: 'PYG', QA: 'QAR',
  RE: 'EUR', RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF', SA: 'SAR', SB: 'SBD',
  SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD', SH: 'SHP', SI: 'EUR', SJ: 'NOK',
  SK: 'EUR', SL: 'SLE', SM: 'EUR', SN: 'XOF', SO: 'SOS', SR: 'SRD', SS: 'SSP',
  ST: 'STN', SV: 'USD', SX: 'ANG', SY: 'SYP', SZ: 'SZL', TC: 'USD', TD: 'XAF',
  TG: 'XOF', TH: 'THB', TJ: 'TJS', TK: 'NZD', TL: 'USD', TM: 'TMT', TN: 'TND',
  TO: 'TOP', TR: 'TRY', TT: 'TTD', TV: 'AUD', TW: 'TWD', TZ: 'TZS', UA: 'UAH',
  UG: 'UGX', UM: 'USD', US: 'USD', UY: 'UYU', UZ: 'UZS', VA: 'EUR', VC: 'XCD',
  VE: 'VES', VG: 'USD', VI: 'USD', VN: 'VND', VU: 'VUV', WF: 'XPF', WS: 'WST',
  XK: 'EUR', YE: 'YER', YT: 'EUR', ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWG',
};

/** Currencies typically shown without minor units on consumer price cards. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF', 'IDR', 'HUF', 'TWD',
  'INR', 'PKR', 'BDT', 'LKR', 'NPR', 'MMK', 'KHR', 'LAK', 'MGA', 'TZS',
]);

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  PKR: 'en-PK',
  BDT: 'en-BD',
  LKR: 'en-LK',
  NPR: 'en-NP',
  GBP: 'en-GB',
  EUR: 'en-IE',
  AED: 'en-AE',
  SAR: 'en-SA',
  AUD: 'en-AU',
  CAD: 'en-CA',
  NZD: 'en-NZ',
  SGD: 'en-SG',
  MYR: 'en-MY',
  ZAR: 'en-ZA',
  KES: 'en-KE',
  NGN: 'en-NG',
  EGP: 'en-EG',
  JPY: 'ja-JP',
  KRW: 'ko-KR',
  CNY: 'zh-CN',
  HKD: 'en-HK',
  PHP: 'en-PH',
  THB: 'en-TH',
  IDR: 'id-ID',
  VND: 'vi-VN',
};

export const BANK_FX_NOTE = 'The final conversion rate will be applied by your bank.';

export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || normalized === 'XX' || normalized === 'UK') {
    return normalized === 'UK' ? 'GB' : null;
  }
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function currencyForCountry(countryCode: string | null | undefined): string {
  const country = normalizeCountryCode(countryCode);
  if (!country) return 'USD';
  return COUNTRY_CURRENCY[country] ?? 'USD';
}

export function convertUsdAmount(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate * 100) / 100;
}

export function formatDisplayMoney(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(code);
  const rounded = zeroDecimal ? Math.round(amount) : amount;
  const hasCents = !zeroDecimal && Math.round(rounded * 100) % 100 !== 0;
  const locale = CURRENCY_LOCALE[code] ?? 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: zeroDecimal || !hasCents ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(rounded);
  } catch {
    return `${rounded.toFixed(zeroDecimal ? 0 : 2)} ${code}`;
  }
}

export function formatChargedAsUsd(amountUsd: number): string {
  return `Charged as ${formatDisplayMoney(amountUsd, 'USD')} USD`;
}

export type DisplayMoney = {
  displayCurrency: string;
  formatted: string;
  formattedCompareAt: string | null;
  formattedChargeUsd: string | null;
  fxApplied: boolean;
  fxNote: string | null;
};

export function localizeDisplayMoney(
  amountUsd: number,
  compareAtUsd: number | null,
  displayCurrency: string,
  rate: number | null,
): DisplayMoney {
  if (displayCurrency === 'USD' || rate == null) {
    return {
      displayCurrency: 'USD',
      formatted: formatDisplayMoney(amountUsd, 'USD'),
      formattedCompareAt: compareAtUsd != null ? formatDisplayMoney(compareAtUsd, 'USD') : null,
      formattedChargeUsd: null,
      fxApplied: false,
      fxNote: null,
    };
  }

  return {
    displayCurrency,
    formatted: formatDisplayMoney(convertUsdAmount(amountUsd, rate), displayCurrency),
    formattedCompareAt: compareAtUsd != null
      ? formatDisplayMoney(convertUsdAmount(compareAtUsd, rate), displayCurrency)
      : null,
    formattedChargeUsd: formatChargedAsUsd(amountUsd),
    fxApplied: true,
    fxNote: BANK_FX_NOTE,
  };
}

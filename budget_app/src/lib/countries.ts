/**
 * Country presets: home currency and the standard consumption-tax rate.
 *
 * These are STARTING POINTS, not tax advice. Rates change with budgets and
 * elections, many countries have reduced rates for food, books, transport and
 * so on, and some — the United States above all — set the rate below national
 * level. Every rate here is editable in the app, and the app says so where a
 * preset is applied.
 *
 * Compiled from published standard rates current to early 2026.
 */

export type CountryPreset = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** ISO 4217 currency for the country. */
  currency: string;
  /** Standard rate as a percentage, e.g. 20 for 20%. */
  taxRate: number;
  /** What the tax is called locally: VAT, GST, IVA, Sales tax… */
  taxLabel: string;
  /** Shown when the single number needs a caveat. */
  note?: string;
};

export const COUNTRIES: CountryPreset[] = [
  { code: 'AF', name: 'Afghanistan', currency: 'AFN', taxRate: 10, taxLabel: 'BRT' },
  { code: 'AL', name: 'Albania', currency: 'ALL', taxRate: 20, taxLabel: 'VAT' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', taxRate: 19, taxLabel: 'VAT' },
  { code: 'AD', name: 'Andorra', currency: 'EUR', taxRate: 4.5, taxLabel: 'IGI' },
  { code: 'AO', name: 'Angola', currency: 'AOA', taxRate: 14, taxLabel: 'VAT' },
  { code: 'AG', name: 'Antigua and Barbuda', currency: 'XCD', taxRate: 15, taxLabel: 'ABST' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', taxRate: 21, taxLabel: 'IVA' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', taxRate: 20, taxLabel: 'VAT' },
  { code: 'AU', name: 'Australia', currency: 'AUD', taxRate: 10, taxLabel: 'GST' },
  { code: 'AT', name: 'Austria', currency: 'EUR', taxRate: 20, taxLabel: 'VAT' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', taxRate: 18, taxLabel: 'VAT' },
  { code: 'BS', name: 'Bahamas', currency: 'BSD', taxRate: 10, taxLabel: 'VAT' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', taxRate: 10, taxLabel: 'VAT' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', taxRate: 15, taxLabel: 'VAT' },
  { code: 'BB', name: 'Barbados', currency: 'BBD', taxRate: 17.5, taxLabel: 'VAT' },
  { code: 'BY', name: 'Belarus', currency: 'BYN', taxRate: 20, taxLabel: 'VAT' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', taxRate: 21, taxLabel: 'VAT' },
  { code: 'BZ', name: 'Belize', currency: 'BZD', taxRate: 12.5, taxLabel: 'GST' },
  { code: 'BJ', name: 'Benin', currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'BT', name: 'Bhutan', currency: 'BTN', taxRate: 7, taxLabel: 'GST' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', taxRate: 13, taxLabel: 'IVA' },
  { code: 'BA', name: 'Bosnia and Herzegovina', currency: 'BAM', taxRate: 17, taxLabel: 'VAT' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', taxRate: 14, taxLabel: 'VAT' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', taxRate: 17, taxLabel: 'ICMS', note: 'Varies by state and product.' },
  { code: 'BN', name: 'Brunei', currency: 'BND', taxRate: 0, taxLabel: 'None' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', taxRate: 20, taxLabel: 'VAT' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'BI', name: 'Burundi', currency: 'BIF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'KH', name: 'Cambodia', currency: 'KHR', taxRate: 10, taxLabel: 'VAT' },
  { code: 'CM', name: 'Cameroon', currency: 'XAF', taxRate: 19.25, taxLabel: 'VAT' },
  { code: 'CA', name: 'Canada', currency: 'CAD', taxRate: 5, taxLabel: 'GST', note: 'Provinces add PST/HST on top.' },
  { code: 'CV', name: 'Cape Verde', currency: 'CVE', taxRate: 15, taxLabel: 'VAT' },
  { code: 'CF', name: 'Central African Republic', currency: 'XAF', taxRate: 19, taxLabel: 'VAT' },
  { code: 'TD', name: 'Chad', currency: 'XAF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'CL', name: 'Chile', currency: 'CLP', taxRate: 19, taxLabel: 'IVA' },
  { code: 'CN', name: 'China', currency: 'CNY', taxRate: 13, taxLabel: 'VAT' },
  { code: 'CO', name: 'Colombia', currency: 'COP', taxRate: 19, taxLabel: 'IVA' },
  { code: 'KM', name: 'Comoros', currency: 'KMF', taxRate: 10, taxLabel: 'VAT' },
  { code: 'CG', name: 'Congo', currency: 'XAF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'CD', name: 'Congo (DRC)', currency: 'CDF', taxRate: 16, taxLabel: 'VAT' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', taxRate: 13, taxLabel: 'IVA' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'HR', name: 'Croatia', currency: 'EUR', taxRate: 25, taxLabel: 'VAT' },
  { code: 'CU', name: 'Cuba', currency: 'CUP', taxRate: 0, taxLabel: 'None' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR', taxRate: 19, taxLabel: 'VAT' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK', taxRate: 21, taxLabel: 'VAT' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', taxRate: 25, taxLabel: 'VAT' },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', taxRate: 10, taxLabel: 'VAT' },
  { code: 'DM', name: 'Dominica', currency: 'XCD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', taxRate: 18, taxLabel: 'ITBIS' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', taxRate: 15, taxLabel: 'IVA' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', taxRate: 14, taxLabel: 'VAT' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', taxRate: 13, taxLabel: 'IVA' },
  { code: 'GQ', name: 'Equatorial Guinea', currency: 'XAF', taxRate: 15, taxLabel: 'VAT' },
  { code: 'ER', name: 'Eritrea', currency: 'ERN', taxRate: 0, taxLabel: 'None' },
  { code: 'EE', name: 'Estonia', currency: 'EUR', taxRate: 24, taxLabel: 'VAT' },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', taxRate: 15, taxLabel: 'VAT' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', taxRate: 15, taxLabel: 'VAT' },
  { code: 'FJ', name: 'Fiji', currency: 'FJD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'FI', name: 'Finland', currency: 'EUR', taxRate: 25.5, taxLabel: 'VAT' },
  { code: 'FR', name: 'France', currency: 'EUR', taxRate: 20, taxLabel: 'TVA' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'GM', name: 'Gambia', currency: 'GMD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', taxRate: 18, taxLabel: 'VAT' },
  { code: 'DE', name: 'Germany', currency: 'EUR', taxRate: 19, taxLabel: 'VAT' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', taxRate: 15, taxLabel: 'VAT' },
  { code: 'GR', name: 'Greece', currency: 'EUR', taxRate: 24, taxLabel: 'VAT' },
  { code: 'GD', name: 'Grenada', currency: 'XCD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', taxRate: 12, taxLabel: 'IVA' },
  { code: 'GN', name: 'Guinea', currency: 'GNF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', taxRate: 15, taxLabel: 'VAT' },
  { code: 'GY', name: 'Guyana', currency: 'GYD', taxRate: 14, taxLabel: 'VAT' },
  { code: 'HT', name: 'Haiti', currency: 'HTG', taxRate: 10, taxLabel: 'TCA' },
  { code: 'HN', name: 'Honduras', currency: 'HNL', taxRate: 15, taxLabel: 'ISV' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', taxRate: 0, taxLabel: 'None' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', taxRate: 27, taxLabel: 'VAT' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', taxRate: 24, taxLabel: 'VAT' },
  { code: 'IN', name: 'India', currency: 'INR', taxRate: 18, taxLabel: 'GST', note: 'Slabs of 5, 12, 18 and 28% by product.' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', taxRate: 12, taxLabel: 'PPN' },
  { code: 'IR', name: 'Iran', currency: 'IRR', taxRate: 10, taxLabel: 'VAT' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD', taxRate: 0, taxLabel: 'None' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', taxRate: 23, taxLabel: 'VAT' },
  { code: 'IL', name: 'Israel', currency: 'ILS', taxRate: 18, taxLabel: 'VAT' },
  { code: 'IT', name: 'Italy', currency: 'EUR', taxRate: 22, taxLabel: 'IVA' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', taxRate: 15, taxLabel: 'GCT' },
  { code: 'JP', name: 'Japan', currency: 'JPY', taxRate: 10, taxLabel: 'Consumption tax' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', taxRate: 16, taxLabel: 'GST' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', taxRate: 12, taxLabel: 'VAT' },
  { code: 'KE', name: 'Kenya', currency: 'KES', taxRate: 16, taxLabel: 'VAT' },
  { code: 'KI', name: 'Kiribati', currency: 'AUD', taxRate: 12.5, taxLabel: 'VAT' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', taxRate: 0, taxLabel: 'None' },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', taxRate: 12, taxLabel: 'VAT' },
  { code: 'LA', name: 'Laos', currency: 'LAK', taxRate: 10, taxLabel: 'VAT' },
  { code: 'LV', name: 'Latvia', currency: 'EUR', taxRate: 21, taxLabel: 'VAT' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', taxRate: 11, taxLabel: 'VAT' },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', taxRate: 15, taxLabel: 'VAT' },
  { code: 'LR', name: 'Liberia', currency: 'LRD', taxRate: 10, taxLabel: 'GST' },
  { code: 'LY', name: 'Libya', currency: 'LYD', taxRate: 0, taxLabel: 'None' },
  { code: 'LI', name: 'Liechtenstein', currency: 'CHF', taxRate: 8.1, taxLabel: 'VAT' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR', taxRate: 21, taxLabel: 'VAT' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', taxRate: 17, taxLabel: 'VAT' },
  { code: 'MO', name: 'Macau', currency: 'MOP', taxRate: 0, taxLabel: 'None' },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', taxRate: 20, taxLabel: 'VAT' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', taxRate: 16.5, taxLabel: 'VAT' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', taxRate: 8, taxLabel: 'SST' },
  { code: 'MV', name: 'Maldives', currency: 'MVR', taxRate: 8, taxLabel: 'GST' },
  { code: 'ML', name: 'Mali', currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'MT', name: 'Malta', currency: 'EUR', taxRate: 18, taxLabel: 'VAT' },
  { code: 'MR', name: 'Mauritania', currency: 'MRU', taxRate: 16, taxLabel: 'VAT' },
  { code: 'MU', name: 'Mauritius', currency: 'MUR', taxRate: 15, taxLabel: 'VAT' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', taxRate: 16, taxLabel: 'IVA' },
  { code: 'MD', name: 'Moldova', currency: 'MDL', taxRate: 20, taxLabel: 'VAT' },
  { code: 'MC', name: 'Monaco', currency: 'EUR', taxRate: 20, taxLabel: 'TVA' },
  { code: 'MN', name: 'Mongolia', currency: 'MNT', taxRate: 10, taxLabel: 'VAT' },
  { code: 'ME', name: 'Montenegro', currency: 'EUR', taxRate: 21, taxLabel: 'VAT' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', taxRate: 20, taxLabel: 'VAT' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', taxRate: 16, taxLabel: 'VAT' },
  { code: 'MM', name: 'Myanmar', currency: 'MMK', taxRate: 5, taxLabel: 'Commercial tax' },
  { code: 'NA', name: 'Namibia', currency: 'NAD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', taxRate: 13, taxLabel: 'VAT' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', taxRate: 21, taxLabel: 'BTW' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', taxRate: 15, taxLabel: 'GST' },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', taxRate: 15, taxLabel: 'IVA' },
  { code: 'NE', name: 'Niger', currency: 'XOF', taxRate: 19, taxLabel: 'VAT' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', taxRate: 7.5, taxLabel: 'VAT' },
  { code: 'MK', name: 'North Macedonia', currency: 'MKD', taxRate: 18, taxLabel: 'VAT' },
  { code: 'NO', name: 'Norway', currency: 'NOK', taxRate: 25, taxLabel: 'MVA' },
  { code: 'OM', name: 'Oman', currency: 'OMR', taxRate: 5, taxLabel: 'VAT' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', taxRate: 18, taxLabel: 'GST' },
  { code: 'PS', name: 'Palestine', currency: 'ILS', taxRate: 16, taxLabel: 'VAT' },
  { code: 'PA', name: 'Panama', currency: 'PAB', taxRate: 7, taxLabel: 'ITBMS' },
  { code: 'PG', name: 'Papua New Guinea', currency: 'PGK', taxRate: 10, taxLabel: 'GST' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', taxRate: 10, taxLabel: 'IVA' },
  { code: 'PE', name: 'Peru', currency: 'PEN', taxRate: 18, taxLabel: 'IGV' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', taxRate: 12, taxLabel: 'VAT' },
  { code: 'PL', name: 'Poland', currency: 'PLN', taxRate: 23, taxLabel: 'VAT' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', taxRate: 23, taxLabel: 'IVA' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', taxRate: 0, taxLabel: 'None' },
  { code: 'RO', name: 'Romania', currency: 'RON', taxRate: 21, taxLabel: 'VAT' },
  { code: 'RU', name: 'Russia', currency: 'RUB', taxRate: 20, taxLabel: 'VAT' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'KN', name: 'Saint Kitts and Nevis', currency: 'XCD', taxRate: 17, taxLabel: 'VAT' },
  { code: 'LC', name: 'Saint Lucia', currency: 'XCD', taxRate: 12.5, taxLabel: 'VAT' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', currency: 'XCD', taxRate: 16, taxLabel: 'VAT' },
  { code: 'WS', name: 'Samoa', currency: 'WST', taxRate: 15, taxLabel: 'VAGST' },
  { code: 'SM', name: 'San Marino', currency: 'EUR', taxRate: 0, taxLabel: 'None' },
  { code: 'ST', name: 'São Tomé and Príncipe', currency: 'STN', taxRate: 15, taxLabel: 'VAT' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', taxRate: 15, taxLabel: 'VAT' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'RS', name: 'Serbia', currency: 'RSD', taxRate: 20, taxLabel: 'VAT' },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', taxRate: 15, taxLabel: 'VAT' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLE', taxRate: 15, taxLabel: 'GST' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', taxRate: 9, taxLabel: 'GST' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR', taxRate: 23, taxLabel: 'VAT' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR', taxRate: 22, taxLabel: 'VAT' },
  { code: 'SB', name: 'Solomon Islands', currency: 'SBD', taxRate: 15, taxLabel: 'VAT' },
  { code: 'SO', name: 'Somalia', currency: 'SOS', taxRate: 5, taxLabel: 'Sales tax' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', taxRate: 15, taxLabel: 'VAT' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', taxRate: 10, taxLabel: 'VAT' },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', taxRate: 18, taxLabel: 'VAT' },
  { code: 'ES', name: 'Spain', currency: 'EUR', taxRate: 21, taxLabel: 'IVA' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', taxRate: 18, taxLabel: 'VAT' },
  { code: 'SD', name: 'Sudan', currency: 'SDG', taxRate: 17, taxLabel: 'VAT' },
  { code: 'SR', name: 'Suriname', currency: 'SRD', taxRate: 10, taxLabel: 'VAT' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', taxRate: 25, taxLabel: 'MOMS' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', taxRate: 8.1, taxLabel: 'VAT' },
  { code: 'SY', name: 'Syria', currency: 'SYP', taxRate: 0, taxLabel: 'None' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', taxRate: 5, taxLabel: 'VAT' },
  { code: 'TJ', name: 'Tajikistan', currency: 'TJS', taxRate: 14, taxLabel: 'VAT' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', taxRate: 18, taxLabel: 'VAT' },
  { code: 'TH', name: 'Thailand', currency: 'THB', taxRate: 7, taxLabel: 'VAT' },
  { code: 'TL', name: 'Timor-Leste', currency: 'USD', taxRate: 0, taxLabel: 'None' },
  { code: 'TG', name: 'Togo', currency: 'XOF', taxRate: 18, taxLabel: 'VAT' },
  { code: 'TO', name: 'Tonga', currency: 'TOP', taxRate: 15, taxLabel: 'CT' },
  { code: 'TT', name: 'Trinidad and Tobago', currency: 'TTD', taxRate: 12.5, taxLabel: 'VAT' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', taxRate: 19, taxLabel: 'VAT' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', taxRate: 20, taxLabel: 'KDV' },
  { code: 'TM', name: 'Turkmenistan', currency: 'TMT', taxRate: 15, taxLabel: 'VAT' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', taxRate: 18, taxLabel: 'VAT' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', taxRate: 20, taxLabel: 'VAT' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', taxRate: 5, taxLabel: 'VAT' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxRate: 20, taxLabel: 'VAT' },
  { code: 'US', name: 'United States', currency: 'USD', taxRate: 0, taxLabel: 'Sales tax', note: 'Set by state and city — there is no national rate.' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', taxRate: 22, taxLabel: 'IVA' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', taxRate: 12, taxLabel: 'VAT' },
  { code: 'VU', name: 'Vanuatu', currency: 'VUV', taxRate: 15, taxLabel: 'VAT' },
  { code: 'VE', name: 'Venezuela', currency: 'VES', taxRate: 16, taxLabel: 'IVA' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', taxRate: 10, taxLabel: 'VAT' },
  { code: 'YE', name: 'Yemen', currency: 'YER', taxRate: 5, taxLabel: 'GST' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', taxRate: 16, taxLabel: 'VAT' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWG', taxRate: 15, taxLabel: 'VAT' },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | null | undefined): CountryPreset | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.trim().toUpperCase());
}

/** Every distinct currency used by a country preset, sorted. */
export function currenciesFromCountries(): string[] {
  return [...new Set(COUNTRIES.map((c) => c.currency))].sort();
}

/** Case-insensitive search over country name and code. */
export function searchCountries(query: string): CountryPreset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return COUNTRIES;
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase() === needle
  );
}

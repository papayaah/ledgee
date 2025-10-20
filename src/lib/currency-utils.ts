/**
 * Currency formatting utilities that respect locale and currency settings
 */

/**
 * Format a number as currency using the appropriate locale and currency code
 * @param amount - The amount to format
 * @param currency - The currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')
 * @param locale - The locale to use for formatting (defaults to 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'USD', 
  locale: string = 'en-US'
): string {
  if (!amount || !isFinite(amount)) {
    amount = 0;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    // Fallback to USD if currency is invalid
    console.warn(`Invalid currency code: ${currency}, falling back to USD`);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
}

/**
 * Get the appropriate locale for a given currency
 * This provides better formatting for different currencies
 */
export function getLocaleForCurrency(currency: string): string {
  const currencyLocaleMap: Record<string, string> = {
    'USD': 'en-US',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
    'JPY': 'ja-JP',
    'CAD': 'en-CA',
    'AUD': 'en-AU',
    'CHF': 'de-CH',
    'SEK': 'sv-SE',
    'NOK': 'nb-NO',
    'DKK': 'da-DK',
    'PLN': 'pl-PL',
    'CZK': 'cs-CZ',
    'HUF': 'hu-HU',
    'BRL': 'pt-BR',
    'MXN': 'es-MX',
    'INR': 'en-IN',
    'CNY': 'zh-CN',
    'KRW': 'ko-KR',
    'SGD': 'en-SG',
    'HKD': 'zh-HK',
    'NZD': 'en-NZ',
    'ZAR': 'en-ZA',
    'RUB': 'ru-RU',
    'TRY': 'tr-TR',
    'ILS': 'he-IL',
    'AED': 'ar-AE',
    'SAR': 'ar-SA',
    'QAR': 'ar-QA',
    'KWD': 'ar-KW',
    'BHD': 'ar-BH',
    'OMR': 'ar-OM',
    'JOD': 'ar-JO',
    'EGP': 'ar-EG',
    'MAD': 'ar-MA',
    'TND': 'ar-TN',
    'DZD': 'ar-DZ',
    'LYD': 'ar-LY',
    'SDG': 'ar-SD',
    'ETB': 'am-ET',
    'KES': 'sw-KE',
    'UGX': 'sw-UG',
    'TZS': 'sw-TZ',
    'RWF': 'rw-RW',
    'BIF': 'rn-BI',
    'MUR': 'en-MU',
    'SCR': 'en-SC',
    'MGA': 'mg-MG',
    'KMF': 'ar-KM',
    'DJF': 'ar-DJ',
    'SOS': 'so-SO',
    'ERN': 'ti-ER',
    'SHP': 'en-SH',
    'FKP': 'en-FK',
    'GIP': 'en-GI',
    'GGP': 'en-GG',
    'JEP': 'en-JE',
    'IMP': 'en-IM',
    'AOA': 'pt-AO',
    'BWP': 'en-BW',
    'LSL': 'st-LS',
    'MZN': 'pt-MZ',
    'NAD': 'en-NA',
    'SZL': 'ss-SZ',
    'ZMW': 'en-ZM',
    'ZWL': 'en-ZW',
    'MWK': 'en-MW',
    'BND': 'ms-BN',
    'KHR': 'km-KH',
    'LAK': 'lo-LA',
    'MMK': 'my-MM',
    'VND': 'vi-VN',
    'IDR': 'id-ID',
    'MYR': 'ms-MY',
    'PHP': 'en-PH',
    'THB': 'th-TH',
    'XPF': 'fr-PF',
    'TOP': 'to-TO',
    'WST': 'sm-WS',
    'VUV': 'bi-VU',
    'SBD': 'en-SB',
    'PGK': 'en-PG',
    'FJD': 'en-FJ',
    'BTN': 'dz-BT',
    'NPR': 'ne-NP',
    'PKR': 'ur-PK',
    'LKR': 'si-LK',
    'MVR': 'dv-MV',
    'BDT': 'bn-BD',
    'AFN': 'fa-AF',
    'IRR': 'fa-IR',
    'IQD': 'ar-IQ',
    'KZT': 'kk-KZ',
    'UZS': 'uz-UZ',
    'TJS': 'tg-TJ',
    'KGS': 'ky-KG',
    'TMT': 'tk-TM',
    'AZN': 'az-AZ',
    'AMD': 'hy-AM',
    'GEL': 'ka-GE',
    'UAH': 'uk-UA',
    'BYN': 'be-BY',
    'MDL': 'ro-MD',
    'RON': 'ro-RO',
    'BGN': 'bg-BG',
    'HRK': 'hr-HR',
    'RSD': 'sr-RS',
    'MKD': 'mk-MK',
    'ALL': 'sq-AL',
    'BAM': 'bs-BA',
    'MNT': 'mn-MN',
  };

  return currencyLocaleMap[currency] || 'en-US';
}

/**
 * Format currency with automatic locale detection
 */
export function formatCurrencyWithLocale(amount: number, currency: string = 'USD'): string {
  const locale = getLocaleForCurrency(currency);
  return formatCurrency(amount, currency, locale);
}

/**
 * Extract currency symbol from formatted currency string
 */
export function getCurrencySymbol(currency: string, locale: string = 'en-US'): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    });
    
    // Get the currency symbol by formatting a small amount and extracting the symbol
    const formatted = formatter.formatToParts(0);
    const currencyPart = formatted.find(part => part.type === 'currency');
    return currencyPart?.value || currency;
  } catch {
    return currency;
  }
}

/**
 * Parse a currency amount from a string, handling various formats
 */
export function parseCurrencyAmount(amountStr: string): { amount: number; currency: string } {
  if (!amountStr) {
    return { amount: 0, currency: 'USD' };
  }

  // Remove common currency symbols and clean the string
  const cleaned = amountStr.replace(/[^\d.,\s-]/g, '').trim();
  
  // Extract currency code from the original string if present
  const currencyMatch = amountStr.match(/[A-Z]{3}/);
  const currency = currencyMatch ? currencyMatch[0] : 'USD';
  
  // Parse the numeric amount
  let amount = 0;
  if (cleaned) {
    // Handle different decimal separators (comma vs period)
    const normalized = cleaned.replace(',', '.');
    amount = parseFloat(normalized) || 0;
  }
  
  return { amount, currency };
}

/**
 * Format multiple currencies for display
 * @param amountsByCurrency - Object with currency codes as keys and amounts as values
 * @param primaryCurrency - The currency to display first/primary
 * @returns Formatted string showing all currencies
 */
export function formatMultipleCurrencies(
  amountsByCurrency: Record<string, number>,
  primaryCurrency?: string
): string {
  const currencies = Object.keys(amountsByCurrency);
  
  if (currencies.length === 0) {
    return formatCurrency(0, 'USD');
  }
  
  if (currencies.length === 1) {
    const currency = currencies[0];
    return formatCurrencyWithLocale(amountsByCurrency[currency], currency);
  }
  
  // Sort currencies with primary first
  const sortedCurrencies = [...currencies].sort((a, b) => {
    if (primaryCurrency) {
      if (a === primaryCurrency) return -1;
      if (b === primaryCurrency) return 1;
    }
    return a.localeCompare(b);
  });
  
  // Format each currency
  const formatted = sortedCurrencies.map(currency => 
    formatCurrencyWithLocale(amountsByCurrency[currency], currency)
  );
  
  return formatted.join(' + ');
}

/**
 * Get currency information for display
 * @param currency - Currency code
 * @returns Object with currency display information
 */
export function getCurrencyInfo(currency: string) {
  const locale = getLocaleForCurrency(currency);
  const symbol = getCurrencySymbol(currency, locale);
  
  return {
    code: currency,
    symbol,
    locale,
    name: getCurrencyName(currency)
  };
}

/**
 * Get human-readable currency name
 */
function getCurrencyName(currency: string): string {
  const currencyNames: Record<string, string> = {
    'USD': 'US Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound',
    'JPY': 'Japanese Yen',
    'CAD': 'Canadian Dollar',
    'AUD': 'Australian Dollar',
    'CHF': 'Swiss Franc',
    'SEK': 'Swedish Krona',
    'NOK': 'Norwegian Krone',
    'DKK': 'Danish Krone',
    'PLN': 'Polish Zloty',
    'CZK': 'Czech Koruna',
    'HUF': 'Hungarian Forint',
    'BRL': 'Brazilian Real',
    'MXN': 'Mexican Peso',
    'INR': 'Indian Rupee',
    'CNY': 'Chinese Yuan',
    'KRW': 'South Korean Won',
    'SGD': 'Singapore Dollar',
    'HKD': 'Hong Kong Dollar',
    'NZD': 'New Zealand Dollar',
    'ZAR': 'South African Rand',
    'RUB': 'Russian Ruble',
    'TRY': 'Turkish Lira',
    'ILS': 'Israeli Shekel',
    'AED': 'UAE Dirham',
    'SAR': 'Saudi Riyal',
    'QAR': 'Qatari Riyal',
    'KWD': 'Kuwaiti Dinar',
    'BHD': 'Bahraini Dinar',
    'OMR': 'Omani Rial',
    'JOD': 'Jordanian Dinar',
    'EGP': 'Egyptian Pound',
    'MAD': 'Moroccan Dirham',
    'TND': 'Tunisian Dinar',
    'DZD': 'Algerian Dinar',
    'LYD': 'Libyan Dinar',
    'SDG': 'Sudanese Pound',
    'ETB': 'Ethiopian Birr',
    'KES': 'Kenyan Shilling',
    'UGX': 'Ugandan Shilling',
    'TZS': 'Tanzanian Shilling',
    'RWF': 'Rwandan Franc',
    'BIF': 'Burundian Franc',
    'MUR': 'Mauritian Rupee',
    'SCR': 'Seychellois Rupee',
    'MGA': 'Malagasy Ariary',
    'KMF': 'Comorian Franc',
    'DJF': 'Djiboutian Franc',
    'SOS': 'Somali Shilling',
    'ERN': 'Eritrean Nakfa',
    'SHP': 'Saint Helena Pound',
    'FKP': 'Falkland Islands Pound',
    'GIP': 'Gibraltar Pound',
    'GGP': 'Guernsey Pound',
    'JEP': 'Jersey Pound',
    'IMP': 'Isle of Man Pound',
    'AOA': 'Angolan Kwanza',
    'BWP': 'Botswana Pula',
    'LSL': 'Lesotho Loti',
    'MZN': 'Mozambican Metical',
    'NAD': 'Namibian Dollar',
    'SZL': 'Swazi Lilangeni',
    'ZMW': 'Zambian Kwacha',
    'ZWL': 'Zimbabwean Dollar',
    'MWK': 'Malawian Kwacha',
    'BND': 'Brunei Dollar',
    'KHR': 'Cambodian Riel',
    'LAK': 'Lao Kip',
    'MMK': 'Myanmar Kyat',
    'VND': 'Vietnamese Dong',
    'IDR': 'Indonesian Rupiah',
    'MYR': 'Malaysian Ringgit',
    'PHP': 'Philippine Peso',
    'THB': 'Thai Baht',
    'XPF': 'CFP Franc',
    'TOP': 'Tongan Paʻanga',
    'WST': 'Samoan Tala',
    'VUV': 'Vanuatu Vatu',
    'SBD': 'Solomon Islands Dollar',
    'PGK': 'Papua New Guinea Kina',
    'FJD': 'Fijian Dollar',
    'BTN': 'Bhutanese Ngultrum',
    'NPR': 'Nepalese Rupee',
    'PKR': 'Pakistani Rupee',
    'LKR': 'Sri Lankan Rupee',
    'MVR': 'Maldivian Rufiyaa',
    'BDT': 'Bangladeshi Taka',
    'AFN': 'Afghan Afghani',
    'IRR': 'Iranian Rial',
    'IQD': 'Iraqi Dinar',
    'KZT': 'Kazakhstani Tenge',
    'UZS': 'Uzbekistani Som',
    'TJS': 'Tajikistani Somoni',
    'KGS': 'Kyrgyzstani Som',
    'TMT': 'Turkmenistani Manat',
    'AZN': 'Azerbaijani Manat',
    'AMD': 'Armenian Dram',
    'GEL': 'Georgian Lari',
    'UAH': 'Ukrainian Hryvnia',
    'BYN': 'Belarusian Ruble',
    'MDL': 'Moldovan Leu',
    'RON': 'Romanian Leu',
    'BGN': 'Bulgarian Lev',
    'HRK': 'Croatian Kuna',
    'RSD': 'Serbian Dinar',
    'MKD': 'Macedonian Denar',
    'ALL': 'Albanian Lek',
    'BAM': 'Bosnia and Herzegovina Convertible Mark',
    'MNT': 'Mongolian Tugrik'
  };
  
  return currencyNames[currency] || currency;
}

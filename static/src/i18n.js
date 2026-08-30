/**
 * i18n.js - 軽量 JavaScript i18n レイヤー
 * 
 * 仕様:
 * - 現在の locale のみをロード
 * - 翻訳キーを使用して文字列を取得
 * - Intl API を使用した日付・数値フォーマット
 * - Locale fallback 対応
 * - ユーザー設定の保存
 */

// 設定
const I18N_CONFIG = {
  // 英語を最終的なフォールバック（デフォルト）として使用。
  // ブラウザの navigator.languages の優先順位に対応する言語があれば、そちらを優先する。
  defaultLocale: 'en',
  supportedLocales: ['ja', 'en'],
  localesPath: '/locales/',
  cacheKey: 'materialblue_locale'
};

// 翻訳データのキャッシュ
let translationsCache = {};
let currentLocale = null;
let localePromise = null;

/**
 * Locale 決定ルール
 * 1. ユーザーが明示的に設定した言語 (localStorage)
 * 2. ブラウザの言語設定 (navigator.languages) を上位から順に確認
 * 3. navigator.language
 * 4. デフォルト locale (en)
 */
function detectLocale() {
  // 1. ユーザー設定
  const savedLocale = localStorage.getItem(I18N_CONFIG.cacheKey);
  if (savedLocale && I18N_CONFIG.supportedLocales.includes(savedLocale)) {
    return savedLocale;
  }

  // 2-3. ブラウザ設定
  // navigator.languages はブラウザの「優先言語」リストを優先順位順に返す。
  const browserLocales = navigator.languages?.length
    ? navigator.languages
    : (navigator.language ? [navigator.language] : []);
  
  for (const locale of browserLocales) {
    // 完全一致
    if (I18N_CONFIG.supportedLocales.includes(locale)) {
      return locale;
    }
    
    // Language part で一致 (例：en-US -> en, ja-JP -> ja)
    const langPart = locale.split('-')[0];
    if (I18N_CONFIG.supportedLocales.includes(langPart)) {
      return langPart;
    }
  }

  // 4. デフォルト（英語）
  return I18N_CONFIG.defaultLocale;
}

/**
 * Locale fallback チェーンを生成
 * 例：en-US -> [en-US, en, en]
 */
function getFallbackChain(locale) {
  const chain = [locale];
  const parts = locale.split('-');
  
  if (parts.length > 1) {
    chain.push(parts[0]);
  }
  
  // デフォルト locale を最後に追加（ただし重複しない場合）
  if (!chain.includes(I18N_CONFIG.defaultLocale)) {
    chain.push(I18N_CONFIG.defaultLocale);
  }
  
  return chain;
}

/**
 * 指定された locale の翻訳データを読み込む
 */
async function loadTranslations(locale) {
  // キャッシュから取得
  if (translationsCache[locale]) {
    return translationsCache[locale];
  }

  try {
    const response = await fetch(`${I18N_CONFIG.localesPath}${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${locale}`);
    }
    const translations = await response.json();
    translationsCache[locale] = translations;
    return translations;
  } catch (error) {
    console.warn(`Could not load translations for ${locale}:`, error);
    return {};
  }
}

/**
 * 翻訳キーに対応する文字列を取得
 * Fallback チェーンに従って検索
 */
function getTranslation(key, locale = currentLocale) {
  const fallbackChain = getFallbackChain(locale);
  
  for (const loc of fallbackChain) {
    const translations = translationsCache[loc];
    if (translations && translations[key] !== undefined) {
      return translations[key];
    }
  }
  
  // どの locale にも存在しない場合はキーを返す（開発環境では警告）
  if (typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'development') {
    console.warn(`Missing translation for key: ${key}`);
  }

  return key;
}

/**
 * 翻訳パラメータを置換
 * 例："{count}分前" + { count: 5 } -> "5 分前"
 */
function interpolate(text, params = {}) {
  if (!text || typeof text !== 'string') return text;
  
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return params.hasOwnProperty(key) ? params[key] : match;
  });
}

/**
 * メイン API: t(key, params)
 * 例：t("common.save") -> "保存"
 * 例：t("datetime.minutesAgo", { count: 5 }) -> "5 分前"
 */
export function t(key, params = {}) {
  const text = getTranslation(key);
  return interpolate(text, params);
}

/**
 * 日付フォーマット (Intl.DateTimeFormat)
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  return new Intl.DateTimeFormat(currentLocale, mergedOptions).format(new Date(date));
}

/**
 * 相対時間フォーマット
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now - target;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return t('datetime.justNow');
  } else if (diffMins < 60) {
    return t('datetime.minutesAgo', { count: diffMins });
  } else if (diffHours < 24) {
    return t('datetime.hoursAgo', { count: diffHours });
  } else {
    return t('datetime.daysAgo', { count: diffDays });
  }
}

/**
 * 数値フォーマット (Intl.NumberFormat)
 */
export function formatNumber(number, options = {}) {
  return new Intl.NumberFormat(currentLocale, options).format(number);
}

/**
 * 短縮数値フォーマット (例：1234 -> 1.2K)
 */
export function formatCompactNumber(number) {
  return new Intl.NumberFormat(currentLocale, {
    notation: 'compact',
    compactDisplay: 'short'
  }).format(number);
}

/**
 * Locale を設定
 */
export async function setLocale(locale) {
  if (!I18N_CONFIG.supportedLocales.includes(locale)) {
    console.warn(`Locale ${locale} is not supported`);
    locale = I18N_CONFIG.defaultLocale;
  }

  // 翻訳データをロード
  await loadTranslations(locale);
  
  // フォールバック用のデフォルト locale もロード
  if (locale !== I18N_CONFIG.defaultLocale) {
    await loadTranslations(I18N_CONFIG.defaultLocale);
  }

  currentLocale = locale;
  
  // ユーザー設定を保存
  localStorage.setItem(I18N_CONFIG.cacheKey, locale);
  
  // HTML の lang 属性を更新
  document.documentElement.lang = locale;
  
  // UI を更新
  updateAllTranslations();
  
  return locale;
}

/**
 * 初期化
 */
export async function initI18n() {
  const detectedLocale = detectLocale();
  await setLocale(detectedLocale);
  return currentLocale;
}

/**
 * 現在の locale を取得
 */
export function getCurrentLocale() {
  return currentLocale;
}

/**
 * ページ内のすべての翻訳要素を更新
 * data-i18n 属性を持つ要素を対象とする
 */
export function updateAllTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const params = {};
    
    // data-i18n-* 属性からパラメータを取得
    Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-i18n-param-'))
      .forEach(attr => {
        const paramName = attr.name.replace('data-i18n-param-', '');
        params[paramName] = attr.value;
      });
    
    element.textContent = t(key, params);
  });
  
  // aria-label の翻訳
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    const key = element.getAttribute('data-i18n-aria');
    element.setAttribute('aria-label', t(key));
  });
  
  // title 属性の翻訳
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.setAttribute('title', t(key));
  });
  
  // placeholder の翻訳
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.setAttribute('placeholder', t(key));
  });
  
  // label の翻訳 (md-select, md-text-field など)
  document.querySelectorAll('[data-i18n-label]').forEach(element => {
    const key = element.getAttribute('data-i18n-label');
    if (element.label !== undefined) {
      element.label = t(key);
    }
  });
  
  // supportingText の翻訳 (md-select, md-text-field など)
  document.querySelectorAll('[data-i18n-supporting-text]').forEach(element => {
    const key = element.getAttribute('data-i18n-supporting-text');
    if (element.supportingText !== undefined) {
      element.supportingText = t(key);
    }
  });
}

/**
 * 翻訳漏れ検出用スクリプト（開発環境用）
 */
export function checkTranslationKeys() {
  const jaKeys = Object.keys(translationsCache['ja'] || {});
  const enKeys = Object.keys(translationsCache['en'] || {});
  
  const missingInEn = jaKeys.filter(key => !enKeys.includes(key));
  const missingInJa = enKeys.filter(key => !jaKeys.includes(key));
  
  if (missingInEn.length > 0) {
    console.warn('Missing translations in en.json:', missingInEn);
  }
  if (missingInJa.length > 0) {
    console.warn('Missing translations in ja.json:', missingInJa);
  }
  
  return { missingInEn, missingInJa };
}

// デフォルトエクスポート
export default {
  t,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatCompactNumber,
  setLocale,
  initI18n,
  getCurrentLocale,
  updateAllTranslations,
  checkTranslationKeys
};

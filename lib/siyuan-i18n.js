// Add i18n support https://github.com/siyuan-note/siyuan/issues/13559
let siyuanLangData = null;
let siyuanLangCode = null;

const SIYUAN_LANG_OPTIONS = [
    ["ar", "العربية"],
    ["de", "Deutsch"],
    ["en", "English"],
    ["es", "Español"],
    ["fr", "Français"],
    ["he", "עברית"],
    ["hi", "हिन्दी"],
    ["id", "Bahasa Indonesia"],
    ["it", "Italiano"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["nl", "Nederlands"],
    ["pl", "Polski"],
    ["pt_BR", "Português (Brasil)"],
    ["ru", "Русский"],
    ["sk", "Slovenčina"],
    ["th", "ไทย"],
    ["tr", "Türkçe"],
    ["uk", "Українська"],
    ["zh_TW", "繁體中文"],
    ["zh_CN", "简体中文"],
];

const SIYUAN_AVAILABLE_LOCALES = new Set(SIYUAN_LANG_OPTIONS.map(([code]) => code));

function siyuanResolveLocale(lang) {
    if (!lang) return "en";
    const code = String(lang).replace("-", "_");
    const lower = code.toLowerCase();
    if (lower.startsWith("zh")) {
        return /tw|hk|mo|hant/.test(lower) ? "zh_TW" : "zh_CN";
    }
    if (SIYUAN_AVAILABLE_LOCALES.has(code)) return code;
    const base = code.split("_")[0];
    if (SIYUAN_AVAILABLE_LOCALES.has(base)) return base;
    return "en";
}

function siyuanGetDefaultLangCode() {
    const raw = chrome.i18n.getUILanguage() || navigator.language || navigator.userLanguage || "en";
    return siyuanResolveLocale(raw);
}

function siyuanGetLangCode() {
    return siyuanLangCode;
}

function siyuanGetMessage(key) {
    return siyuanLangData?.[key]?.message || chrome.i18n.getMessage(key);
}

// 合并当前语言和英语（en）翻译的函数
async function siyuanMergeTranslations(translations, langCode) {
    // 默认语言是英语（en）
    const defaultLangCode = "en";

    // 加载英语（en）翻译文件
    let defaultTranslations = {};

    // 如果当前语言不是英语，则加载英语翻译文件
    if (langCode !== defaultLangCode) {
        const enTranslationFile = chrome.runtime.getURL(`_locales/${defaultLangCode}/messages.json`);
        try {
            const response = await fetch(enTranslationFile);
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            defaultTranslations = await response.json();
        } catch (err) {
            console.error("Failed to load English translation:", err);
        }
    }

    // 合并当前语言翻译和英语翻译，缺失的字段使用英语翻译
    return { ...defaultTranslations, ...translations };
}

async function siyuanLoadLanguageFile(langCode) {
    const normalized = siyuanResolveLocale(langCode);

    if (siyuanLangData && siyuanLangCode === normalized) {
        return siyuanLangData;
    }

    const tryLoad = async (code) => {
        try {
            const translationFile = chrome.runtime.getURL(`_locales/${code}/messages.json`);
            const response = await fetch(translationFile);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            return null;
        }
    };

    let data = await tryLoad(normalized);
    if (!data) data = await tryLoad("en");
    if (!data) data = {};

    const mergedData = await siyuanMergeTranslations(data, normalized);
    siyuanLangData = mergedData;
    siyuanLangCode = normalized;
    return mergedData;
}

async function siyuanInitLanguageFromStorage() {
    const items = await chrome.storage.sync.get({ langCode: siyuanGetDefaultLangCode() });
    return siyuanLoadLanguageFile(items.langCode);
}

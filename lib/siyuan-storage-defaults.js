const SIYUAN_DEFAULT_KERNEL_IP = "http://127.0.0.1:6806";
const SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE = "/";
const SIYUAN_DEFAULT_SAVE_PATH_MODE = "search";

// 默认剪藏模板（用于首次加载与恢复默认）
const SIYUAN_DEFAULT_CLIP_TEMPLATE =
    "---\n" +
    "\n" +
    '- ${title}${siteName ? " - " + siteName : ""}\n' +
    "- [${urlDecoded}](${url}) \n" +
    '${excerpt ? "- " + excerpt : ""}\n' +
    "- ${date} ${time}\n" +
    "\n" +
    "---\n" +
    "\n" +
    "${content}";

const SIYUAN_STORAGE_DEFAULTS = {
    ip: SIYUAN_DEFAULT_KERNEL_IP,
    showTip: true,
    token: "",
    savePathMode: SIYUAN_DEFAULT_SAVE_PATH_MODE,
    searchNotebook: "",
    searchPath: "",
    searchParentDoc: "",
    templateNotebook: "",
    savePathTemplate: SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE,
    tags: "",
    searchDatabaseKey: "",
    selectedDatabaseID: "",
    selectedDatabaseName: "",
    assets: true,
    exp: false,
    expOpenAfterClip: false,
    expSpan: false,
    expBold: false,
    expItalic: false,
    expUnderline: false,
    expRemoveImgLink: false,
    expListDocTree: false,
    expSvgToImg: false,
};

function siyuanLegacyHPathToTemplate(parentHPath) {
    const hPath = String(parentHPath || "").trim();
    if (!hPath) return SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE;
    const slashIndex = hPath.indexOf("/");
    const path = slashIndex >= 0 ? hPath.slice(slashIndex) : hPath;
    return path.startsWith("/") ? path : "/" + path;
}

function siyuanNormalizeSavePath(path) {
    let normalized = String(path || "").trim().replaceAll("\\", "/");
    normalized = normalized.replace(/\/{2,}/g, "/");
    if (!normalized) return "";
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "");
    return normalized;
}

function siyuanIsDynamicSavePath(template) {
    return String(template || "").includes("{{");
}

function siyuanGetActiveSavePathSettings(items) {
    if (items.savePathMode === "template") {
        return {
            savePathMode: "template",
            notebook: items.templateNotebook || "",
            parentDoc: "",
            savePathTemplate: items.savePathTemplate || SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE,
        };
    }
    return {
        savePathMode: SIYUAN_DEFAULT_SAVE_PATH_MODE,
        notebook: items.searchNotebook || "",
        parentDoc: items.searchParentDoc || "",
        savePathTemplate: siyuanNormalizeSavePath(items.searchPath),
    };
}

async function siyuanLoadStorageSettings() {
    const stored = await chrome.storage.sync.get(null);
    const items = { ...SIYUAN_STORAGE_DEFAULTS, ...stored };
    const legacyNotebook = stored.notebook || "";
    const legacyTemplate = Object.prototype.hasOwnProperty.call(stored, "savePathTemplate")
        ? stored.savePathTemplate || SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE
        : siyuanLegacyHPathToTemplate(stored.parentHPath);
    const migration = {};

    if (!Object.prototype.hasOwnProperty.call(stored, "savePathMode")) {
        const dynamic = siyuanIsDynamicSavePath(legacyTemplate);
        migration.savePathMode = dynamic ? "template" : SIYUAN_DEFAULT_SAVE_PATH_MODE;
        migration.searchNotebook = dynamic ? "" : legacyNotebook;
        migration.searchPath = dynamic ? "" : siyuanNormalizeSavePath(legacyTemplate);
        migration.searchParentDoc = dynamic ? "" : stored.parentDoc || "";
        migration.templateNotebook = legacyNotebook;
        migration.savePathTemplate = legacyTemplate;
    }
    if (Object.keys(migration).length > 0) {
        Object.assign(items, migration);
        await chrome.storage.sync.set(migration);
    }
    const legacyKeys = ["notebook", "searchKey", "parentDoc", "parentHPath", "dirsFirst"];
    if (legacyKeys.some((key) => Object.prototype.hasOwnProperty.call(stored, key))) {
        await chrome.storage.sync.remove(legacyKeys);
    }
    return items;
}

const SIYUAN_EXP_STORAGE_KEYS = ["expSpan", "expBold", "expItalic", "expUnderline", "expRemoveImgLink", "expSvgToImg"];

function siyuanStorageDefaultsFor(keys) {
    return Object.fromEntries(keys.map((key) => [key, SIYUAN_STORAGE_DEFAULTS[key]]));
}

/** @param {{ token?: string, notebook?: string, savePathTemplate?: string }} options */
function siyuanValidateClipPrereqs({ token, notebook, savePathTemplate }) {
    if (!token || !String(token).trim()) {
        return { ok: false, error: "tip_token_miss" };
    }
    if (!notebook || !savePathTemplate) {
        return { ok: false, error: "tip_save_path_miss" };
    }
    return { ok: true };
}

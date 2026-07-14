const SIYUAN_DEFAULT_KERNEL_IP = "http://127.0.0.1:6806";
const SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE = "/";

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
    notebook: "",
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

async function siyuanLoadStorageSettings() {
    const stored = await chrome.storage.sync.get(null);
    const items = { ...SIYUAN_STORAGE_DEFAULTS, ...stored };
    if (!Object.prototype.hasOwnProperty.call(stored, "savePathTemplate")) {
        items.savePathTemplate = siyuanLegacyHPathToTemplate(stored.parentHPath);
        await chrome.storage.sync.set({ savePathTemplate: items.savePathTemplate });
    }
    const legacyKeys = ["searchKey", "parentDoc", "parentHPath", "dirsFirst"];
    if (legacyKeys.some((key) => Object.prototype.hasOwnProperty.call(stored, key))) {
        await chrome.storage.sync.remove(legacyKeys);
    }
    return items;
}

const SIYUAN_EXP_STORAGE_KEYS = ["expSpan", "expBold", "expItalic", "expUnderline", "expRemoveImgLink", "expSvgToImg"];

function siyuanStorageDefaultsFor(keys) {
    return Object.fromEntries(keys.map((key) => [key, SIYUAN_STORAGE_DEFAULTS[key]]));
}

/** @param {{ token?: string, notebook?: string }} options */
function siyuanValidateClipPrereqs({ token, notebook }) {
    if (!token || !String(token).trim()) {
        return { ok: false, error: "tip_token_miss" };
    }
    if (!notebook) {
        return { ok: false, error: "tip_save_path_miss" };
    }
    return { ok: true };
}

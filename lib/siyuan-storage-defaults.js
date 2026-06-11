const SIYUAN_DEFAULT_KERNEL_IP = "http://127.0.0.1:6806";

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
    searchKey: "",
    notebook: "",
    parentDoc: "",
    parentHPath: "",
    tags: "",
    searchDatabaseKey: "",
    selectedDatabaseID: "",
    selectedDatabaseName: "",
    assets: true,
    dirsFirst: true,
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

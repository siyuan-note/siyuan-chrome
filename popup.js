function svgIcon(symbolId, className) {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#${symbolId}"></use></svg>`;
}

const SETTINGS_SVG = svgIcon("iconSettings", "popup__icon");

const escapeHtml = (unsafe) => {
    if (unsafe == null) return "";
    const s = String(unsafe);
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

function t(key) {
    return escapeHtml(siyuanGetMessage(key));
}

function switchRowHtml(key, id) {
    return `<div class="popup__row">
        <span class="popup__row-label u-text-body u-selectable">${t(key)}</span>
        <label class="popup__toggle-wrap">
            <input class="popup__toggle u-focus-ring" id="${id}" type="checkbox">
        </label>
    </div>`;
}

function fieldHtml(labelKey, inputHtml) {
    return `<div class="popup__field">
        <label class="popup__label u-text-body u-selectable">${t(labelKey)}</label>
        ${inputHtml}
    </div>`;
}

function searchListHtml({ searchId, listId, placeholder }) {
    return `<div class="popup__search-list">
        <input class="popup__search-list-input" id="${searchId}" type="text" placeholder="${placeholder}">
        <ul class="popup__search-list-options" id="${listId}" role="listbox"></ul>
    </div>`;
}

function dropdownHtml({ dropdownId, triggerId, panelId, searchId, listId, placeholder }) {
    return `<div class="popup__dropdown" id="${dropdownId}">
        <div class="popup__dropdown-trigger u-surface" id="${triggerId}" tabindex="0" role="button" aria-haspopup="listbox"></div>
        <div class="popup__dropdown-panel" id="${panelId}">
            ${searchListHtml({ searchId, listId, placeholder })}
        </div>
    </div>`;
}

function dropdownFieldHtml(labelKey, options) {
    return fieldHtml(labelKey, dropdownHtml(options));
}

function passwordFieldHtml(labelKey, { inputId, toggleId }) {
    return `<div class="popup__field">
        <label class="popup__label u-text-body u-selectable">${t(labelKey)}</label>
        <div class="popup__input-wrap">
            <input class="popup__input u-surface popup__input--icon-end" id="${inputId}" type="password">
            <button type="button" class="popup__icon-btn u-icon-btn u-focus-ring popup__input-action" id="${toggleId}" aria-label="Toggle token visibility">
                ${svgIcon("iconEye", "popup__icon")}
            </button>
        </div>
    </div>`;
}

function actionRowHtml(labelKey, buttonId, buttonContent) {
    return `<div class="popup__row">
        <span class="popup__row-label u-text-body u-selectable">${t(labelKey)}</span>
        <button type="button" class="popup__icon-btn u-icon-btn u-focus-ring" id="${buttonId}">${buttonContent}</button>
    </div>`;
}

const syncInputFlushes = [];

function flushSyncInputs() {
    syncInputFlushes.forEach((flush) => flush());
}

function debounce(fn, ms) {
    let timer;
    const debounced = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
}

function bindSyncInput(el, storageKey, { normalize, normalizeOnFlush, onSaved } = {}) {
    const saveDraft = () => {
        chrome.storage.sync.set({ [storageKey]: el.value });
    };
    const commit = (normalizeFn) => {
        let value = el.value;
        const fn = normalizeFn || normalize;
        if (fn) value = fn(value);
        if (el.value !== value) el.value = value;
        chrome.storage.sync.set({ [storageKey]: value });
        onSaved?.(value);
    };
    const debouncedSaveDraft = debounce(saveDraft, 300);
    el.addEventListener("input", debouncedSaveDraft);
    el.addEventListener("change", () => commit());
    syncInputFlushes.push(() => {
        debouncedSaveDraft.cancel();
        commit(normalizeOnFlush || normalize);
    });
}

function setSendBlock(message) {
    const alert = document.getElementById("popupAlert");
    const send = document.getElementById("send");
    if (!alert || !send) return;
    const blocked = !!message;
    alert.textContent = message || "";
    send.hidden = blocked;
    alert.hidden = !blocked;
}

function setSendBlockKey(key) {
    setSendBlock(key ? siyuanGetMessage(key) : "");
}

function syncSendBlockFromLocal() {
    const token = document.getElementById("token")?.value.trim();
    const notebook = document.getElementById("savePathDisplay")?.dataset.notebook;
    const result = siyuanValidateClipPrereqs({ token, notebook });
    if (!result.ok) {
        setSendBlockKey(result.error);
        return false;
    }
    return true;
}

function setSavePathDisplay(el, hPath) {
    const path = hPath || "";
    el.dataset.parentHPath = path;
    if (path) {
        el.textContent = path;
        el.classList.remove("popup__dropdown-trigger--placeholder");
    } else {
        el.textContent = siyuanGetMessage("save_path_placeholder");
        el.classList.add("popup__dropdown-trigger--placeholder");
    }
}

let savePathSearchGen = 0;
let databaseSearchGen = 0;

async function reloadPopup(langCode) {
    flushSyncInputs();
    const scrollTop = document.querySelector(".popup__scroll")?.scrollTop ?? 0;
    await siyuanLoadLanguageFile(langCode);
    await new Promise((resolve) => chrome.storage.sync.set({ langCode }, resolve));
    document.getElementById("mainContainer")?.remove();
    document.getElementById("templateModal")?.remove();
    const items = await chrome.storage.sync.get({
        ...SIYUAN_STORAGE_DEFAULTS,
        langCode,
        clipTemplate: SIYUAN_DEFAULT_CLIP_TEMPLATE,
    });
    renderPopup({ ...items, langCode });
    const scroll = document.querySelector(".popup__scroll");
    if (scroll) scroll.scrollTop = scrollTop;
    if (items.token?.trim()) void updateSearch({ quiet: true });
    void updateDatabaseSearch({ quiet: true });
}

function applyPopupLayout() {
    const langCode = siyuanGetLangCode();
    document.documentElement.dir = ["ar", "he"].includes(langCode) ? "rtl" : "ltr";
    document.documentElement.lang = langCode;
}

// 关闭所有下拉菜单
function closeAllDropdowns() {
    document.querySelectorAll(".popup__dropdown-panel--open").forEach((menu) => {
        menu.classList.remove("popup__dropdown-panel--open");
    });
}

function closeTemplateModal() {
    document.getElementById("templateModal")?.classList.remove("modal--open");
}

function renderPopup(items) {
    syncInputFlushes.length = 0;

    document.body.insertAdjacentHTML("beforeend", `<div id="mainContainer" class="popup"></div>`);
    const root = document.getElementById("mainContainer");

    root.insertAdjacentHTML(
        "beforeend",
        `
        <div class="popup__send-wrap">
            <button type="button" class="popup__send u-btn u-btn--header u-btn--lg" id="send">${t("send")}</button>
            <div id="popupAlert" class="popup__alert u-selectable" role="alert" hidden aria-live="polite"></div>
        </div>
    `,
    );
    const sendBtn = root.querySelector("#send");
    sendBtn.addEventListener("click", () => {
        if (sendBtn.disabled) return;
        sendBtn.disabled = true;
        flushSyncInputs();
        chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) {
                sendBtn.disabled = false;
                return;
            }
            chrome.tabs.sendMessage(tab.id, { func: "siyuanGetReadability", tabId: tab.id });
            setTimeout(() => {
                sendBtn.disabled = false;
            }, 600);
        });
    });

    root.insertAdjacentHTML("beforeend", `<div class="popup__scroll"></div>`);
    const scroll = root.querySelector(".popup__scroll");

    scroll.insertAdjacentHTML("beforeend", `<section class="popup__section popup__section--before-divide"></section>`);
    const savePathSection = scroll.lastElementChild;

    savePathSection.insertAdjacentHTML(
        "beforeend",
        `<h2 class="popup__section-title u-text-body u-selectable">${t("save_path")}</h2>`,
    );

    // 新增下拉菜单元素
    savePathSection.insertAdjacentHTML(
        "beforeend",
        `
        <div class="popup__field">
            ${dropdownHtml({
                dropdownId: "savePathDropdown",
                triggerId: "savePathDisplay",
                panelId: "savePathMenu",
                searchId: "savePathInput",
                listId: "savePathOptions",
                placeholder: t("save_path_placeholder"),
            })}
        </div>
    `,
    );
    const savePathDisplay = savePathSection.querySelector("#savePathDisplay");
    const savePathInput = savePathSection.querySelector("#savePathInput");
    const savePathOptions = savePathSection.querySelector("#savePathOptions");
    const savePathMenu = savePathSection.querySelector("#savePathMenu");
    setSavePathDisplay(savePathDisplay, items.parentHPath || "");
    savePathDisplay.dataset.notebook = items.notebook || "";
    savePathDisplay.dataset.parent = items.parentDoc || "";
    savePathInput.value = items.searchKey || "";
    // 保存路径下拉菜单事件
    const toggleSavePathMenu = () => {
        const isOpen = savePathMenu.classList.contains("popup__dropdown-panel--open");
        closeAllDropdowns();
        if (!isOpen) {
            savePathMenu.classList.add("popup__dropdown-panel--open");
            savePathInput.focus();
            void updateSearch();
        }
    };
    savePathDisplay.addEventListener("click", toggleSavePathMenu);
    savePathDisplay.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSavePathMenu();
        }
    });
    savePathInput.addEventListener("input", () => {
        chrome.storage.sync.set({ searchKey: savePathInput.value });
        void updateSearch();
    });
    savePathOptions.addEventListener("click", (e) => {
        const item = e.target.closest(".popup__search-list-item[data-notebook]");
        if (!item) return;
        setSavePathDisplay(savePathDisplay, item.textContent);
        savePathDisplay.dataset.notebook = item.getAttribute("data-notebook");
        savePathDisplay.dataset.parent = item.getAttribute("data-parent");
        chrome.storage.sync.set({
            notebook: item.getAttribute("data-notebook"),
            parentDoc: item.getAttribute("data-parent"),
            parentHPath: item.textContent,
        });
        if (syncSendBlockFromLocal()) void updateSearch({ quiet: true });
        savePathMenu.classList.remove("popup__dropdown-panel--open");
    });

    savePathSection.insertAdjacentHTML(
        "beforeend",
        dropdownFieldHtml("database_label", {
            dropdownId: "databaseDropdown",
            triggerId: "databaseDisplay",
            panelId: "databaseMenu",
            searchId: "databaseInput",
            listId: "databaseOptions",
            placeholder: t("database_search_placeholder"),
        }),
    );
    const databaseDisplay = savePathSection.querySelector("#databaseDisplay");
    const databaseInput = savePathSection.querySelector("#databaseInput");
    const databaseOptions = savePathSection.querySelector("#databaseOptions");
    const databaseMenu = savePathSection.querySelector("#databaseMenu");
    databaseDisplay.textContent = items.selectedDatabaseID
        ? items.selectedDatabaseName || ""
        : siyuanGetMessage("database_none");
    databaseDisplay.dataset.selectedId = items.selectedDatabaseID || "";
    databaseInput.value = items.searchDatabaseKey || "";
    // 数据库下拉菜单事件
    const toggleDatabaseMenu = () => {
        const isOpen = databaseMenu.classList.contains("popup__dropdown-panel--open");
        closeAllDropdowns();
        if (!isOpen) {
            databaseMenu.classList.add("popup__dropdown-panel--open");
            databaseInput.focus();
            void updateDatabaseSearch();
        }
    };
    databaseDisplay.addEventListener("click", toggleDatabaseMenu);
    databaseDisplay.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDatabaseMenu();
        }
    });
    databaseInput.addEventListener("input", () => {
        chrome.storage.sync.set({ searchDatabaseKey: databaseInput.value });
        void updateDatabaseSearch();
    });
    databaseOptions.addEventListener("click", (e) => {
        const item = e.target.closest(".popup__search-list-item[data-id]");
        if (!item) return;
        databaseDisplay.textContent = item.textContent;
        chrome.storage.sync.set({
            selectedDatabaseID: item.getAttribute("data-id"),
            selectedDatabaseName: item.textContent,
        });
        databaseMenu.classList.remove("popup__dropdown-panel--open");
    });

    savePathSection.insertAdjacentHTML(
        "beforeend",
        fieldHtml("tags", `<input class="popup__input u-surface" id="tags" placeholder="${t("tags_placeholder")}">`),
    );
    const tags = savePathSection.querySelector("#tags");
    tags.value = items.tags || "";
    bindSyncInput(tags, "tags", {
        normalize: (value) => value.replace(/#/g, ""),
    });

    savePathSection.insertAdjacentHTML("beforeend", switchRowHtml("assets", "assets"));
    const assets = savePathSection.querySelector("#assets");
    assets.checked = !!items.assets;
    assets.addEventListener("change", () => chrome.storage.sync.set({ assets: assets.checked }));

    const expOn = !!items.exp;

    savePathSection.insertAdjacentHTML("beforeend", switchRowHtml("exp", "exp"));
    const exp = savePathSection.querySelector("#exp");
    exp.checked = expOn;
    exp.addEventListener("change", () => {
        savePathSection.querySelector("#expGroup").classList.toggle("popup__group--hidden", !exp.checked);
        chrome.storage.sync.set({ exp: exp.checked });
    });

    savePathSection.insertAdjacentHTML(
        "beforeend",
        `<div id="expGroup" class="popup__group${expOn ? "" : " popup__group--hidden"}"></div>`,
    );
    const expGroup = savePathSection.querySelector("#expGroup");
    expGroup.insertAdjacentHTML(
        "beforeend",
        `<p class="popup__section-caption u-text-caption u-selectable">${t("exp_tips")}</p>`,
    );
    for (const [labelKey, id] of [
        ["exp_span", "expSpan"],
        ["exp_bold", "expBold"],
        ["exp_italic", "expItalic"],
        ["exp_underline", "expUnderline"],
        ["exp_remove_img_link", "expRemoveImgLink"],
        ["exp_list_doc_tree", "expListDocTree"],
        ["exp_open_after_clip", "expOpenAfterClip"],
        ["exp_svg_to_img", "expSvgToImg"],
    ]) {
        expGroup.insertAdjacentHTML("beforeend", switchRowHtml(labelKey, id));
        const input = expGroup.querySelector("#" + id);
        input.checked = !!items[id];
        input.addEventListener("change", () => chrome.storage.sync.set({ [id]: input.checked }));
    }

    savePathSection.insertAdjacentHTML("beforeend", actionRowHtml("template_config", "templateConfig", SETTINGS_SVG));
    // 添加模板配置按钮点击事件
    savePathSection.querySelector("#templateConfig").addEventListener("click", () => {
        // 打开模板配置弹窗
        chrome.storage.sync.get({ clipTemplate: SIYUAN_DEFAULT_CLIP_TEMPLATE }, (stored) => {
            // 打开时预填充当前模板（无则回退默认）
            document.getElementById("templateText").value = stored.clipTemplate || SIYUAN_DEFAULT_CLIP_TEMPLATE;
        });
        document.getElementById("templateModal").classList.add("modal--open");
    });

    scroll.insertAdjacentHTML(
        "beforeend",
        `<section class="popup__section popup__section--divided popup__section--before-divide"></section>`,
    );
    const connSection = scroll.lastElementChild;

    connSection.insertAdjacentHTML(
        "beforeend",
        fieldHtml(
            "siyuan_url",
            `<input class="popup__input u-surface" id="ip" placeholder="${escapeHtml(SIYUAN_DEFAULT_KERNEL_IP)}">`,
        ),
    );
    const ip = connSection.querySelector("#ip");
    ip.value = items.ip?.trim() ? siyuanNormalizeBaseInput(items.ip) : "";
    bindSyncInput(ip, "ip", {
        normalize: siyuanNormalizeBaseInput,
        normalizeOnFlush: siyuanNormalizeBase,
        onSaved: () => {
            if (syncSendBlockFromLocal()) void updateSearch({ quiet: true });
        },
    });

    connSection.insertAdjacentHTML(
        "beforeend",
        passwordFieldHtml("api_token", { inputId: "token", toggleId: "tokenToggle" }),
    );
    const token = connSection.querySelector("#token");
    const tokenToggle = connSection.querySelector("#tokenToggle");
    token.value = items.token || "";
    bindSyncInput(token, "token", {
        onSaved: () => {
            if (syncSendBlockFromLocal()) void updateSearch({ quiet: true });
        },
    });
    tokenToggle.addEventListener("click", () => {
        if (token.type === "password") {
            token.type = "text";
            tokenToggle.innerHTML = svgIcon("iconEyeoff", "popup__icon");
        } else {
            token.type = "password";
            tokenToggle.innerHTML = svgIcon("iconEye", "popup__icon");
        }
    });

    scroll.insertAdjacentHTML("beforeend", `<section class="popup__section popup__section--divided"></section>`);
    const settingsSection = scroll.lastElementChild;

    settingsSection.insertAdjacentHTML("beforeend", switchRowHtml("dirsFirst", "dirsFirst"));
    const dirsFirst = settingsSection.querySelector("#dirsFirst");
    dirsFirst.checked = !!items.dirsFirst;
    dirsFirst.addEventListener("change", () => {
        chrome.storage.sync.set({ dirsFirst: dirsFirst.checked });
        if (savePathMenu.classList.contains("popup__dropdown-panel--open")) void updateSearch();
    });

    settingsSection.insertAdjacentHTML("beforeend", switchRowHtml("show_tip", "showTip"));
    const showTip = settingsSection.querySelector("#showTip");
    showTip.checked = !!items.showTip;
    showTip.addEventListener("change", () => chrome.storage.sync.set({ showTip: showTip.checked }));

    settingsSection.insertAdjacentHTML(
        "beforeend",
        `
        <div class="popup__row">
            <span class="popup__row-label u-text-body u-selectable">${t("language")}</span>
            <select class="popup__select u-surface" id="language"></select>
        </div>
    `,
    );
    const language = settingsSection.querySelector("#language");
    SIYUAN_LANG_OPTIONS.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        if (value === items.langCode) option.selected = true;
        language.appendChild(option);
    });
    language.addEventListener("change", () => {
        void reloadPopup(language.value);
    });

    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="templateModal"></div>`);
    const templateModal = document.getElementById("templateModal");

    // 添加模板变量帮助提示
    templateModal.insertAdjacentHTML(
        "beforeend",
        `
        <div class="modal__panel">
            <button type="button" class="modal__close u-icon-btn u-focus-ring" id="closeTemplate" aria-label="Close">×</button>
            <h2 class="modal__title u-text-heading u-selectable">${t("template_config")}</h2>
            <div class="modal__body">
                <textarea class="modal__textarea u-surface" id="templateText"></textarea>
                <p class="modal__help u-text-caption u-selectable" id="templateHelp">${siyuanLangData?.template_help?.message || ""}</p>
            </div>
            <div class="modal__actions">
                <button type="button" class="popup__btn u-btn u-btn--secondary" id="restoreTemplate">${t("template_restore_default")}</button>
                <button type="button" class="popup__btn u-btn u-btn--secondary" id="cancelTemplate">${t("template_cancel")}</button>
                <button type="button" class="popup__btn u-btn u-btn--primary" id="saveTemplate">${t("template_save")}</button>
            </div>
        </div>
    `,
    );
    const templateText = templateModal.querySelector("#templateText");
    templateText.value = items.clipTemplate || "";
    // 添加模板保存按钮事件
    templateModal.querySelector("#saveTemplate").addEventListener("click", () => {
        chrome.storage.sync.set({ clipTemplate: templateText.value }, closeTemplateModal);
    });
    // 添加模板恢复默认按钮事件
    templateModal.querySelector("#restoreTemplate").addEventListener("click", () => {
        templateText.value = SIYUAN_DEFAULT_CLIP_TEMPLATE;
        chrome.storage.sync.set({ clipTemplate: SIYUAN_DEFAULT_CLIP_TEMPLATE });
    });
    // 添加模板取消按钮事件
    templateModal.querySelector("#cancelTemplate").addEventListener("click", closeTemplateModal);
    // 添加关闭模板配置弹窗按钮事件
    templateModal.querySelector("#closeTemplate").addEventListener("click", closeTemplateModal);
    templateModal.addEventListener("click", (e) => {
        if (e.target === templateModal) closeTemplateModal();
    });

    applyPopupLayout();
    syncSendBlockFromLocal();
}

async function bootstrapPopup() {
    try {
        const items = await chrome.storage.sync.get({
            ...SIYUAN_STORAGE_DEFAULTS,
            langCode: siyuanGetDefaultLangCode(),
            clipTemplate: SIYUAN_DEFAULT_CLIP_TEMPLATE,
        });
        await siyuanLoadLanguageFile(items.langCode);
        renderPopup(items);
        // 点击其他地方关闭下拉菜单
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".popup__dropdown")) closeAllDropdowns();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeAllDropdowns();
                closeTemplateModal();
            }
        });
        if (items.token?.trim()) void updateSearch({ quiet: true });
        void updateDatabaseSearch({ quiet: true });
    } catch (e) {
        console.error(e);
    } finally {
        document.body.classList.add("popup-ready");
    }
}

void bootstrapPopup();

const querySql = async (sql) => {
    const ipElement = document.getElementById("ip");
    const tokenElement = document.getElementById("token");
    const result = await siyuanKernelFetch({
        ip: ipElement.value,
        token: tokenElement.value,
        path: "/api/query/sql",
        body: { stmt: sql || "" },
    });
    if (!result.ok) {
        setSendBlockKey(result.error);
        return [];
    }
    if (syncSendBlockFromLocal()) setSendBlock("");
    if (!result.data || result.data.code !== 0 || !Array.isArray(result.data.data)) {
        return [];
    }
    return result.data.data;
};

const getSubDocNumByPaths = async (paths) => {
    const normalizedPaths = paths.map((p) => (p.startsWith("/") ? p : "/" + p));
    // 路径来自内核搜索结果，拼接 SQL 时需转义单引号
    const caseFields = normalizedPaths
        .map((p) => `SUM(CASE WHEN path LIKE '${p.replace(/'/g, "''")}%' THEN 1 ELSE 0 END) AS '${p}.sy'`)
        .join(", ");
    const likeConditions = normalizedPaths.map((p) => `path LIKE '${p.replace(/'/g, "''")}%'`).join(" OR ");
    const excludeConditions = normalizedPaths.map((p) => `path <> '${p.replace(/'/g, "''")}.sy'`).join(" AND ");
    // 拼成单行 SQL，避免模板字符串换行问题
    const sql =
        "SELECT " +
        caseFields +
        ", box FROM blocks WHERE type = 'd' AND (" +
        excludeConditions +
        ") AND (" +
        likeConditions +
        ") GROUP BY box;";
    const res = await querySql(sql);
    const result = {};
    for (const row of res) {
        const { box, ...counts } = row;
        result[box] = counts;
    }
    return result;
};

/** 统一搜索结果 path 键格式（前导 `/` + `.sy` 后缀），与 SQL 别名对齐 */
function normalizeSearchResultPath(path) {
    let p = String(path || "").trim();
    if (!p) return "";
    if (!p.endsWith(".sy")) p += ".sy";
    if (!p.startsWith("/")) p = "/" + p;
    return p;
}

// 算法 复杂度O(n)
// 1 获取sql查询所有path和子文档的映射，格式化成 {"<box>": {"<path>": <num>}} 格式
// 2 将api结果中的path和映射对比，如果path子文档数>0则是目录，前置
const sortSearchResults = async (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return data;
    // 未开启目录优先则返回原始数据
    const dirsFirstElement = document.getElementById("dirsFirst");
    if (!dirsFirstElement.checked) return data;
    // 获取所有文档path
    const paths = data.map((item) => item.path.replace(".sy", ""));
    // 获取path子文档数映射
    const pathMap = await getSubDocNumByPaths(paths);
    // 前置所有匹配到的目录
    const front = []; // 存放前置目录
    const rest = []; // 其他保留原序
    for (const item of data) {
        const pathKey = normalizeSearchResultPath(item.path);
        if ((pathMap[item?.box]?.[pathKey] || 0) > 0) front.push(item);
        else rest.push(item);
    }
    // 合并：前置项 + 剩余项，均保持原始顺序
    return front.concat(rest);
};

const updateSearch = async ({ quiet = false } = {}) => {
    const ipElement = document.getElementById("ip");
    const tokenElement = document.getElementById("token");
    const savePathInput = document.getElementById("savePathInput");
    const savePathOptions = document.getElementById("savePathOptions");
    const savePathDisplay = document.getElementById("savePathDisplay");
    if (!ipElement || !tokenElement || !savePathOptions) return;

    const gen = ++savePathSearchGen;
    const token = tokenElement.value.trim();
    if (!token) {
        savePathOptions.innerHTML = "";
        syncSendBlockFromLocal();
        return;
    }

    const result = await siyuanKernelFetch({
        ip: ipElement.value,
        token: tokenElement.value,
        path: "/api/filetree/searchDocs",
        body: { k: savePathInput.value || "", flashcard: false },
    });
    if (gen !== savePathSearchGen) return;

    if (!result.ok) {
        savePathOptions.innerHTML = "";
        setSendBlockKey(result.error);
        return;
    }
    if (syncSendBlockFromLocal()) setSendBlock("");
    if (!result.data || result.data.code !== 0 || !Array.isArray(result.data.data)) {
        savePathOptions.innerHTML = "";
        return;
    }

    let optionsHTML = "";
    let selectedHPath = "";
    const searchList = await sortSearchResults(result.data.data);
    if (gen !== savePathSearchGen) return;

    searchList.forEach((doc) => {
        const parentDoc = String(doc.path)
            .substring(String(doc.path).lastIndexOf("/") + 1)
            .replace(".sy", "");
        if (
            savePathDisplay.dataset.notebook === doc.box &&
            savePathDisplay.dataset.parent === parentDoc &&
            savePathDisplay.dataset.parentHPath === doc.hPath
        ) {
            selectedHPath = doc.hPath;
        }
        optionsHTML += `<li class="popup__search-list-item" data-notebook="${doc.box}" data-parent="${parentDoc}">${escapeHtml(doc.hPath)}</li>`;
    });
    savePathOptions.innerHTML =
        optionsHTML || `<li class="popup__search-list-item popup__search-list-item--hint">${t("save_path_none")}</li>`;
    // 如果有选中的，更新显示
    if (selectedHPath) setSavePathDisplay(savePathDisplay, selectedHPath);
};

const updateDatabaseSearch = async ({ quiet = false } = {}) => {
    const ipElement = document.getElementById("ip");
    const tokenElement = document.getElementById("token");
    const databaseInput = document.getElementById("databaseInput");
    const databaseOptions = document.getElementById("databaseOptions");
    const databaseDisplay = document.getElementById("databaseDisplay");
    if (!ipElement || !tokenElement || !databaseOptions) return;

    const gen = ++databaseSearchGen;
    const token = tokenElement.value.trim();
    if (!token) {
        databaseOptions.innerHTML = "";
        return;
    }

    const result = await siyuanKernelFetch({
        ip: ipElement.value,
        token: tokenElement.value,
        path: "/api/av/searchAttributeView",
        body: { avID: "", keyword: databaseInput.value }, // Search in all AVs
    });
    if (gen !== databaseSearchGen) return;

    if (!result.ok) {
        databaseOptions.innerHTML = "";
        if (!quiet && (result.error === "tip_token_invalid" || result.error === "tip_siyuan_kernel_unavailable")) {
            setSendBlockKey(result.error);
        }
        return;
    }

    const response = result.data;
    if (!response || response.code !== 0) {
        databaseOptions.innerHTML = "";
        return;
    }

    let optionsHTML = "";
    if (!databaseInput.value.trim()) {
        optionsHTML = `<li class="popup__search-list-item" data-id="">${escapeHtml(siyuanGetMessage("database_none"))}</li>`;
    }
    let selectedName = "";
    if (response.data && response.data.results) {
        response.data.results.forEach((db) => {
            if (!db.avName) return;
            if (databaseDisplay.dataset.selectedId === db.avID) {
                selectedName = db.avName;
            }
            optionsHTML += `<li class="popup__search-list-item" data-id="${db.avID}">${escapeHtml(db.avName)}</li>`;
        });
    }
    databaseOptions.innerHTML =
        optionsHTML || `<li class="popup__search-list-item popup__search-list-item--hint">${t("save_path_none")}</li>`;
    // 如果有选中的，更新显示
    if (selectedName) databaseDisplay.textContent = selectedName;
};

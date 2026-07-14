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

async function flushSyncInputs() {
    await Promise.all(syncInputFlushes.map((flush) => flush()));
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
        const saved = chrome.storage.sync.set({ [storageKey]: value });
        onSaved?.(value);
        return saved;
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
    const notebook = document.getElementById("notebook")?.value;
    const result = siyuanValidateClipPrereqs({ token, notebook });
    if (!result.ok) {
        setSendBlockKey(result.error);
        return false;
    }
    return true;
}

let notebookListGen = 0;
let savePathPreviewGen = 0;
let databaseSearchGen = 0;

async function reloadPopup(langCode) {
    await flushSyncInputs();
    const scrollTop = document.querySelector(".popup__scroll")?.scrollTop ?? 0;
    await siyuanLoadLanguageFile(langCode);
    await new Promise((resolve) => chrome.storage.sync.set({ langCode }, resolve));
    document.getElementById("mainContainer")?.remove();
    document.getElementById("templateModal")?.remove();
    const items = await siyuanLoadStorageSettings();
    items.clipTemplate ||= SIYUAN_DEFAULT_CLIP_TEMPLATE;
    renderPopup({ ...items, langCode });
    const scroll = document.querySelector(".popup__scroll");
    if (scroll) scroll.scrollTop = scrollTop;
    if (items.token?.trim()) void updateNotebookList({ quiet: true });
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
    sendBtn.addEventListener("click", async () => {
        if (sendBtn.disabled) return;
        sendBtn.disabled = true;
        await flushSyncInputs();
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

    savePathSection.insertAdjacentHTML(
        "beforeend",
        fieldHtml("notebook_label", `<select class="popup__select u-surface" id="notebook">
            <option value="">${t("notebook_placeholder")}</option>
        </select>`),
    );
    const notebook = savePathSection.querySelector("#notebook");
    notebook.dataset.selectedId = items.notebook || "";
    notebook.addEventListener("change", () => {
        notebook.dataset.selectedId = notebook.value;
        chrome.storage.sync.set({ notebook: notebook.value });
        syncSendBlockFromLocal();
        void updateSavePathPreview();
    });

    savePathSection.insertAdjacentHTML(
        "beforeend",
        fieldHtml("save_path_template", `<input class="popup__input popup__input--template u-surface" id="savePathTemplate"
            placeholder="/">`) +
        `<p class="popup__field-help u-text-caption u-selectable">${t("save_path_template_help")}</p>
        <div class="popup__path-preview" id="savePathPreview" hidden>
            <span class="popup__path-preview-label u-text-caption u-selectable">${t("save_path_preview")}</span>
            <span class="popup__path-preview-value u-text-caption u-selectable" id="savePathPreviewValue"></span>
        </div>`,
    );
    const savePathTemplate = savePathSection.querySelector("#savePathTemplate");
    savePathTemplate.value = items.savePathTemplate || SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE;
    const schedulePreview = debounce(() => void updateSavePathPreview(), 300);
    bindSyncInput(savePathTemplate, "savePathTemplate", {
        normalize: (value) => value.trim() || SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE,
        onSaved: () => void updateSavePathPreview(),
    });
    savePathTemplate.addEventListener("input", schedulePreview);

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
            if (syncSendBlockFromLocal()) void updateNotebookList({ quiet: true });
            void updateSavePathPreview();
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
            if (syncSendBlockFromLocal()) void updateNotebookList({ quiet: true });
            void updateSavePathPreview();
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
        const items = await siyuanLoadStorageSettings();
        items.langCode ||= siyuanGetDefaultLangCode();
        items.clipTemplate ||= SIYUAN_DEFAULT_CLIP_TEMPLATE;
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
        if (items.token?.trim()) void updateNotebookList({ quiet: true });
        void updateDatabaseSearch({ quiet: true });
    } catch (e) {
        console.error(e);
    } finally {
        document.body.classList.add("popup-ready");
    }
}

void bootstrapPopup();

const updateNotebookList = async ({ quiet = false } = {}) => {
    const ipElement = document.getElementById("ip");
    const tokenElement = document.getElementById("token");
    const notebookElement = document.getElementById("notebook");
    if (!ipElement || !tokenElement || !notebookElement) return;

    const gen = ++notebookListGen;
    const token = tokenElement.value.trim();
    if (!token) {
        notebookElement.replaceChildren(new Option(siyuanGetMessage("notebook_placeholder"), ""));
        syncSendBlockFromLocal();
        return;
    }

    const result = await siyuanKernelFetch({
        ip: ipElement.value,
        token: tokenElement.value,
        path: "/api/notebook/lsNotebooks",
        body: {},
    });
    if (gen !== notebookListGen) return;

    if (!result.ok) {
        notebookElement.replaceChildren(new Option(siyuanGetMessage("notebook_placeholder"), ""));
        if (!quiet) setSendBlockKey(result.error);
        return;
    }
    const notebooks = result.data?.data?.notebooks;
    if (result.data?.code !== 0 || !Array.isArray(notebooks)) {
        return;
    }

    const selectedId = notebookElement.dataset.selectedId || notebookElement.value;
    notebookElement.replaceChildren(new Option(siyuanGetMessage("notebook_placeholder"), ""));
    notebooks.filter((item) => !item.closed).forEach((item) => {
        notebookElement.add(new Option(item.name, item.id));
    });
    notebookElement.value = Array.from(notebookElement.options).some((option) => option.value === selectedId)
        ? selectedId
        : "";
    if (syncSendBlockFromLocal()) setSendBlock("");
    void updateSavePathPreview();
};

function normalizePreviewPath(parentPath) {
    let path = String(parentPath || "").trim().replaceAll("\\", "/");
    path = path.replace(/\/{2,}/g, "/");
    if (!path.startsWith("/")) path = "/" + path;
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return (path === "/" ? "" : path) + "/" + siyuanGetMessage("save_path_preview_title");
}

const updateSavePathPreview = async () => {
    const ipElement = document.getElementById("ip");
    const tokenElement = document.getElementById("token");
    const notebookElement = document.getElementById("notebook");
    const templateElement = document.getElementById("savePathTemplate");
    const previewElement = document.getElementById("savePathPreview");
    const previewValueElement = document.getElementById("savePathPreviewValue");
    if (!ipElement || !tokenElement || !notebookElement || !templateElement || !previewElement || !previewValueElement) return;

    const gen = ++savePathPreviewGen;
    if (!tokenElement.value.trim() || !notebookElement.value) {
        previewElement.hidden = true;
        return;
    }
    const result = await siyuanKernelFetch({
        ip: ipElement.value,
        token: tokenElement.value,
        path: "/api/template/renderSprig",
        body: { template: templateElement.value.trim() || SIYUAN_DEFAULT_SAVE_PATH_TEMPLATE },
    });
    if (gen !== savePathPreviewGen) return;
    previewElement.hidden = false;
    if (!result.ok) {
        previewElement.classList.add("popup__path-preview--error");
        previewValueElement.textContent = siyuanGetMessage(result.error);
        return;
    }
    if (result.data?.code !== 0) {
        previewElement.classList.add("popup__path-preview--error");
        previewValueElement.textContent = result.data?.msg || siyuanGetMessage("tip_siyuan_kernel_unavailable");
        return;
    }
    previewElement.classList.remove("popup__path-preview--error");
    const notebookName = notebookElement.selectedOptions[0]?.textContent || "";
    previewValueElement.textContent = notebookName + " " + normalizePreviewPath(result.data.data);
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

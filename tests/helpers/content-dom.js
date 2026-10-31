const {readFileSync} = require("node:fs");
const path = require("node:path");
const {JSDOM} = require("jsdom");

const root = path.join(__dirname, "../..");

function createContentDOM(t, html, {url = "https://example.com/article", expSpan = true, expSvgToImg = false} = {}) {
    const dom = new JSDOM(html, {url, runScripts: "outside-only", pretendToBeVisual: true});
    t.after(() => dom.window.close());
    const {window} = dom;
    const messages = [];
    window.console = {log() {}, warn() {}, error: console.error};
    window.siyuanInitLanguageFromStorage = () => Promise.resolve();
    window.siyuanGetMessage = key => key;
    window.siyuanLoadStorageSettings = async () => ({assets: false});
    window.siyuanGetActiveSavePathSettings = () => ({});
    window.siyuanStorageDefaultsFor = () => ({expSpan, expSvgToImg});
    window.SIYUAN_EXP_STORAGE_KEYS = [];
    window.siyuanNormalizePictureImages = () => {};
    window.chrome = {
        i18n: {getMessage: key => key},
        storage: {
            onChanged: {addListener() {}},
            sync: {get: (defaults, callback) => callback(defaults)},
        },
        runtime: {
            onMessage: {addListener() {}, removeListener() {}},
            getURL: file => `https://extension.example/${file}`,
            sendMessage: async message => {
                messages.push(message);
                return {ok: true};
            },
        },
    };
    const appendChild = window.document.head.appendChild.bind(window.document.head);
    window.document.head.appendChild = node => {
        const result = appendChild(node);
        if (node.tagName === "SCRIPT") queueMicrotask(() => node.onload?.());
        return result;
    };
    window.eval(readFileSync(path.join(root, "lib/Readability.js"), "utf8"));
    window.eval(readFileSync(process.env.SIYUAN_CONTENT_SOURCE || path.join(root, "content.js"), "utf8") +
        "\nwindow.clipArticle = siyuanGetReadability; window.clipSelection = eventDispatcher;");
    return {window, document: window.document, messages};
}

module.exports = {createContentDOM};

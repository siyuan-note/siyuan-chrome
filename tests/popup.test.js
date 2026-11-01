const assert = require("node:assert/strict");
const {createHash, webcrypto} = require("node:crypto");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");
const {JSDOM} = require("jsdom");

const root = path.join(__dirname, "..");
const cachedNotebooks = [{id: "b", name: "Beta"}, {id: "a", name: "Alpha & <Root>"}];

async function settle() {
    await new Promise(resolve => setImmediate(resolve));
}

async function createPopup(t, {notebooks = cachedNotebooks, cacheIdentity, token = "test-token"} = {}) {
    const dom = new JSDOM(readFileSync(path.join(root, "options.html"), "utf8"), {
        url: "https://extension.example/options.html",
        runScripts: "outside-only",
    });
    t.after(() => dom.window.close());
    const {window} = dom;
    const ip = "http://127.0.0.1:6806";
    const stored = {ip, token, langCode: "en", savePathMode: "search"};
    const local = {notebookListCache: {
        identity: cacheIdentity ?? createHash("sha256").update(`${ip}\n${token}`).digest("hex"),
        notebooks,
    }};
    const calls = [];
    const errors = [];
    let resolveCacheSaved;
    const cacheSaved = new Promise(resolve => { resolveCacheSaved = resolve; });
    window.console.error = error => errors.push(error);
    window.TextEncoder = TextEncoder;
    Object.defineProperty(window, "crypto", {value: webcrypto});
    window.chrome = {
        storage: {
            sync: {
                async get() { return {...stored}; },
                async set(values, callback) { Object.assign(stored, values); callback?.(); },
            },
            local: {
                async get() { return local; },
                async set(values) { Object.assign(local, values); resolveCacheSaved(); },
            },
        },
        i18n: {getMessage: key => key, getUILanguage: () => "en"},
        runtime: {getURL: value => `https://extension.example/${value}`},
    };
    window.fetch = (url, options) => {
        if (url.includes("/_locales/")) {
            return Promise.resolve({ok: true, json: async () => JSON.parse(readFileSync(path.join(root, "_locales/en/messages.json"), "utf8"))});
        }
        return new Promise(resolve => calls.push({
            url, body: JSON.parse(options.body), authorization: options.headers.Authorization,
            respond(data, status = 200) { resolve({status, json: async () => data}); },
        }));
    };
    for (const file of ["lib/siyuan-storage-defaults.js", "lib/siyuan-api.js", "lib/siyuan-i18n.js", "popup.js"]) {
        const sourcePath = file === "popup.js" && process.env.SIYUAN_POPUP_SOURCE || path.join(root, file);
        vm.runInContext(readFileSync(sourcePath, "utf8"), dom.getInternalVMContext(), {filename: file});
    }
    for (let i = 0; i < 100 && !window.document.body.classList.contains("popup-ready"); i++) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.deepEqual(errors, []);
    assert.ok(window.document.body.classList.contains("popup-ready"), "popup finishes bootstrapping");
    const element = id => window.document.getElementById(id);
    return {
        window, stored, local, cacheSaved, calls, element,
        toggle() { element("searchPathDisplay").click(); },
        search(value) {
            element("searchPathInput").value = value;
            element("searchPathInput").dispatchEvent(new window.Event("input"));
        },
        change(id, value) {
            element(id).value = value;
            element(id).dispatchEvent(new window.Event("change"));
        },
        ids() { return Array.from(element("searchPathOptions").querySelectorAll("[data-notebook]"), item => item.dataset.notebook); },
        requests(endpoint) { return calls.filter(call => new URL(call.url).pathname === endpoint); },
    };
}

function notebookResponse(notebooks) {
    return {code: 0, data: {notebooks}};
}

function doc(id, hPath) {
    return {box: id, hPath, path: `/20261101000000-${id}.sy`};
}

test("empty and whitespace queries immediately show cached notebook order without searching", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    assert.deepEqual(popup.ids(), ["b", "a"]);
    assert.equal(popup.element("searchPathOptions").lastElementChild.textContent, "Alpha & <Root>/");
    assert.equal(popup.element("searchPathOptions").querySelector("root"), null);
    popup.search("   ");
    assert.deepEqual(popup.ids(), ["b", "a"]);
    assert.equal(popup.requests("/api/filetree/searchDocs").length, 0);
});

test("background notebook updates preserve open rows and apply their order on reopening", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    const firstRow = popup.element("searchPathOptions").firstElementChild;
    popup.element("searchPathOptions").scrollTop = 20;
    popup.requests("/api/notebook/lsNotebooks")[0].respond(notebookResponse([
        {id: "a", name: "Renamed"}, {id: "c", name: "New"}, {id: "b", name: "Beta", closed: true},
    ]));
    await settle();
    assert.deepEqual(popup.ids(), ["b", "a"]);
    assert.equal(popup.element("searchPathOptions").firstElementChild, firstRow);
    assert.equal(popup.element("searchPathOptions").scrollTop, 20);
    assert.deepEqual(Array.from(popup.element("templateNotebook").options, option => option.value), ["", "a", "c"]);
    popup.toggle();
    popup.toggle();
    assert.deepEqual(popup.ids(), ["a", "c"]);
    assert.equal(popup.element("searchPathOptions").firstElementChild.textContent, "Renamed/");
    await popup.cacheSaved;
    assert.deepEqual(Array.from(popup.local.notebookListCache.notebooks, item => item.id), ["a", "c"]);
});

test("a cold popup populates the open list when notebooks arrive and can select a root", async t => {
    const popup = await createPopup(t, {notebooks: []});
    popup.toggle();
    assert.deepEqual(popup.ids(), []);
    popup.requests("/api/notebook/lsNotebooks")[0].respond(notebookResponse([
        ...cachedNotebooks, {id: "closed", name: "Closed", closed: true},
    ]));
    await settle();
    assert.deepEqual(popup.ids(), ["b", "a"]);
    popup.element("searchPathOptions").firstElementChild.click();
    assert.equal(popup.stored.searchNotebook, "b");
    assert.equal(popup.stored.searchPath, "/");
    assert.equal(popup.stored.searchParentDoc, "");
    assert.equal(popup.stored.searchPathLabel, "Beta/");
    assert.ok(!popup.element("searchPathMenu").classList.contains("popup__dropdown-panel--open"));
    assert.equal(popup.requests("/api/filetree/searchDocs").length, 0);
});

test("closed lists adopt empty notebook results and remove stale rows", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    popup.toggle();
    popup.requests("/api/notebook/lsNotebooks")[0].respond(notebookResponse([]));
    await settle();
    popup.toggle();
    assert.deepEqual(popup.ids(), []);
    assert.ok(popup.element("searchPathOptions").querySelector(".popup__search-list-item--hint"));
});

test("keyword results keep server order and document selection through notebook refreshes", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    popup.search("topic");
    const request = popup.requests("/api/filetree/searchDocs")[0];
    assert.deepEqual(request.body, {k: "topic", flashcard: false});
    request.respond({code: 0, data: [doc("b", "Beta/Topic"), doc("a", "Alpha/Topic")]});
    await settle();
    const firstRow = popup.element("searchPathOptions").firstElementChild;
    popup.requests("/api/notebook/lsNotebooks")[0].respond(notebookResponse([...cachedNotebooks].reverse()));
    await settle();
    assert.deepEqual(popup.ids(), ["b", "a"]);
    assert.equal(popup.element("searchPathOptions").firstElementChild, firstRow);
    firstRow.click();
    assert.equal(popup.stored.searchNotebook, "b");
    assert.equal(popup.stored.searchPath, "/Topic");
    assert.equal(popup.stored.searchParentDoc, "20261101000000-b");
});

for (const response of [{code: 0, data: [doc("old", "Old/Result")]}, {code: -1, data: null}]) {
    test(`clearing a keyword ignores its late response with code ${response.code}`, async t => {
        const popup = await createPopup(t);
        popup.toggle();
        popup.search("old");
        popup.search("");
        assert.deepEqual(popup.ids(), ["b", "a"]);
        popup.requests("/api/filetree/searchDocs")[0].respond(response);
        await settle();
        assert.deepEqual(popup.ids(), ["b", "a"]);
        assert.equal(popup.requests("/api/filetree/searchDocs").length, 1);
    });
}

test("a newer keyword wins when search responses arrive out of order", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    popup.search("old");
    popup.search("new");
    const [oldRequest, newRequest] = popup.requests("/api/filetree/searchDocs");
    newRequest.respond({code: 0, data: [doc("new", "New/Result")]});
    await settle();
    oldRequest.respond({code: 0, data: [doc("old", "Old/Result")]});
    await settle();
    assert.deepEqual(popup.ids(), ["new"]);
    popup.search("");
    assert.deepEqual(popup.ids(), ["b", "a"]);
});

for (const id of ["ip", "token"]) {
    test(`changing ${id} clears cached rows and invalidates old notebook and search requests`, async t => {
        const popup = await createPopup(t);
        popup.toggle();
        popup.search("topic");
        popup.requests("/api/filetree/searchDocs")[0].respond({code: 0, data: [doc("b", "Beta/Topic")]});
        await settle();
        popup.search("pending");
        popup.change(id, id === "ip" ? "http://other.example:6806" : "other-token");
        const [, oldSearch, newSearch] = popup.requests("/api/filetree/searchDocs");
        assert.ok(newSearch);
        assert.deepEqual(popup.ids(), []);
        oldSearch.respond({code: 0, data: [doc("old", "Old/Topic")]});
        const [oldNotebooks, newNotebooks] = popup.requests("/api/notebook/lsNotebooks");
        oldNotebooks.respond(notebookResponse(cachedNotebooks));
        await settle();
        assert.deepEqual(popup.ids(), []);
        newSearch.respond({code: 0, data: [doc("new", "New/Topic")]});
        await settle();
        assert.deepEqual(popup.ids(), ["new"]);
        newNotebooks.respond(notebookResponse([{id: "new", name: "New"}]));
        await settle();
        assert.deepEqual(popup.ids(), ["new"]);
        popup.search("");
        assert.deepEqual(popup.ids(), ["new"]);
        assert.equal(popup.element("searchPathOptions").firstElementChild.textContent, "New/");
        assert.equal(newNotebooks.authorization, id === "token" ? "Token other-token" : "Token test-token");
        assert.equal(new URL(newNotebooks.url).hostname, id === "ip" ? "other.example" : "127.0.0.1");
    });
}

test("a cache from a different connection is ignored", async t => {
    const popup = await createPopup(t, {cacheIdentity: "other-connection"});
    popup.toggle();
    assert.deepEqual(popup.ids(), []);
    assert.equal(popup.requests("/api/filetree/searchDocs").length, 0);
});

test("removing the token clears root candidates without sending new requests", async t => {
    const popup = await createPopup(t);
    popup.toggle();
    popup.change("token", "");
    popup.requests("/api/notebook/lsNotebooks")[0].respond(notebookResponse(cachedNotebooks));
    await settle();
    assert.deepEqual(popup.ids(), []);
    assert.equal(popup.calls.length, 1);
    assert.equal(popup.element("searchPathOptions").children.length, 0);
});

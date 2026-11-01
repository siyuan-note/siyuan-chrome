const assert = require("node:assert/strict");
const {readFileSync, readdirSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");
const {webcrypto} = require("node:crypto");

const root = path.join(__dirname, "..");
const source = readFileSync(path.join(root, "background.js"), "utf8");
const docID = "20261027000000-clipdoc";

const notebook = "20261101000000-notebok";
const parentDoc = "20261101000000-parenta";
const structuredCapabilities = {structuredPaths: true, titleFormats: ["plain", "inline-ast"], indexState: "ready"};

async function clip(failedStage, template = false, options = {}) {
    const messages = [], calls = [], opened = [], requests = [];
    const context = vm.createContext({
        console: {warn() {}},
        crypto: webcrypto,
        chrome: {
            runtime: {onInstalled: {addListener() {}}, onMessage: {addListener() {}}},
            contextMenus: {onClicked: {addListener() {}}},
            commands: {onCommand: {addListener() {}}},
            storage: {sync: {get(defaults, callback) { callback({...defaults, clipTemplate: "${content}", expOpenAfterClip: true}); }}},
            tabs: {sendMessage(_id, message) { messages.push(message); }, create(value) { opened.push(value.url); }},
        },
        fetch: async (url, init) => {
            const endpoint = new URL(url).pathname;
            const body = JSON.parse(init.body);
            calls.push(endpoint);
            requests.push({endpoint, body, authorization: init.headers.Authorization});
            if (options.respond) {
                const response = options.respond(endpoint, body);
                if (response) return response;
            }
            if (failedStage === "network" && endpoint === "/api/av/addAttributeViewBlocks") throw new Error("network failure");
            let data = docID;
            if (endpoint === "/api/notebook/getNotebookConf") {
                data = {box: notebook, conf: {}};
                if (!options.legacy) data.documentCapabilities = structuredCapabilities;
            } else if (endpoint === "/api/filetree/createDocByParent") {
                data = {id: body.id};
            } else if (endpoint.includes("createAttribute")) {
                data = {blockID: docID};
            }
            return {status: 200, json: async () => endpoint === failedStage
                ? {code: -1, msg: "injected failure"} : {code: 0, data}};
        },
    });
    context.importScripts = (...files) => files.forEach(file => vm.runInContext(readFileSync(path.join(root, file), "utf8"), context));
    vm.runInContext(source, context);
    await context.handleArticleClip({api: "http://localhost:6806", token: "test-token", tabId: 1, title: "Article", tip: true,
        notebook, parentDoc, savePathMode: "search", href: "https://example.com/article", tags: "tag", listDocTree: true,
        savePathTemplate: "/", selectedDatabaseID: "database", selectedDatabaseTemplateID: template ? "template" : "",
        ...options.request},
        options.request?.api || "http://localhost:6806", {md: "body", withMath: false, ...options.copyData}, options.fetchFileErr || false);
    return {messages, calls, opened, requests,
        createdID: requests.find(request => request.endpoint === "/api/filetree/createDocByParent")?.body.id || docID};
}

for (const legacy of [false, true]) {
    for (const stage of ["/api/sqlite/flushTransaction", "/api/av/addAttributeViewBlocks", "network"]) {
        test(`retains committed document identity when database step fails (legacy=${legacy}): ${stage}`, async () => {
            const {messages, calls, opened, createdID} = await clip(stage, false, {legacy});
            const tip = messages.find(message => message.msg === "tip_clip_database_incomplete");
            assert.equal(tip.documentID, createdID);
            assert.equal(tip.timeout, 15000);
            assert.ok(!messages.some(message => message.msg === "tip_clip_ok" || message.func === "reload"));
            assert.equal(calls.filter(endpoint => endpoint.includes(legacy ? "createDocWithMd" : "createDocByParent")).length, 1);
            assert.deepEqual(opened, [`siyuan://blocks/${createdID}`]);
            if (stage.includes("flushTransaction")) assert.ok(!calls.includes("/api/av/addAttributeViewBlocks"));
        });
    }
}

test("complete clipping retains success feedback and reload", async () => {
    const {messages} = await clip();
    assert.ok(messages.some(message => message.msg === "tip_clip_ok"));
    assert.ok(messages.some(message => message.func === "reload"));
});

test("database template creation does not perform a second database insertion", async () => {
    const {messages, calls} = await clip(undefined, true);
    assert.ok(messages.some(message => message.msg === "tip_clip_ok"));
    assert.ok(!calls.includes("/api/av/addAttributeViewBlocks"));
    assert.ok(!calls.includes("/api/notebook/getNotebookConf"));
});

for (const displayPath of ["/anonnerdfrenzy/survival-llm", "/Ancestor/with/slashes/Parent", "/Old name", "/Duplicate", "/"]) {
    test(`selected parent identity is independent of display path: ${displayPath}`, async () => {
        const {requests, messages, opened, createdID} = await clip(undefined, false, {
            request: {savePathTemplate: displayPath},
        });
        assert.match(createdID, /^\d{14}-[a-z0-9]{7}$/);
        const writes = requests.filter(request => request.endpoint.includes("/createDoc"));
        assert.equal(writes.length, 1);
        assert.equal(writes[0].endpoint, "/api/filetree/createDocByParent");
        assert.deepEqual(writes[0].body, {notebook, parentID: parentDoc, id: createdID,
            title: {format: "plain", text: "Article"}, markdown: "body", tags: "tag", withMath: false,
            clippingHref: "https://example.com/article", listDocTree: true});
        assert.equal(writes[0].authorization, "Token test-token");
        const addition = requests.find(request => request.endpoint === "/api/av/addAttributeViewBlocks");
        assert.equal(addition.body.srcs[0].id, createdID);
        assert.deepEqual(opened, [`siyuan://blocks/${createdID}`]);
        assert.ok(messages.some(message => message.msg === "tip_clip_ok"));
    });
}

test("explicit notebook root uses null instead of an empty parent ID", async () => {
    const {requests} = await clip(undefined, false, {request: {parentDoc: "", savePathTemplate: "/"}});
    assert.equal(requests.find(request => request.endpoint.endsWith("/createDocByParent")).body.parentID, null);
});

test("structured creation retains title cleanup and joined emoji without splitting the new title", async () => {
    const {requests} = await clip(undefined, false, {
        request: {title: "  A\u00a0B\u200b\n\uE000\u{F0001}👩‍💻/C\\D  "},
    });
    const write = requests.find(request => request.endpoint.endsWith("/createDocByParent"));
    assert.equal(write.body.title.text, "A B👩‍💻／C／D");
});

test("structured identity reaches remote opening and image recovery, with math options retained", async () => {
    const {requests, opened, createdID} = await clip(undefined, false, {
        request: {api: "http://kernel.example:6806", selectedDatabaseID: ""}, copyData: {withMath: true}, fetchFileErr: true,
    });
    assert.equal(requests.find(request => request.endpoint.endsWith("/createDocByParent")).body.withMath, true);
    const conversion = requests.find(request => request.endpoint === "/api/format/netImg2LocalAssets");
    assert.deepEqual(conversion.body, {id: createdID, url: "https://example.com/article"});
    assert.deepEqual(opened, [`http://kernel.example:6806?id=${createdID}`]);
});

test("malformed successful creation cannot open or add an unrelated document", async () => {
    const {calls, messages, opened} = await clip(undefined, false, {
        respond: endpoint => endpoint.endsWith("/createDocByParent")
            ? {status: 200, json: async () => ({code: 0, data: {id: "unrelated"}})} : undefined,
    });
    assert.deepEqual(calls, ["/api/notebook/getNotebookConf", "/api/filetree/createDocByParent"]);
    assert.deepEqual(opened, []);
    assert.ok(messages.some(message => message.msg === "tip_siyuan_kernel_unavailable"));
});

test("a non-root legacy selection without an ID requires reselection", async () => {
    const {calls, messages} = await clip(undefined, false, {request: {parentDoc: "", savePathTemplate: "/Old parent"}});
    assert.deepEqual(calls, ["/api/notebook/getNotebookConf"]);
    assert.ok(messages.some(message => message.msg === "tip_save_path_miss"));
});

test("a successful old-kernel capability query retains legacy creation", async () => {
    const {requests, messages} = await clip(undefined, false, {legacy: true, request: {savePathTemplate: "/Parent"}});
    const write = requests.find(request => request.endpoint.endsWith("/createDocWithMd"));
    assert.equal(write.body.path, "/Parent/Article");
    assert.equal(write.body.parentID, parentDoc);
    assert.ok(!requests.some(request => request.endpoint.endsWith("/createDocByParent")));
    assert.ok(messages.some(message => message.msg === "tip_clip_ok"));
});

test("template mode still renders and uses the legacy path without a capability probe", async () => {
    const {calls, requests} = await clip(undefined, false, {
        request: {savePathMode: "template", parentDoc: "", savePathTemplate: "/{{now}}"},
        respond: endpoint => endpoint === "/api/template/renderSprig"
            ? {status: 200, json: async () => ({code: 0, data: "/2026/11"})} : undefined,
    });
    assert.equal(requests.find(request => request.endpoint.endsWith("/createDocWithMd")).body.path, "/2026/11/Article");
    assert.ok(!calls.includes("/api/notebook/getNotebookConf"));
});

test("template render errors remain visible without writing", async () => {
    const {calls, messages} = await clip("/api/template/renderSprig", false, {request: {savePathMode: "template"}});
    assert.deepEqual(calls, ["/api/template/renderSprig"]);
    assert.ok(messages.some(message => message.func === "tip" && message.msg === "injected failure"));
});

const failures = {
    "authentication failure": () => ({status: 401}),
    "forbidden": () => ({status: 403}),
    "missing route": () => ({status: 404}),
    "server failure": () => ({status: 500}),
    "network failure": () => { throw new Error("response lost"); },
    "invalid JSON": () => ({status: 200, json: async () => { throw new Error("invalid JSON"); }}),
    "invalid envelope": () => ({status: 200, json: async () => ({})}),
    "null response": () => ({status: 200, json: async () => null}),
    "kernel rejection": () => ({status: 200, json: async () => ({code: -1, msg: "parent unavailable"})}),
};
for (const endpoint of ["/api/notebook/getNotebookConf", "/api/filetree/createDocByParent"]) {
    for (const [name, respond] of Object.entries(failures)) {
        test(`${endpoint}: ${name} never retries or falls back`, async () => {
            const {calls, messages, opened} = await clip(undefined, false, {
                respond: current => current === endpoint ? respond() : undefined,
            });
            assert.deepEqual(calls, endpoint.endsWith("getNotebookConf")
                ? [endpoint] : ["/api/notebook/getNotebookConf", endpoint]);
            assert.deepEqual(opened, []);
            assert.ok(messages.some(message => message.func === "tip" || message.func === "tipKey"));
            assert.ok(!messages.some(message => message.msg === "tip_clip_ok" || message.func === "reload"));
        });
    }
}

for (const data of [null, {}, {box: "other", conf: {}}, {box: notebook},
    {box: notebook, conf: {}, documentCapabilities: null},
    {box: notebook, conf: {}, documentCapabilities: {structuredPaths: false}},
    {box: notebook, conf: {}, documentCapabilities: {structuredPaths: true, titleFormats: []}}]) {
    test(`invalid capability data stops before creation: ${JSON.stringify(data)}`, async () => {
        const {calls} = await clip(undefined, false, {
            respond: () => ({status: 200, json: async () => ({code: 0, data})}),
        });
        assert.deepEqual(calls, ["/api/notebook/getNotebookConf"]);
    });
}

for (const failure of [
    {reason: "parentUnavailable", commitState: "none"},
    {reason: "writeFailed", commitState: "unknown"},
    {reason: "writeFailed", commitState: "committed"},
]) {
    test(`structured failure ${failure.reason}/${failure.commitState} never creates again`, async () => {
        const {calls} = await clip(undefined, false, {
            respond: (endpoint, body) => endpoint.endsWith("/createDocByParent")
                ? {status: 200, json: async () => ({code: -1, msg: "injected failure", data: {...failure, id: body.id}})} : undefined,
        });
        assert.deepEqual(calls, ["/api/notebook/getNotebookConf", "/api/filetree/createDocByParent"]);
    });
}

test("partial-completion feedback is translated in every bundled language", () => {
    for (const language of readdirSync(path.join(root, "_locales"))) {
        const messages = JSON.parse(readFileSync(path.join(root, "_locales", language, "messages.json"), "utf8"));
        assert.ok(messages.tip_clip_database_incomplete.message.trim(), language);
    }
});

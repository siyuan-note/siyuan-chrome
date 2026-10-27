const assert = require("node:assert/strict");
const {readFileSync, readdirSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = readFileSync(path.join(root, "background.js"), "utf8");
const docID = "20261027000000-clipdoc";

async function clip(failedStage, template = false) {
    const messages = [], calls = [], opened = [];
    const context = vm.createContext({
        console: {warn() {}},
        chrome: {
            runtime: {onInstalled: {addListener() {}}, onMessage: {addListener() {}}},
            contextMenus: {onClicked: {addListener() {}}},
            commands: {onCommand: {addListener() {}}},
            storage: {sync: {get(defaults, callback) { callback({...defaults, clipTemplate: "${content}", expOpenAfterClip: true}); }}},
            tabs: {sendMessage(_id, message) { messages.push(message); }, create(value) { opened.push(value.url); }},
        },
        siyuanKernelFetch: async ({path: endpoint}) => {
            calls.push(endpoint);
            if (endpoint === failedStage) return {ok: true, data: {code: -1, msg: "injected failure"}};
            if (failedStage === "network" && endpoint === "/api/av/addAttributeViewBlocks") return {ok: false, error: "network failure"};
            return {ok: true, data: {code: 0, data: endpoint.includes("createAttribute") ? {blockID: docID} : docID}};
        },
    });
    context.importScripts = (...files) => files.filter(file => file.includes("storage-defaults")).forEach(file => vm.runInContext(readFileSync(path.join(root, file), "utf8"), context));
    vm.runInContext(source, context);
    await context.handleArticleClip({api: "http://localhost:6806", token: "", tabId: 1, title: "Article", tip: true,
        savePathTemplate: "/", selectedDatabaseID: "database", selectedDatabaseTemplateID: template ? "template" : ""},
        "http://localhost:6806", {md: "body", withMath: false}, false);
    return {messages, calls, opened};
}

for (const stage of ["/api/sqlite/flushTransaction", "/api/av/addAttributeViewBlocks", "network"]) {
    test(`retains committed document identity when database step fails: ${stage}`, async () => {
        const {messages, calls, opened} = await clip(stage);
        const tip = messages.find(message => message.msg === "tip_clip_database_incomplete");
        assert.equal(tip.documentID, docID);
        assert.equal(tip.timeout, 15000);
        assert.ok(!messages.some(message => message.msg === "tip_clip_ok" || message.func === "reload"));
        assert.equal(calls.filter(endpoint => endpoint.includes("createDocWithMd")).length, 1);
        assert.deepEqual(opened, [`siyuan://blocks/${docID}`]);
        if (stage.includes("flushTransaction")) assert.ok(!calls.includes("/api/av/addAttributeViewBlocks"));
    });
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
});

test("partial-completion feedback is translated in every bundled language", () => {
    for (const language of readdirSync(path.join(root, "_locales"))) {
        const messages = JSON.parse(readFileSync(path.join(root, "_locales", language, "messages.json"), "utf8"));
        assert.ok(messages.tip_clip_database_incomplete.message.trim(), language);
    }
});

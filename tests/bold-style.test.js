const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {runInNewContext} = require("node:vm");

const contentSource = readFileSync(path.join(__dirname, "../content.js"), "utf8");
const text = value => ({nodeType: 3, nodeValue: value});
const element = (tagName, weight, children = []) => {
    const result = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        weight,
        childNodes: children,
        querySelectorAll(selector) {
            if (selector !== "*") return [];
            return this.childNodes.flatMap(child => child.nodeType === 1 ? [child, ...child.querySelectorAll("*")] : []);
        },
        replaceChild(replacement, child) {
            this.childNodes[this.childNodes.indexOf(child)] = replacement;
            replacement.parentElement = this;
            child.parentElement = null;
        },
    };
    children.forEach(child => child.parentElement = result);
    return result;
};

const createScope = (expBold = true) => {
    const scope = {
        siyuanInitLanguageFromStorage: () => Promise.resolve(),
        chrome: {
            storage: {
                onChanged: {addListener() {}},
                sync: {get: (defaults, callback) => callback({expBold})},
            },
            runtime: {},
        },
        document: {
            addEventListener() {},
            createElement: tagName => element(tagName),
            cloneNode: () => ({}),
            querySelectorAll: () => [],
        },
        window: {getComputedStyle: node => {
            let current = node;
            while (current && current.weight === undefined) current = current.parentElement;
            return {fontWeight: current?.weight || "400"};
        }},
        Node: {TEXT_NODE: 3, ELEMENT_NODE: 1},
        SIYUAN_EXP_STORAGE_KEYS: [],
        siyuanStorageDefaultsFor: () => ({}),
        siyuanNormalizePictureImages() {},
    };
    runInNewContext(contentSource, scope);
    return scope;
};

test("converts semibold and heavier computed weights to bold tags", () => {
    const scope = createScope();
    for (const weight of ["600", "650", "700", "800", "900", "1000", "bold"]) {
        const span = element("span", weight, [text("emphasis")]);
        scope.siyuanProcessBoldStyle(element("div", "400", [span]));
        assert.equal(span.childNodes[0].tagName, "B", weight);
        assert.equal(span.childNodes[0].textContent, "emphasis", weight);
    }
});

test("keeps normal, medium and subthreshold computed weights unchanged", () => {
    const scope = createScope();
    for (const weight of ["100", "400", "500", "599", "599.9", "normal", ""]) {
        const original = text("plain");
        const span = element("span", weight, [original]);
        scope.siyuanProcessBoldStyle(element("div", "400", [span]));
        assert.equal(span.childNodes[0], original, weight);
    }
});

test("handles nested inherited weights without duplicating existing bold tags", () => {
    const scope = createScope();
    const nested = element("span", undefined, [text("nested")]);
    const root = element("div", "400", [element("p", "600", [text("direct"), nested])]);
    scope.siyuanProcessBoldStyle(root);
    assert.equal(root.childNodes[0].childNodes[0].tagName, "B");
    assert.equal(nested.childNodes[0].tagName, "B");
    const directBold = root.childNodes[0].childNodes[0];
    const nestedBold = nested.childNodes[0];
    scope.siyuanProcessBoldStyle(root);
    assert.equal(root.childNodes[0].childNodes[0], directBold);
    assert.equal(nested.childNodes[0], nestedBold);

    for (const tagName of ["b", "strong", "h1", "h2", "h3", "h4", "h5", "h6"]) {
        const original = text("already emphasized");
        const child = element("span", "600", [original]);
        scope.siyuanProcessBoldStyle(element("div", "400", [element(tagName, "600", [child])]));
        assert.equal(child.childNodes[0], original, tagName);
    }
});

test("only converts computed bold styles when the recognition setting is enabled", async () => {
    for (const enabled of [false, true]) {
        const scope = createScope(enabled);
        const original = text("configured emphasis");
        const span = element("span", "600", [original]);
        const root = element("div", "400", [span]);
        root.documentURI = "https://example.com/article";
        await scope.siyuanGetCloneNode(root);
        assert.equal(span.childNodes[0].tagName === "B", enabled);
        if (!enabled) assert.equal(span.childNodes[0], original);
    }
});

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {runInNewContext} = require("node:vm");

const scope = {URL, window: {matchMedia: media => ({matches: media !== "(max-width: 1px)"})}};
runInNewContext(readFileSync(path.join(__dirname, "../lib/siyuan-picture-images.js"), "utf8"), scope);
const element = (tagName, values, parent) => ({
    tagName,
    currentSrc: "",
    closest: () => parent,
    getAttribute: name => values[name] ?? null,
    setAttribute: (name, value) => values[name] = value,
    removeAttribute: name => delete values[name],
});

test("parses image candidates including URL commas, relative paths, and density descriptors", () => {
    const source = scope.siyuanGetPictureImageSource;
    assert.equal(source("https://example.com/a,w_320.webp 320w, https://example.com/a,w_1280.webp 1280w"),
        "https://example.com/a,w_1280.webp");
    assert.equal(source("/large.png 2x, /small.png 1x", "https://example.com/article"), "https://example.com/large.png");
    assert.equal(source("https://example.com/a.png,"), "https://example.com/a.png");
    for (const value of ["", "https://example.com/a.png 0w", "https://example.com/a.png 0x",
        "https://example.com/a.png 1x 2x", "javascript:alert(1) 2x", "file:///tmp/a.png 640w",
        "data:image/png;base64,YQ== 1x", "https://example.com/a.png " + "9".repeat(400) + "w"]) {
        assert.equal(source(value), "", value);
    }
});

test("normalizes loaded and unloaded cloned pictures without changing the original image", () => {
    const picture = {children: [element("SOURCE", {srcset: "/small.png 160w, /large.png 640w"})]};
    const originalValues = {src: "data:image/png;base64,YQ==", "data-original": "/placeholder.png"};
    const original = element("IMG", originalValues, picture);
    original.currentSrc = "https://example.com/small.png";
    const cloneValues = {...originalValues};
    const clone = element("IMG", cloneValues);
    scope.siyuanNormalizePictureImages({querySelectorAll: () => [clone]}, "https://example.com/article", [original]);
    assert.equal(cloneValues.src, original.currentSrc);
    assert.equal(cloneValues["data-original"], undefined);
    assert.equal(originalValues.src, "data:image/png;base64,YQ==");
    assert.equal(originalValues["data-original"], "/placeholder.png");
    original.currentSrc = "";
    scope.siyuanNormalizePictureImages({querySelectorAll: () => [clone]}, "https://example.com/article", [original]);
    // 已归一化的网络地址不再被未加载的候选集覆盖。
    assert.equal(cloneValues.src, "https://example.com/small.png");
    cloneValues.src = originalValues.src;
    scope.siyuanNormalizePictureImages({querySelectorAll: () => [clone]}, "https://example.com/article", [original]);
    assert.equal(cloneValues.src, "https://example.com/large.png");
});

test("skips unmatched media and unsupported types and preserves standalone or genuine inline images", () => {
    const picture = {children: [
        element("SOURCE", {srcset: "https://example.com/mobile.png 640w", media: "(max-width: 1px)"}),
        element("SOURCE", {srcset: "https://example.com/unsupported.jxl 640w", type: "image/jxl"}),
        element("SOURCE", {"data-srcset": "https://example.com/desktop.png 640w", type: "image/png"}),
    ]};
    const values = {src: "data:image/png;base64,YQ=="};
    const image = element("IMG", values, picture);
    scope.siyuanNormalizePictureImages({querySelectorAll: () => [image]}, "https://example.com/article");
    assert.equal(values.src, "https://example.com/desktop.png");
    for (const parent of [null, {children: []}]) {
        values.src = "data:image/png;base64,YQ==";
        scope.siyuanNormalizePictureImages({querySelectorAll: () => [element("IMG", values, parent)]},
            "https://example.com/article");
        assert.equal(values.src, "data:image/png;base64,YQ==");
    }
    values.src = "assets/existing.png";
    scope.siyuanNormalizePictureImages({querySelectorAll: () => [image]}, "https://example.com/article");
    assert.equal(values.src, "assets/existing.png");
});

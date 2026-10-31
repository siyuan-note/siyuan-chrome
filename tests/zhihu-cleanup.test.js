const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {createContentDOM} = require("./helpers/content-dom");

const fixture = readFileSync(path.join(__dirname, "fixtures/zhihu-cleanup.html"), "utf8");
const answerURL = "https://www.zhihu.com/question/525340252/answer/2096359689613227077";

function assertClean(root) {
    assert.equal(root.querySelector(".HotSearchCard"), null);
    assert.equal(root.querySelector("a.RichContent-EntityWord"), null);
    assert.equal(root.querySelector("svg"), null);
    assert.equal(root.querySelector("img"), null);
    assert.equal(root.querySelector("strong").textContent, "calculus");
    assert.match(root.textContent, /discusses calculus and philosophy/);
    assert.match(root.textContent, /phrase 大家都在搜/);
    assert.doesNotMatch(root.textContent, /UNRELATED_TRENDING_TOPIC/);
    assert.ok(root.querySelector('a[href="https://example.com/reference"]'));
    assert.ok(root.querySelector('a[href="https://zhida.zhihu.com/"]'));
}

test("Zhihu cleanup preserves author text and ordinary links and only changes the clipping copy", t => {
    const {window, document} = createContentDOM(t, fixture, {url: answerURL});
    const before = document.documentElement.outerHTML;
    const clone = document.cloneNode(true);
    window.siyuanCleanZhihu(clone, document.URL);
    assertClean(clone.body);
    window.siyuanCleanZhihu(clone, document.URL);
    assertClean(clone.body);
    assert.equal(document.documentElement.outerHTML, before);
});

test("Zhihu cleanup is limited to exact Zhihu domains including columns", t => {
    for (const url of ["https://example.com/zhihu.com", "https://evilzhihu.com/", "https://zhihu.com.example.com/", "invalid"]) {
        const {window, document} = createContentDOM(t, fixture);
        const before = document.body.innerHTML;
        window.siyuanCleanZhihu(document, url);
        assert.equal(document.body.innerHTML, before, url);
    }
    for (const url of ["https://zhihu.com/", "https://zhuanlan.zhihu.com/p/123"]) {
        const {window, document} = createContentDOM(t, fixture, {url});
        window.siyuanCleanZhihu(document, url);
        assertClean(document.body);
    }
});

for (const expSpan of [false, true]) {
    test(`article clipping filters Zhihu before Readability with span recognition ${expSpan}`, async t => {
        const {window, document, messages} = createContentDOM(t, fixture, {url: answerURL, expSpan});
        await window.clipArticle(1);
        const upload = messages.find(message => message.func === "upload-copy");
        assert.ok(upload, "article clipping sends content for upload");
        const result = document.createElement("div");
        result.innerHTML = upload.data.dom;
        assertClean(result);
        assert.equal(result.querySelectorAll("br").length, Number(expSpan));
        assert.ok(document.querySelector(".HotSearchCard"));
        assert.ok(document.querySelector("a.RichContent-EntityWord"));
    });
}

test("Zhihu cleanup removes direct-answer icons converted by the SVG option", async t => {
    const {window, document, messages} = createContentDOM(t, fixture, {url: answerURL, expSvgToImg: true});
    await window.clipArticle(1);
    assert.ok(document.querySelector("a.RichContent-EntityWord img"), "SVG option converts the live icon");
    const result = document.createElement("div");
    result.innerHTML = messages.find(message => message.func === "upload-copy").data.dom;
    assertClean(result);
});

test("selection clipping filters Zhihu without editing the live selection", async t => {
    const {window, document, messages} = createContentDOM(t, fixture, {url: answerURL});
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection().addRange(range);
    const before = document.querySelector("article").outerHTML;
    await window.clipSelection({func: "copy", tabId: 1});
    const upload = messages.find(message => message.func === "upload-copy");
    assert.ok(upload, "selection clipping sends content for upload");
    const result = document.createElement("div");
    result.innerHTML = upload.data.dom;
    assertClean(result);
    assert.equal(document.querySelector("article").outerHTML, before);
    assert.ok(document.querySelector(".HotSearchCard"));
});

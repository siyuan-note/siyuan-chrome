const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {JSDOM} = require("jsdom");
const {createContentDOM} = require("./helpers/content-dom");

const fixture = readFileSync(path.join(__dirname, "fixtures/wechat-headings.html"), "utf8");
const source = readFileSync(path.join(__dirname, "../lib/Readability.js"), "utf8");
const wechatURL = "https://mp.weixin.qq.com/s/example";

function createParser(t, html = fixture, url = wechatURL) {
    const dom = new JSDOM(html, {url, runScripts: "outside-only"});
    t.after(() => dom.window.close());
    dom.window.eval(source);
    const clone = dom.window.document.cloneNode(true);
    return {window: dom.window, document: dom.window.document, clone, parser: new dom.window.Readability(clone, {keepClasses: true})};
}

function assertArticle(root) {
    for (const [id, tag] of Object.entries({
        primary: "H1",
        paragraph: "P",
        secondary: "H2",
        "paragraph-with-emphasis": "P",
        "paragraph-with-code": "P",
        "styled-primary": "H1",
        "styled-secondary": "H2",
        "ordinary-bold": "P",
        "larger-emphasis": "P",
        "numbered-prose": "P",
        "mixed-size": "P",
        "wrong-depth": "P",
        "plain-heading": "H2",
        "long-heading": "H3",
        "deep-heading": "H6",
    })) {
        assert.equal(root.querySelector(`#${id}`)?.tagName, tag, id);
    }
    assert.equal(root.querySelectorAll("img").length, 2);
    assert.equal(root.querySelector('img[alt="first image"]').getAttribute("src"), "https://example.com/first.png");
    assert.equal(root.querySelector('a[href="https://example.com/reference"]').textContent, "a reference link");
    assert.equal(root.querySelector("#paragraph-with-emphasis strong").textContent, "one emphasized phrase");
    assert.equal(root.querySelector("#paragraph-with-code code").textContent, "run()");
    assert.match(root.textContent, /The final paragraph confirms/);
    assert.equal(root.querySelector("[data-readability-weixin-heading]"), null);
}

test("Readability restores WeChat paragraph semantics and heading levels before removing styles", t => {
    const {parser, document} = createParser(t);
    const original = document.documentElement.outerHTML;
    const article = parser.parse();
    assert.ok(article?.content);
    const result = document.createElement("div");
    result.innerHTML = article.content;
    assertArticle(result);
    assert.equal(document.documentElement.outerHTML, original);
});

test("heading levels survive Readability extraction retries without leaking internal attributes", t => {
    const {parser, document} = createParser(t);
    parser._charThreshold = 100000;
    const result = document.createElement("div");
    result.innerHTML = parser.parse().content;
    assertArticle(result);
});

test("WeChat normalization preserves text, inline markup, protected content and the article boundary", t => {
    const {parser, clone} = createParser(t);
    const text = clone.querySelector("#js_content").textContent;
    const protectedHTML = ["quote", "list-emphasis", "code", "formula"].map(id => clone.getElementById(id).outerHTML);
    parser._normalizeWeixinHeadings();
    assert.equal(clone.querySelector("#js_content").textContent, text);
    assert.equal(clone.querySelector("#outside-heading").outerHTML, '<h1 id="outside-heading">Outside the article</h1>');
    assert.deepEqual(["quote", "list-emphasis", "code", "formula"].map(id => clone.getElementById(id).outerHTML), protectedHTML);
    const once = clone.documentElement.outerHTML;
    parser._normalizeWeixinHeadings();
    assert.equal(clone.documentElement.outerHTML, once);
});

test("normalization requires the exact WeChat host and its article container", t => {
    for (const url of ["https://example.com/mp.weixin.qq.com", "https://mp.weixin.qq.com.example.com/s/example", "https://evilmp.weixin.qq.com/s/example"]) {
        const {parser, clone} = createParser(t, fixture, url);
        const original = clone.documentElement.outerHTML;
        parser._normalizeWeixinHeadings();
        assert.equal(clone.documentElement.outerHTML, original, url);
    }
    const {parser, clone} = createParser(t, fixture.replace('id="js_content"', 'id="other-content"'));
    const original = clone.documentElement.outerHTML;
    parser._normalizeWeixinHeadings();
    assert.equal(clone.documentElement.outerHTML, original);
});

test("non-WeChat articles retain the existing heading conversion", t => {
    const {parser, document} = createParser(t, fixture, "https://example.com/article");
    const result = document.createElement("div");
    result.innerHTML = parser.parse().content;
    assert.equal(result.querySelector("#primary").tagName, "H2");
    assert.equal(result.querySelector("#paragraph").tagName, "H2");
    assert.equal(result.querySelector("#styled-primary").tagName, "P");
});

test("explicit size alone does not change headings without matching article typography", t => {
    const html = '<div id="js_content"><h1 id="heading"><span style="font-size:15px">A genuine heading.</span></h1><p><span style="font-size:15px">Ordinary body text.</span></p></div>';
    const {parser, clone} = createParser(t, html);
    parser._normalizeWeixinHeadings();
    assert.equal(clone.querySelector("#heading").tagName, "H1");
});

test("body-sized bold headings and unsupported font units retain their semantic tags", t => {
    const extra = '<h2 id="small-bold"><span style="font-size:15px;font-weight:bold">A small bold heading.</span></h2>' +
        '<h2 id="relative-size"><span style="font-size:1em">A heading with a relative font size.</span></h2>';
    const {parser, clone} = createParser(t, fixture.replace('<div id="js_content">', '<div id="js_content">' + extra));
    parser._normalizeWeixinHeadings();
    assert.equal(clone.querySelector("#small-bold").tagName, "H2");
    assert.equal(clone.querySelector("#relative-size").tagName, "H2");
});

test("ambiguous heading styles do not promote ordinary paragraphs", t => {
    const extra = '<h2><span style="font-size:18px;font-weight:bold">3. Another semantic heading level</span></h2>';
    const {parser, clone} = createParser(t, fixture.replace('<div id="js_content">', '<div id="js_content">' + extra));
    parser._normalizeWeixinHeadings();
    assert.equal(clone.querySelector("#styled-primary").tagName, "P");
});

for (const expSpan of [false, true]) {
    test(`browser article clipping uses WeChat normalization with span recognition ${expSpan}`, async t => {
        const {window, document, messages} = createContentDOM(t, fixture, {url: wechatURL, expSpan});
        await window.clipArticle(1);
        const upload = messages.find(message => message.func === "upload-copy");
        assert.ok(upload);
        const result = document.createElement("div");
        result.innerHTML = upload.data.dom;
        assertArticle(result);
        assert.equal(document.querySelector("#paragraph").tagName, "H1");
        assert.equal(document.querySelector("#styled-primary").tagName, "P");
    });
}

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createContentDOM} = require("./helpers/content-dom");

const styled = (content, whiteSpace = "normal") => `<style>
    .wrap, .wrap * {white-space: ${whiteSpace}; overflow-wrap: break-word;}
    </style><p><span class="wrap">${content}</span></p>`;

test("span newline recognition preserves links, formatting, images and existing breaks without newlines", t => {
    const {window, document} = createContentDOM(t, styled(
        'before <a href="https://example.com/source"><strong>link</strong></a> <em>after</em><br><img src="/image.png">'));
    const span = document.querySelector(".wrap");
    const html = span.innerHTML;
    const nodes = [...span.querySelectorAll("*")];
    window.siyuanSpansAddBr(document);
    assert.equal(span.innerHTML, html);
    assert.deepEqual([...span.querySelectorAll("*")], nodes);
});

test("span newline recognition inserts breaks inside links without flattening inline markup or joining words", t => {
    const {window, document} = createContentDOM(t, styled(
        'before <a href="https://example.com/source">first\n<strong>second</strong></a> after\nlast<br><img src="/image.png">'));
    const link = document.querySelector("a");
    const strong = document.querySelector("strong");
    const image = document.querySelector("img");
    window.siyuanSpansAddBr(document);
    assert.equal(document.querySelector("a"), link);
    assert.equal(document.querySelector("strong"), strong);
    assert.equal(document.querySelector("img"), image);
    assert.equal(link.innerHTML, "first<br><strong>second</strong>");
    assert.match(document.querySelector(".wrap").innerHTML, /<\/a> after<br>last<br><img/);
    const once = document.body.innerHTML;
    window.siyuanSpansAddBr(document);
    assert.equal(document.body.innerHTML, once);
});

test("span newline recognition keeps literal HTML as text", t => {
    const {window, document} = createContentDOM(t, styled('literal &lt;b&gt;text&lt;/b&gt;\n&lt;img src=x&gt; &amp; end'));
    window.siyuanSpansAddBr(document);
    const span = document.querySelector(".wrap");
    assert.equal(span.querySelectorAll("b, img").length, 0);
    assert.equal(span.innerHTML, "literal &lt;b&gt;text&lt;/b&gt;<br>&lt;img src=x&gt; &amp; end");
});

test("span newline recognition preserves code and formula descendants", t => {
    const {window, document} = createContentDOM(t, styled('before\nafter' +
        '<code>x\ny</code><span class="katex">a\nb</span><span data-formula="c">c\nd</span><math><mi>e\nf</mi></math>'));
    const protectedNodes = [...document.querySelectorAll("code, .katex, [data-formula], math")];
    const before = protectedNodes.map(node => node.outerHTML);
    window.siyuanSpansAddBr(document);
    assert.equal(document.querySelector(".wrap > br").tagName, "BR");
    assert.deepEqual([...document.querySelectorAll("code, .katex, [data-formula], math")], protectedNodes);
    assert.deepEqual(protectedNodes.map(node => node.outerHTML), before);
});

for (const [whiteSpace, expected] of [
    ["normal", "a<br>b c"], ["pre-wrap", "a  <br>b\t c"],
]) {
    test(`span newline recognition retains ${whiteSpace} whitespace handling`, t => {
        const {window, document} = createContentDOM(t, styled("a  \n\nb\t c", whiteSpace));
        window.siyuanSpansAddBr(document);
        assert.equal(document.querySelector(".wrap").innerHTML, expected);
    });
}

test("span recognition respects its setting, style criteria and ignored ancestors", async t => {
    for (const expSpan of [false, true]) {
        const {window, document} = createContentDOM(t, styled('a\n<a href="/source">link</a>'), {expSpan});
        const clone = await window.siyuanGetCloneNode(document);
        assert.equal(clone.querySelectorAll("br").length, Number(expSpan));
        assert.equal(clone.querySelector("a").getAttribute("href"), "/source");
    }
    const {window, document} = createContentDOM(t,
        '<p><span>a\nb</span></p><pre><span style="white-space:normal;overflow-wrap:break-word">c\nd</span></pre>' +
        '<p class="katex"><span style="white-space:normal;overflow-wrap:break-word">e\nf</span></p>');
    const before = document.body.innerHTML;
    window.siyuanSpansAddBr(document);
    assert.equal(document.body.innerHTML, before);
});

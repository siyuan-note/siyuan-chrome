document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.onMessage.addListener(
        async (request, sender, sendResponse) => {
            if ('tip' === request.func && request.tip) {
                siyuanShowTip(request.msg, request.timeout)
                return
            }

            if ('tipKey' === request.func && request.tip) {
                siyuanShowTipByKey(request.msg, request.timeout)
                return
            }

            if ('copy2Clipboard' === request.func) {
                await copyToClipboard(request.data)
                return
            }

            if ('reload' === request.func) {
                window.location.reload()
                return
            }

            if ('siyuanGetReadability' === request.func) {
                siyuanGetReadability(request.tabId)
                return
            }

            if ('copy' !== request.func) {
                return
            }

            siyuanShowTipByKey("tip_clipping")

            const selection = window.getSelection()
            if (selection && 0 < selection.rangeCount) {
                const range = selection.getRangeAt(0)
                const tempElement = document.createElement('div')
                tempElement.appendChild(range.cloneContents())
                siyuanSendUpload(tempElement, request.tabId, request.srcUrl, "part")
            }
        })

    const copyToClipboard = async (textToCopy) => {
        // 修复无焦点的未捕获异常：https://github.com/siyuan-note/siyuan/issues/13208
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (navigator.clipboard && window.isSecureContext) {
            try {
                return await navigator.clipboard.writeText(textToCopy);
            } catch (error) {
                //console.warn('Failed to copy text: ', error);
            }
        }

        let textArea = document.createElement('textarea')
        textArea.value = textToCopy
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        return new Promise((res, rej) => {
            document.execCommand('copy') ? res() : rej()
            textArea.remove()
        })
    }
})

let tipTimeoutId

const siyuanShowTip = (msg, timeout) => {
    let messageElement = document.getElementById('siyuanmessage')
    if (!messageElement) {
        document.body.insertAdjacentHTML('afterend', `<div style=" position:fixed;top: 0;z-index: 999999999;transform: translate3d(0, -100px, 0);opacity: 0;transition: opacity 0.15s cubic-bezier(0, 0, 0.2, 1) 0ms, transform 0.15s cubic-bezier(0, 0, 0.2, 1) 0ms;width: 100%;align-items: center;justify-content: center;height: 0;display: flex;" id="siyuanmessage">
<div style="line-height: 20px;border-radius: 4px;padding: 8px 16px;color: #fff;font-size: inherit;background-color: #4285f4;box-sizing: border-box;box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12);transition: transform 0.15s cubic-bezier(0, 0, 0.2, 1) 0ms;transform: scale(0.8);top: 16px;position: absolute;word-break: break-word;max-width: 80vw;"></div></div>`)
        messageElement = document.getElementById('siyuanmessage')
    }

    messageElement.style.transform = 'translate3d(0, 0, 0)'
    messageElement.style.opacity = '1'
    messageElement.firstElementChild.innerHTML = msg
    if (!timeout) {
        timeout = 5000
    }

    if (tipTimeoutId) {
        clearTimeout(tipTimeoutId);
    }

    tipTimeoutId = setTimeout(() => {
        siyuanClearTip();
    }, timeout);
}

// Add i18n support https://github.com/siyuan-note/siyuan/issues/13559
const siyuanShowTipByKey = (msgKey, timeout) => {
    siyuanShowTip(chrome.i18n.getMessage(msgKey), timeout);
}

const siyuanClearTip = () => {
    let messageElement = document.getElementById('siyuanmessage')
    if (!messageElement) {
        return
    }
    messageElement.style.transform = 'translate3d(0, -100px, 0)'
    messageElement.style.opacity = '0'
}

const siyuanConvertBlobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader
    reader.onerror = reject
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
})

// 网页换行用 span 样式 word-break 的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
// 递归查找父元素直到找到 pre、code、span、math 或 math相关标签
function isIgnoredElement(element) {
    // 递归查找父元素直到找到 pre、code、span、math 或 math相关标签
    while (element) {
        let tagName = element.tagName.toLowerCase();
        const className = element.className.toLowerCase();
        if (tagName === 'math' ||
            className.includes('math') || className.includes('mathjax') || className.includes('latex') ||
            className.includes('katex') || className.includes('mjx') || className.includes('mathml') ||
            className.includes('equation') || className.includes('formula')) {
            return true;
        }

        element = element.parentElement; // 移动到父元素
        if (!element) {
            break;
        }

        tagName = element.tagName.toLowerCase();

        // 如果父元素是 pre、code、span、math 或与数学相关的类名
        if (tagName === 'pre' || tagName === 'code' || tagName === 'span' || tagName === 'section') {
            return true;
        } else if (tagName === 'div' || tagName === 'p') {
            return false; // 找到 div、p 直接返回
        }
    }
    return false; // 没找到时返回 false
}

// span元素的换行处理优化：https://github.com/siyuan-note/siyuan/issues/14775
// 规范：https://developer.mozilla.org/zh-CN/docs/Web/CSS/white-space
function siyuanProcessTextByWhiteSpace(element) {
    const text = element.textContent;
    const whiteSpace = getComputedStyle(element).whiteSpace;
    const brTag = '<br>';

    switch (whiteSpace) {
        case 'normal':
        case 'nowrap':
            // 合并所有空白字符为一个空格；换行为 <br>；去除行末空格
            return text
                .replace(/[ \t\r\f\v]+/g, ' ')         // 合并空格和制表符
                .replace(/[ \t]+\n/g, '\n')            // 去除行末空格
                .replace(/\n+/g, brTag)               // 合并换行并转为 <br>
                .trim();
        case 'pre':
            // 保留所有空白和换行，换行转为 <br>
            return text
                .replace(/\n/g, brTag);
        case 'pre-wrap':
            // 保留空白字符，换行转为 <br>，不处理行末空格（挂起）
            return text
                .replace(/\n+/g, brTag);
        case 'pre-line':
            // 合并空格，保留换行符，换行转为 <br>，移除行末空格
            return text
                .replace(/[ \t\r\f\v]+/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n+/g, brTag)
                .trim();
        case 'break-spaces':
            // 保留所有空白字符和换行符，换行为 <br>
            return text
                .replace(/\n/g, brTag);
        default:
            // 默认处理和 normal 相同
            return text
                .replace(/[ \t\r\f\v]+/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n+/g, brTag)
                .trim();
    }
}


// 处理会换行的 span 后添加 <br>，让内核能识别到换行
function siyuanSpansAddBr(tempElement) {
    const spans = tempElement.querySelectorAll('span');
    if (!spans || spans.length === 0) {
        console.log('No span elements found.');
        return;
    }

    // 用于存储符合条件的 span 元素
    const matchedSpans = [];

    spans.forEach((span) => {
        const style = window.getComputedStyle(span);

        // 现有的条件判断，判断是否满足换行条件
        if (
            (style.whiteSpace.trim().toLowerCase() === 'normal' || style.whiteSpace.trim().toLowerCase() === 'pre-wrap') &&
            (style.wordWrap.trim().toLowerCase() === 'break-word' || style.overflowWrap.trim().toLowerCase() === 'break-word' || style.wordBreak.trim().toLowerCase() === 'break-word')
        ) {
            // 检查父元素是否是 pre、code 或 span
            if (isIgnoredElement(span)) {
                console.log('Skipping span due to parent being pre, code or span.');
                return; // 如果父元素是 pre、code 或 span 或者数学公式，跳过该 span
            }

            span.innerHTML = siyuanProcessTextByWhiteSpace(span);

            // 添加到符合条件的数组中
            matchedSpans.push(span);
        }
    });

    if (matchedSpans.length > 0) {
        console.log(`Added <br> for ${matchedSpans.length} span elements.(Total span: ${spans.length})`);
        console.log('Matched span elements:', matchedSpans);
    } else {
        console.log('No span elements matched the criteria.');
    }
};

// 替换粗体样式为内核可识别<b>标签 https://github.com/siyuan-note/siyuan/issues/13306
function siyuanProcessBoldStyle(tempElement) {
    // 获取所有应用了 font-weight: bold 的元素
    const boldElements = tempElement.querySelectorAll('*');

    boldElements.forEach(element => {
        const style = window.getComputedStyle(element);
        if (element.tagName === 'B' || element.tagName === 'STRONG') {
            return; // 如果元素本身是 <b> 或 <strong> 标签，跳过
        }

        if (parentContainsBold(element)) {
            return;  // 如果元素的父元素是 <b> 或 <strong> 标签，跳过
        }

        // 判断是否具有 font-weight: bold
        if (style.fontWeight === 'bold' || style.fontWeight === '700') { // '700' 是 bold 的常见数值
            // 将 element 中的各个元素使用 <b> 标签包裹
            const children = element.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    // 如果是文本节点，直接包裹在 <b> 标签中
                    const text = child.nodeValue;
                    const textElement = document.createElement('b');
                    textElement.textContent = text;
                    element.replaceChild(textElement, child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // 如果是元素节点，递归处理
                    const childElement = child;
                    const childTagName = childElement.tagName.toLowerCase();
                    if (childTagName === 'b' || childTagName === 'strong') {
                        continue; // 如果是 <b> 或 <strong> 标签，跳过
                    }
                    if (parentContainsBold(childElement)) {
                        continue;  // 如果元素的父元素是 <b> 或 <strong> 标签，跳过
                    }
                    // 递归处理
                    siyuanProcessBoldStyle(childElement);
                }
            }
        }
    });
}

function parentContainsBold(element) {
    let parent = element.parentElement;
    while (parent) {
        if (parent.tagName === 'B' || parent.tagName === 'STRONG' ||
            parent.tagName === 'H1' || parent.tagName === 'H2' || parent.tagName === 'H3' || parent.tagName === 'H4' || parent.tagName === 'H5' || parent.tagName === 'H6') {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

// 替换斜体样式为内核可识别 <i> 标签 https://github.com/siyuan-note/siyuan/issues/13306
function siyuanProcessItalicStyle(tempElement) {
    // 获取所有元素
    const allElements = tempElement.querySelectorAll('*');

    allElements.forEach(element => {
        const style = window.getComputedStyle(element);
        if (element.tagName === 'I' || element.tagName === 'EM') {
            return; // 如果元素本身是 <i> 或 <em> 标签，跳过
        }

        if (parentContainsItalic(element)) {
            return;  // 如果元素的父元素是 I 或 EM 标签，跳过
        }

        // 判断是否具有 font-style: italic
        if (style.fontStyle === 'italic') {
            // 将 element 中的各个元素使用 <i> 标签包裹
            const children = element.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    // 如果是文本节点，直接包裹在 <i> 标签中
                    const text = child.nodeValue;
                    const textElement = document.createElement('i');
                    textElement.textContent = text;
                    element.replaceChild(textElement, child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // 如果是元素节点，递归处理
                    const childElement = child;
                    const childTagName = childElement.tagName.toLowerCase();
                    if (childTagName === 'i' || childTagName === 'em') {
                        continue; // 如果是 <i> 或 <em> 标签，跳过
                    }
                    if (parentContainsItalic(childElement)) {
                        continue;  // 如果元素的父元素是 I 或 EM 标签，跳过
                    }
                    // 递归处理
                    siyuanProcessItalicStyle(childElement);
                }
            }
        }
    });
}

function parentContainsItalic(element) {
    let parent = element.parentElement;
    while (parent) {
        if (parent.tagName === 'I' || parent.tagName === 'EM') {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

function siyuanProcessUnderlineStyle(tempElement) {
    // 获取所有元素
    const allElements = tempElement.querySelectorAll('*');

    allElements.forEach(element => {
        const style = window.getComputedStyle(element);
        if (element.tagName === 'U') {
            return; // 如果元素本身是 <u> 标签，跳过
        }

        if (parentContainsUnderline(element)) {
            return;  // 如果元素的父元素是 U 标签，跳过
        }

        // 判断是否具有 text-decoration: underline
        if (style.textDecorationLine.includes('underline')) {
            // 将 element 中的各个元素使用 <u> 标签包裹
            const children = element.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    // 如果是文本节点，直接包裹在 <u> 标签中
                    const text = child.nodeValue;
                    const textElement = document.createElement('u');
                    textElement.textContent = text;
                    element.replaceChild(textElement, child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // 如果是元素节点，递归处理
                    const childElement = child;
                    const childTagName = childElement.tagName.toLowerCase();
                    if (childTagName === 'u') {
                        continue; // 如果是 <u> 标签，跳过
                    }
                    if (parentContainsUnderline(childElement)) {
                        continue;  // 如果元素的父元素是 U 标签，跳过
                    }
                    // 递归处理
                    siyuanProcessUnderlineStyle(childElement);
                }
            }
        }
    });

    function parentContainsUnderline(element) {
        let parent = element.parentElement;
        while (parent) {
            if (parent.tagName === 'U') {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }
}

function simplifyNestedTags(root, tagName) {
    let elements = root.querySelectorAll(tagName);
    let hasNested = true;

    while (hasNested) {
        hasNested = false;
        elements.forEach(element => {
            if (simplifyElement(element, tagName)) {
                hasNested = true;
            }
        });
        elements = root.querySelectorAll(tagName);
    }

    function simplifyElement(element, tagName) {
        let nestedFound = false;
        if (element.hasChildNodes()) {
            element.childNodes.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    if (child.tagName === tagName) {
                        nestedFound = true;
                        while (child.firstChild) {
                            element.insertBefore(child.firstChild, child);
                        }
                        child.remove();
                    } else {
                        nestedFound = nestedFound || simplifyElement(child, tagName);
                    }
                }
            });
        }
        return nestedFound;
    }
}

// 移除图片链接 https://github.com/siyuan-note/siyuan/issues/13941
function siyuanRemoveImgLink(tempElement) {
    const images = tempElement.querySelectorAll('img');
    images.forEach(image => {
        const parent = image.parentElement;
        if (!parent) {
            return;
        }

        if (parent.tagName === 'A') {
            const grandParent = parent.parentElement;
            if (!grandParent) {
                return;
            }
            grandParent.insertBefore(image, parent);
            parent.remove();
        }
    });
}

// 将 SVG 转换为 Base64 编码的 Data URI https://github.com/siyuan-note/siyuan/issues/14523
// 修复网页内嵌SVG包含非Latin字符导致剪藏报错 https://github.com/siyuan-note/siyuan/issues/14669
async function siyuanSvgToBase64(svgNode) {
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgNode);

    if (!svgStr.startsWith('<?xml')) {
        svgStr = '<?xml version="1.0" encoding="UTF-8"?>' + svgStr;
    }

    const svgBlob = new Blob([svgStr], {type: 'image/svg+xml'});

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(svgBlob);
    });

    return dataUrl; // 返回 base64 编码的 data URL
}

async function siyuanSvgToImg(tempElement) {
    const svgElements = tempElement.querySelectorAll('svg');
    console.log(`Found ${svgElements.length} SVG elements`);

    for (const svg of svgElements) {
        const img = document.createElement('img');
        img.src = await siyuanSvgToBase64(svg);
        img.style.cssText = window.getComputedStyle(svg).cssText;
        svg.parentNode.replaceChild(img, svg);
    }
}


function adaptMSN(tempDoc) {
    if (tempDoc.documentURI.indexOf("msn.cn") !== -1) {
        // 删除掉其他不相关文章
        const articles = document.querySelectorAll(".consumption-page-gridarea_content");
        articles.forEach(article => {
            const shadowHost = article.querySelector("views-header-wc");
            if (!shadowHost) {
                return;
            }
            if (!shadowHost.shadowRoot) {
                return;
            }

            const titleEle = shadowHost.shadowRoot.querySelector("h1");
            if (!titleEle) {
                return;
            }

            if (titleEle.innerText.indexOf(tempDoc.title) === -1) {
                article.remove();
            }
        });

        // 将 Shadow DOM 展开
        const shadowHosts = document.querySelectorAll('cp-article');
        shadowHosts.forEach(element => {
            const shadowRoot = element.shadowRoot;
            if (!shadowRoot) {
                return;
            }

            const slots = shadowRoot.querySelectorAll('slot');
            slots.forEach(slot => {
                const slotName = slot.getAttribute('name');
                element.querySelectorAll(`[slot="${slotName}"]`).forEach(slotElement => {
                    const imgEle = slotElement.querySelector("cp-article-image");
                    if (!imgEle) {
                        return;
                    }
                    const imgShadowRoot = imgEle.shadowRoot;
                    if (!imgShadowRoot) {
                        return;
                    }
                    const imgs = imgShadowRoot.querySelectorAll('img');
                    if (!imgs || imgs.length === 0) {
                        return;
                    }
                    slotElement.innerHTML = ""
                    imgs.forEach(img => {
                        slotElement.appendChild(img.cloneNode(true));
                    });
                    slot.innerHTML = slotElement.innerHTML;
                });
            });

            const shadowContent = shadowRoot.innerHTML;
            const newDiv = document.createElement('div');
            newDiv.innerHTML = shadowContent;
            element.parentNode.replaceChild(newDiv, element);
        });
    }
}

// 重构并合并 Readability 前处理 https://github.com/siyuan-note/siyuan/issues/13306
async function siyuanGetCloneNode(tempDoc) {
    let items;
    try {
        items = await new Promise((resolve, reject) => {
            chrome.storage.sync.get({
                expSpan: false,
                expBold: false,
                expItalic: false,
                expUnderline: false,
                expRemoveImgLink: false,
                expSvgToImg: false,
            }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    } catch (error) {
        console.error("获取失败，错误信息：", error);
        items = {
            expSpan: false,
            expBold: false,
            expItalic: false,
            expUnderline: false,
            expRemoveImgLink: false,
            expSvgToImg: false,
        };
    }

    // 适配 MSN 页面 https://github.com/siyuan-note/siyuan/issues/14197
    adaptMSN(tempDoc);

    if (items.expBold) {
        // 替换粗体样式为内核可识别 <b> 标签 https://github.com/siyuan-note/siyuan/issues/13306
        siyuanProcessBoldStyle(tempDoc);
    }

    if (items.expItalic) {
        // 替换斜体样式为内核可识别 <i> 标签 https://github.com/siyuan-note/siyuan/issues/13306
        siyuanProcessItalicStyle(tempDoc);
    }

    if (items.expUnderline) {
        // 替换下划线样式为内核可识别 <u> 标签
        siyuanProcessUnderlineStyle(tempDoc);
    }

    if (items.expRemoveImgLink) {
        // 移除图片链接 https://github.com/siyuan-note/siyuan/issues/13941
        siyuanRemoveImgLink(tempDoc);
    }

    if (items.expSpan) {
        // 网页换行用 span 样式 word-break 的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
        // 处理会换行的 span 后添加 <br>，让内核能识别到换行
        siyuanSpansAddBr(tempDoc);
    }

    if (items.expSvgToImg) {
        // 将网页内嵌的 SVG 节点转换成内嵌的 IMG 节点
        // https://github.com/siyuan-note/siyuan/issues/14523
        await siyuanSvgToImg(tempDoc);
    }

    // 合并嵌套的标签
    simplifyNestedTags(tempDoc, 'STRONG');
    simplifyNestedTags(tempDoc, 'B');
    simplifyNestedTags(tempDoc, 'I');
    simplifyNestedTags(tempDoc, 'EM');

    // 如果公式被嵌套包裹，则去掉外层包裹 https://github.com/siyuan-note/siyuan/issues/14382
    const mathElements = tempDoc.querySelectorAll('.ztext-math');
    mathElements.forEach(mathElement => {
        if (mathElement.parentElement.tagName === 'B' || mathElement.parentElement.tagName === 'STRONG' || mathElement.parentElement.tagName === 'I' || mathElement.parentElement.tagName === 'EM') {
            const parent = mathElement.parentElement;
            while (parent.firstChild) {
                parent.parentNode.insertBefore(parent.firstChild, parent);
            }
            parent.remove();
        }
    });

    // 如果行级标签包含了块级标签，则将该行级标签改为 div
    const inlineTags = ['span', 'strong', 'b', 'i', 'em', 'a'];
    const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'blockquote', 'pre', 'code', 'section'];
    inlineTags.forEach(inlineTag => {
        const elements = document.querySelectorAll(inlineTag);
        elements.forEach(element => {
            let containsBlock = false;
            blockTags.forEach(blockTag => {
                if (element.querySelector(blockTag)) {
                    containsBlock = true;
                }
            });
            if (containsBlock) {
                const div = document.createElement('div');
                while (element.firstChild) {
                    div.appendChild(element.firstChild);
                }
                element.parentNode.replaceChild(div, element);
            }
        });
    });

    const clonedDoc = document.cloneNode(true);
    return clonedDoc;
}

const siyuanSendUpload = async (tempElement, tabId, srcUrl, type, article, href) => {
    chrome.storage.sync.get({
        ip: 'http://127.0.0.1:6806',
        showTip: true,
        token: '',
        notebook: '',
        parentDoc: '',
        parentHPath: '',
        tags: '',
        assets: true,
        expOpenAfterClip: false,
        expSpan: false,
        expBold: false,
        expItalic: false,
        expUnderline: false,
        expRemoveImgLink: false,
        expListDocTree: false,
        selectedDatabaseID: ''
    }, async function (items) {
        if (!items.token) {
            siyuanShowTipByKey("tip_token_miss")
            return
        }

        if (!items.notebook) {
            siyuanShowTipByKey("tip_save_path_miss")
            return
        }

        let srcList = []
        if (srcUrl) {
            srcList.push(srcUrl)
        }
        const images = tempElement.querySelectorAll('img')
        images.forEach(item => {
            let src = item.getAttribute('src')
            if (!src) {
                return
            }

            if (item.className.includes("emoji") && "" !== item.getAttribute("alt")) {
                // 图片 Emoji 直接使用 alt https://github.com/siyuan-note/siyuan/issues/13342
                return
            }

            // 处理使用 data-original 属性的情况 https://github.com/siyuan-note/siyuan/issues/11826
            let dataOriginal = item.getAttribute('data-original')
            if (dataOriginal && !dataOriginal.startsWith("/")) {
                if (!src || !src.endsWith('.gif')) {
                    src = dataOriginal
                }
            }

            if ('https:' === window.location.protocol) {
                if (src.startsWith('http:')) {
                    src = src.replace('http:', 'https:')
                } else if (src.startsWith('//')) {
                    src = 'https:' + src
                }
                item.setAttribute('src', src)
            }

            if (-1 < item.className.indexOf("ztext-gif") && -1 < src.indexOf("zhimg.com")) {
                // 处理知乎动图
                src = src.replace(".jpg", ".webp")
            }

            srcList.push(src)
        })

        const files = {}
        srcList = [...new Set(srcList)]

        if (!items.assets) { // 不剪藏资源文件 https://github.com/siyuan-note/siyuan/issues/12583
            srcList = []
        }

        let fetchFileErr = false;
        for (let i = 0; i < srcList.length; i++) {
            let src = srcList[i]
            siyuanShowTip(chrome.i18n.getMessage("tip_clip_img") + ' [' + i + '/' + srcList.length + ']...');
            let response;
            try {
                // Wikipedia 使用图片原图 https://github.com/siyuan-note/siyuan/issues/11640
                if (-1 !== src.indexOf('wikipedia/commons/thumb/')) {
                    let idx = src.lastIndexOf('.')
                    let ext = src.substring(idx)
                    if (0 < src.indexOf('.svg.png')) {
                        ext = '.svg'
                    }
                    idx = src.indexOf(ext + '/')
                    if (0 < idx) {
                        src = src.substring(0, idx + ext.length)
                        src = src.replace('/commons/thumb/', '/commons/')
                    }
                }
                response = await fetch(src, {
                    "headers": {
                        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                        "sec-fetch-dest": "image",
                    },
                });
            } catch (e) {
                console.warn("fetch [" + src + "] failed", e)
                fetchFileErr = true;
                continue
            }
            const image = await response.blob()
            files[escape(src)] = {
                type: image.type,
                data: await siyuanConvertBlobToBase64(image),
            }
        }

        let title = article && article.title ? article.title : document.title || "";
        let siteName = article && article.siteName ? article.siteName : "";
        let excerpt = article && article.excerpt ? article.excerpt : "";
        let url = href || window.location.href;

        const msgJSON = {
            fetchFileErr,
            files: files,
            dom: tempElement.innerHTML,
            api: items.ip,
            token: items.token,
            notebook: items.notebook,
            parentDoc: items.parentDoc,
            parentHPath: items.parentHPath.substring(items.parentHPath.indexOf('/')),
            tags: items.tags,
            assets: items.assets,
            tip: items.showTip,
            title: title,
            siteName: siteName,
            excerpt: excerpt,
            listDocTree: items.expListDocTree,
            href: url,
            type,
            tabId,
            selectedDatabaseID: items.selectedDatabaseID,
        };
        chrome.runtime.sendMessage({func: 'upload-copy', data: msgJSON})
    })
}

const siyuanGetReadability = async (tabId) => {
    try {
        siyuanShowTipByKey("tip_clipping", 60 * 1000)
    } catch (e) {
        alert(chrome.i18n.getMessage("tip_first_time"));
        window.location.reload();
        return;
    }

    try {
        // 浏览器剪藏扩展剪藏某些网页代码块丢失注释 https://github.com/siyuan-note/siyuan/issues/5676
        document.querySelectorAll(".hljs-comment").forEach(item => {
            item.classList.remove("hljs-comment")
            item.classList.add("hljs-cmt")
        })

        // 重构并合并 Readability 前处理 https://github.com/siyuan-note/siyuan/issues/13306
        const clonedDoc = await siyuanGetCloneNode(document);

        const article = new Readability(clonedDoc, {
            keepClasses: true,
            charThreshold: 16,
            debug: true
        }).parse()
        const tempElement = document.createElement('div')
        tempElement.innerHTML = article.content
        // console.log(article)
        siyuanSendUpload(tempElement, tabId, undefined, "article", article, window.location.href)
    } catch (e) {
        console.error(e)
        siyuanShowTip(e.message, 7 * 1000)
    }
}

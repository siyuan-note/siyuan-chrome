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

// 网页换行用span样式word-break的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
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
        if(!element) {
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

// 处理会换行的span后添加 <br>，让kernel能识别到换行
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

            const br = document.createElement('br'); // 修正为从 document 创建元素
            br.setAttribute('data-added-by-siyuan', 'true');
            span.parentNode.insertBefore(br, span.nextSibling);

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

// 网页换行用span样式word-break的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
// 移除由 span_add_br 添加的 <br>，还原原有样式
function siyuanSpansDelBr(tempElement) {
    const brs = tempElement.querySelectorAll('br[data-added-by-siyuan="true"]');
    if (!brs || brs.length === 0) {
        return;
    }
    brs.forEach((br) => br.parentNode.removeChild(br));
    console.log(`siyuanSpansDelBr Removed ${brs.length} <br> elements.`);
};

// 替换粗体样式为内核可识别<b>标签 https://github.com/siyuan-note/siyuan/issues/13306
function siyuanProcessBoldStyle(tempElement) {
    // 获取所有应用了 font-weight: bold 的元素
    const boldElements = tempElement.querySelectorAll('*');

    boldElements.forEach(element => {
        const style = window.getComputedStyle(element);

        // 判断是否具有 font-weight: bold
        if (style.fontWeight === 'bold' || style.fontWeight === '700') { // '700' 是 bold 的常见数值
            // 获取当前元素的文本内容
            const innerHTML = element.innerHTML;

            // 将文本内容包裹在 <b> 标签中
            element.innerHTML = `<b b-added-by-siyuan="true">${innerHTML}</b>`;
        }
    });
}

function revertBoldStyles(tempElement) {
    // 获取所有带有 b-added-by-siyuan="true" 的 <b> 标签
    const elements = tempElement.querySelectorAll('b[b-added-by-siyuan="true"]');

    elements.forEach(element => {
        // 获取元素的原始文本内容
        const innerHTML = element.innerHTML;

        // 将 <b> 标签移除，恢复原本的文本
        const parent = element.parentNode;
        parent.innerHTML = parent.innerHTML.replace(element.outerHTML, innerHTML);
    });

    console.log(`revertBoldStyles reverted ${elements.length} <br> elements.`);
}

// 替换斜体样式为内核可识别<i>标签 https://github.com/siyuan-note/siyuan/issues/13306
function siyuanProcessItalicStyle(tempElement) {
    // 获取所有元素
    const allElements = tempElement.querySelectorAll('*');

    allElements.forEach(element => {
        const style = window.getComputedStyle(element);

        // 判断是否具有 font-style: italic
        if (style.fontStyle === 'italic') {
            // 获取当前元素的文本内容
            const innerHTML = element.innerHTML;

            // 将文本内容包裹在 <i> 标签中
            element.innerHTML = `<i i-added-by-siyuan="true">${innerHTML}</i>`;
        }
    });
}

function revertItalicStyles(tempElement) {
    // 获取所有带有 b-added-by-siyuan="true" 的 <b> 标签
    const elements = tempElement.querySelectorAll('i[i-added-by-siyuan="true"]');

    elements.forEach(element => {
        // 获取元素的原始文本内容
        const innerHTML = element.innerHTML;

        // 将 <b> 标签移除，恢复原本的文本
        const parent = element.parentNode;
        parent.innerHTML = parent.innerHTML.replace(element.outerHTML, innerHTML);
    });

    console.log(`revertItalicStyles reverted ${elements.length} <br> elements.`);
}

// 重构并合并Readability前处理 https://github.com/siyuan-note/siyuan/issues/13306
async function siyuanGetCloneNode(tempElement) {
    let items;
    try {
        items = await new Promise((resolve, reject) => {
            chrome.storage.sync.get({
                expSpan: true,
                expBold: false,
                expItalic: false,
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
            expSpan: true,
            expBold: false,
            expItalic: false,
        };
    }

    //前处理，增加可识别样式
    if (items.expBold) {
        // 替换粗体样式为内核可识别<b>标签 https://github.com/siyuan-note/siyuan/issues/13306
        siyuanProcessBoldStyle(tempElement);
    }

    if (items.expItalic) {
        // 替换斜体样式为内核可识别<i>标签 https://github.com/siyuan-note/siyuan/issues/13306
        siyuanProcessItalicStyle(tempElement);
    }

    if (items.expSpan) {
        // 网页换行用span样式word-break的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
        // 处理会换行的span后添加 <br>，让kernel能识别到换行
        siyuanSpansAddBr(tempElement);
    }

    const clonedDoc = document.cloneNode(true);

    //后处理，还原样式
    if (items.expBold) {
        // 还原粗体样式
        revertBoldStyles(tempElement);
    }

    if (items.expItalic) {
        // 还原斜体样式
        revertItalicStyles(tempElement);
    }

    if (items.expSpan) {
        // 网页换行用span样式word-break的特殊处理 https://github.com/siyuan-note/siyuan/issues/13195
        // 处理会换行的span后添加 <br>，让kernel能识别到换行
        siyuanSpansDelBr(tempElement);
    }

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
        expSpan: true,
        expBold: false,
        expItalic: false,
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
            if (dataOriginal) {
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

            if (-1 < item.className.indexOf("ztext-gif") &&  -1 < src.indexOf("zhimg.com")) {
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

        let title = article && article.title ? article.title : "";
        let siteName = article && article.siteName ? article.siteName : "";
        let excerpt = article && article.excerpt ? article.excerpt : "";
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
            href,
            type,
            tabId,
        };
        const jsonStr = JSON.stringify(msgJSON);
        const jsonBlob = new Blob([jsonStr], {type: "application/json"});
        const dataURL = URL.createObjectURL(jsonBlob);
        chrome.runtime.sendMessage({func: 'upload-copy', dataURL: dataURL})
    })
}

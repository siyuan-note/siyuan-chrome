document.addEventListener('DOMContentLoaded', () => {
    const ipElement = document.getElementById('ip')
    const tokenElement = document.getElementById('token')
    const showTipElement = document.getElementById('showTip')
    const searchDocElement = document.getElementById('searchDoc')
    const parentDocElement = document.getElementById('parentDoc')
    const tagsElement = document.getElementById('tags')
    const assetsElement = document.getElementById('assets')
    const expElement = document.getElementById('exp')
    const expGroupElement = document.getElementById('expGroup')
    const expSpanElement = document.getElementById('expSpan')
    const expBoldElement = document.getElementById('expBold')
    const expItalicElement = document.getElementById('expItalic')
    const expRemoveImgLinkElement = document.getElementById('expRemoveImgLink')
    const expListDocTreeElement = document.getElementById('expListDocTree')
    const expSvgToImgElement = document.getElementById('expSvgToImg')
    const languageElement = document.getElementById('language')

    ipElement.addEventListener('change', () => {
        let ip = ipElement.value;
        // 去掉结尾的斜杆 https://github.com/siyuan-note/siyuan/issues/11478
        for (let i = ip.length - 1; i >= 0; i--) {
            if ('/' === ip[i]) {
                ip = ip.substring(0, i)
            } else {
                break
            }
        }
        ipElement.value = ip

        chrome.storage.sync.set({
            ip: ipElement.value,
        })
    })
    tokenElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            token: tokenElement.value,
        })
        updateSearch()
    })
    showTipElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            showTip: showTipElement.checked,
        })
    })
    searchDocElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            searchKey: searchDocElement.value,
        })
        updateSearch()
    })
    parentDocElement.addEventListener('change', () => {
        const selectElement = document.getElementById('parentDoc');
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const notebook = selectedOption.getAttribute('data-notebook');
        const parentDoc = selectedOption.getAttribute('data-parent');

        chrome.storage.sync.set({
            notebook: notebook,
            parentDoc: parentDoc,
            parentHPath: selectedOption.innerText,
        })
    })
    tagsElement.addEventListener('change', () => {
        tagsElement.value = tagsElement.value.replace(/#/g, '')
        chrome.storage.sync.set({
            tags: tagsElement.value,
        })
    })

    // 添加模板配置按钮点击事件
    const templateConfigBtn = document.getElementById('templateConfig')
    if (templateConfigBtn) {
        templateConfigBtn.addEventListener('click', () => {
            // 打开模板配置弹窗
            const templateModal = document.getElementById('templateModal')
            if (templateModal) {
                templateModal.style.display = 'block'
            }
        })
    }

    // 添加模板保存按钮事件
    const saveTemplateBtn = document.getElementById('saveTemplate')
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => {
            const templateText = document.getElementById('templateText').value
            chrome.storage.sync.set({
                clipTemplate: templateText,
            }, () => {
                const templateModal = document.getElementById('templateModal')
                if (templateModal) {
                    templateModal.style.display = 'none'

                    // 显示保存成功提示
                    const templateSavedMsg = document.getElementById('templateSavedMsg')
                    if (templateSavedMsg) {
                        templateSavedMsg.style.display = 'block'
                        setTimeout(() => {
                            templateSavedMsg.style.display = 'none'
                        }, 2000)
                    }
                }
            })
        })
    }

    // 添加模板取消按钮事件
    const cancelTemplateBtn = document.getElementById('cancelTemplate')
    if (cancelTemplateBtn) {
        cancelTemplateBtn.addEventListener('click', () => {
            const templateModal = document.getElementById('templateModal')
            if (templateModal) {
                templateModal.style.display = 'none'
            }
        })
    }

    // 添加关闭模板配置弹窗按钮事件
    const closeTemplateBtn = document.getElementById('closeTemplate')
    if (closeTemplateBtn) {
        closeTemplateBtn.addEventListener('click', () => {
            const templateModal = document.getElementById('templateModal')
            if (templateModal) {
                templateModal.style.display = 'none'
            }
        })
    }

    assetsElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            assets: assetsElement.checked,
        })
    })
    expSpanElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expSpan: expSpanElement.checked,
        })
    })
    expBoldElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expBold: expBoldElement.checked,
        })
    })
    expItalicElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expItalic: expItalicElement.checked,
        })
    })
    expRemoveImgLinkElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expRemoveImgLink: expRemoveImgLinkElement.checked,
        })
    })
    expListDocTreeElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expListDocTree: expListDocTreeElement.checked,
        })
    })
    expSvgToImgElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            expSvgToImg: expSvgToImgElement.checked,
        })
    })
    expElement.addEventListener('change', function () {
        if (expElement.checked) {
            expGroupElement.style.display = 'block';
        } else {
            expGroupElement.style.display = 'none';
        }
    });
    languageElement.addEventListener('change', () => {
        const langCode = languageElement.value;
        console.log("langCode=" + langCode);

        siyuanLoadLanguageFile(langCode, (data) => {
            siyuanTranslateDOM(data);
        });
        chrome.storage.sync.set({
            langCode: langCode,
        })
    })

    const eyeElement = document.querySelector('.b3-icon')
    eyeElement.addEventListener('click', () => {
        if (tokenElement.getAttribute("type") === "password") {
            tokenElement.setAttribute("type", "text")
            eyeElement.innerHTML = '<path d="M21.418 17.655l-1.6-1.6q0.945-2.582-0.982-4.291t-4.182-0.873l-1.6-1.6q0.618-0.4 1.382-0.582t1.564-0.182q2.582 0 4.382 1.8t1.8 4.382q0 0.8-0.2 1.582t-0.564 1.364zM26.109 22.346l-1.455-1.455q1.782-1.309 3.109-2.927t1.945-3.255q-1.818-4.036-5.455-6.382t-7.891-2.345q-1.527 0-3.127 0.291t-2.509 0.691l-1.673-1.709q1.273-0.582 3.255-1.018t3.873-0.436q5.2 0 9.509 2.964t6.309 7.945q-0.945 2.327-2.436 4.255t-3.455 3.382zM28.218 30.564l-6.109-6q-1.273 0.509-2.873 0.782t-3.236 0.273q-5.309 0-9.636-2.964t-6.364-7.945q0.727-1.891 2.018-3.691t3.145-3.436l-4.582-4.582 1.527-1.564 27.527 27.527zM6.655 9.109q-1.345 0.982-2.6 2.582t-1.8 3.018q1.855 4.036 5.582 6.382t8.455 2.345q1.2 0 2.364-0.145t1.745-0.436l-2.327-2.327q-0.4 0.182-0.982 0.273t-1.091 0.091q-2.545 0-4.364-1.782t-1.818-4.4q0-0.545 0.091-1.091t0.273-0.982z"></path>'
        } else {
            tokenElement.setAttribute("type", "password")
            eyeElement.innerHTML = '<path d="M16 22.182q2.582 0 4.382-1.8t1.8-4.382-1.8-4.382-4.382-1.8-4.382 1.8-1.8 4.382 1.8 4.382 4.382 1.8zM16 20.073q-1.709 0-2.891-1.182t-1.182-2.891 1.182-2.891 2.891-1.182 2.891 1.182 1.182 2.891-1.182 2.891-2.891 1.182zM16 26.909q-5.309 0-9.6-3.018t-6.4-7.891q2.109-4.873 6.4-7.891t9.6-3.018 9.6 3.018 6.4 7.891q-2.109 4.873-6.4 7.891t-9.6 3.018zM16 24.727q4.4 0 8.091-2.382t5.618-6.345q-1.927-3.964-5.618-6.345t-8.091-2.382-8.091 2.382-5.655 6.345q1.964 3.964 5.655 6.345t8.091 2.382z"></path>'
        }
    })

    const sendElement = document.getElementById('send')
    sendElement.addEventListener('click', () => {
        chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: siyuanGetReadability,
                args: [tabs[0].id],
            }, function () {
                window.close();
            })
        });
    })

    chrome.storage.sync.get({
        langCode: siyuanGetDefaultLangCode(),
        ip: 'http://127.0.0.1:6806',
        showTip: true,
        token: '',
        searchKey: '',
        notebook: '',
        parentDoc: '',
        parentHPath: '',
        tags: '',
        assets: true,
        expSpan: false,
        expBold: false,
        expItalic: false,
        expRemoveImgLink: false,
        expListDocTree: false,
        expSvgToImg: false,
        clipTemplate: '---\n\n- ${title}${siteName ? " - " + siteName : ""}\n- [${urlDecoded}](${url}) \n- ${excerpt}\n- ${date} ${time}\n\n---\n\n${content}',
    }, async function (items) {
        siyuanLoadLanguageFile(items.langCode, (data) => {
            siyuanTranslateDOM(data); // 在这里使用加载的i18n数据
            languageElement.value = items.langCode;

            // 更新模板文本框的值
            const templateText = document.getElementById('templateText')
            if (templateText) {
                templateText.value = items.clipTemplate

                // 添加模板变量帮助提示
                const templateHelp = document.getElementById('templateHelp')
                if (templateHelp) {
                    templateHelp.innerHTML = data.template_help ? data.template_help.message : ''
                }
            }
        });
        ipElement.value = items.ip || 'http://127.0.0.1:6806'
        tokenElement.value = items.token || ''
        showTipElement.checked = items.showTip
        searchDocElement.value = items.searchKey || ''
        parentDocElement.setAttribute("data-notebook", items.notebook)
        parentDocElement.setAttribute("data-parent", items.parentDoc)
        parentDocElement.setAttribute("data-parenthpath", items.parentHPath)
        tagsElement.value = items.tags || ''
        assetsElement.checked = items.assets
        expSpanElement.checked = items.expSpan
        expBoldElement.checked = items.expBold
        expItalicElement.checked = items.expItalic
        expRemoveImgLinkElement.checked = items.expRemoveImgLink
        expListDocTreeElement.checked = items.expListDocTree
        expSvgToImgElement.checked = items.expSvgToImg
        updateSearch()
    })
})

const updateSearch = () => {
    const ipElement = document.getElementById('ip')
    const tokenElement = document.getElementById('token')
    const searchDocElement = document.getElementById('searchDoc')
    const parentDocElement = document.getElementById('parentDoc')

    fetch(ipElement.value + '/api/filetree/searchDocs', {
        method: 'POST',
        redirect: "manual",
        headers: {
            'Authorization': 'Token ' + tokenElement.value,
        },
        body: JSON.stringify({
            "k": searchDocElement.value,
            "flashcard": false
        })
    }).then((response) => {
        if (response.status !== 200) {
            document.getElementById('log').innerHTML = "Authentication failed, please check API token"
            return
        }

        document.getElementById('log').innerHTML = ""
        return response.json()
    }).then((response) => {
        if (0 !== response.code) {
            document.getElementById('log').innerHTML = "Search docs failed"
            return
        }

        let optionsHTML = ''
        response.data.forEach(doc => {
            const parentDoc = doc.path.substring(doc.path.toString().lastIndexOf('/') + 1).replace(".sy", '')
            let selected = ""
            if (parentDocElement.dataset.notebook === doc.box && parentDocElement.dataset.parent === parentDoc &&
                parentDocElement.dataset.parenthpath === doc.hPath) {
                selected = "selected";
            }
            optionsHTML += `<option ${selected} data-notebook="${doc.box}" data-parent="${parentDoc}">${escapeHtml(doc.hPath)}</option>`
        })
        parentDocElement.innerHTML = optionsHTML

        if (parentDocElement.selectedOptions && parentDocElement.selectedOptions.length > 0) {
            let selected = parentDocElement.querySelector('option[selected]')
            if (!selected) {
                selected = parentDocElement.selectedOptions[0]
                chrome.storage.sync.set({
                    notebook: selected.getAttribute("data-notebook"),
                    parentDoc: selected.getAttribute("data-parent"),
                    parentHPath: selected.innerText,
                })
            }
        } else {
            chrome.storage.sync.set({
                notebook: '',
                parentDoc: '',
                parentHPath: ''
            })
        }
    })
}

const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

// Add i18n support https://github.com/siyuan-note/siyuan/issues/13559
let siyuanLangData = null;
let siyuanLangCode = null;

function siyuanGetDefaultLangCode() {
    const langCode = navigator.language || navigator.userLanguage || chrome.runtime.getManifest().default_locale;
    const normalizedLangCode = langCode.replace('-', '_');
    return normalizedLangCode;
}

// 合并当前语言和英语（en）翻译的函数
async function siyuanMergeTranslations(translations, langCode) {
    // 默认语言是英语（en）
    const defaultLangCode = 'en';

    // 加载英语（en）翻译文件
    let defaultTranslations = {};

    // 如果当前语言不是英语，则加载英语翻译文件
    if (langCode !== defaultLangCode) {
        const enTranslationFile = chrome.runtime.getURL(`_locales/${langCode}/messages.json`);
        try {
            // 异步加载英语翻译文件
            const response = await fetch(enTranslationFile);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const enData = await response.json(); // 解析JSON
            defaultTranslations = enData; // 保存英语翻译数据
        } catch (err) {
            console.error("Failed to load English translation:", err);
        }
    }

    // 合并当前语言翻译和英语翻译，缺失的字段使用英语翻译
    const merged = { ...defaultTranslations, ...translations };
    return merged;
}

async function siyuanLoadLanguageFile(langCode, callback) {
    // 检查是否已经加载过数据
    if (siyuanLangData && siyuanLangCode === langCode) {
        // 如果已经加载，直接调用回调并传递数据
        callback(siyuanLangData);
        return;
    }

    // 先加载当前语言的翻译文件
    try {
        const translationFile = chrome.runtime.getURL(`_locales/${langCode}/messages.json`);
        const response = await fetch(translationFile);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json(); // 解析JSON

        // 加载成功，检查并补充缺失的翻译
        // 先把加载的翻译数据保存在全局变量中
        const mergedData = await siyuanMergeTranslations(data, langCode); // 等待合并翻译
        siyuanLangData = mergedData;
        siyuanLangCode = langCode;

        // 调用回调并传递数据
        callback(mergedData);

    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
}

function siyuanTranslateDOM(translations) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (!translations[key] || !translations[key].message) {
            console.warn(`siyuanTranslateDOM Missing translation for key: ${key}`);
            return;
        }

        const translation = translations[key].message;
        if (element.placeholder !== undefined) {
            // 翻译 placeholder 属性
            element.placeholder = translation;
        } else {
            // 翻译 textContent
            element.textContent = translation;
        }
    });

    // 确保模板帮助文本也被更新
    const templateHelp = document.getElementById('templateHelp');
    if (templateHelp && translations.template_help) {
        templateHelp.innerHTML = translations.template_help.message;
    }
}

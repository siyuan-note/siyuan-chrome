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
    expElement.addEventListener('change', function () {
        if (expElement.checked) {
            expGroupElement.style.display = 'block';
        } else {
            expGroupElement.style.display = 'none';
        }
    });

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
        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: siyuanGetReadability,
                args: [tabs[0].id],
            }, function () {
                window.close();
            })
        });
    })

    chrome.storage.sync.get({
        ip: 'http://127.0.0.1:6806',
        showTip: true,
        token: '',
        searchKey: '',
        notebook: '',
        parentDoc: '',
        parentHPath: '',
        tags: '',
        assets: true,
        expSpan: true,
        expBold: false,
        expItalic: false,
    }, function (items) {
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
            document.getElementById('log').innerHTML = "Authentication failed"
        } else {
            document.getElementById('log').innerHTML = ""
        }
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
        siyuanShowTip('Clipping, please wait a moment...', 60 * 1000)
    } catch (e) {
        alert("After installing the SiYuan extension for the first time, please refresh the page before using it")
        window.location.reload()
        return
    }

    try {
        // 浏览器剪藏扩展剪藏某些网页代码块丢失注释 https://github.com/siyuan-note/siyuan/issues/5676
        document.querySelectorAll(".hljs-comment").forEach(item => {
            item.classList.remove("hljs-comment")
            item.classList.add("hljs-cmt")
        })

        // 重构并合并Readability前处理 https://github.com/siyuan-note/siyuan/issues/13306
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
        siyuanClearTip()
    } catch (e) {
        console.error(e)
        siyuanShowTip(e.message, 7 * 1000)
    }
}

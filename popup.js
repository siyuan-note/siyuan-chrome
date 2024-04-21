document.addEventListener('DOMContentLoaded', () => {
    const ipElement = document.getElementById('ip')
    const tokenElement = document.getElementById('token')
    const showTipElement = document.getElementById('showTip')
    const notebooksElement = document.getElementById('notebooks')
    ipElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            ip: ipElement.value,
        })
    })
    tokenElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            token: tokenElement.value,
        })
        getNotebooks(ipElement, tokenElement, notebooksElement)
    })
    showTipElement.addEventListener('change', () => {
        chrome.storage.sync.set({
            showTip: showTipElement.checked,
        })
    })
    notebooksElement.addEventListener('change', () => {
        notebooksElement.setAttribute("data-id", notebooksElement.value)
        chrome.storage.sync.set({
            notebook: notebooksElement.value,
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
        notebook: '',
    }, function (items) {
        ipElement.value = items.ip || 'http://127.0.0.1:6806'
        tokenElement.value = items.token || ''
        showTipElement.checked = items.showTip
        notebooksElement.setAttribute("data-id", items.notebook)
        getNotebooks(ipElement, tokenElement, notebooksElement)
    })
})

const getNotebooks = (ipElement, tokenElement, notebooksElement) => {
    fetch(ipElement.value + '/api/notebook/lsNotebooks', {
        method: 'POST',
        redirect: "manual",
        headers: {
            'Authorization': 'Token ' + tokenElement.value,
        },
        body: JSON.stringify({"flashcard": false})
    }).then((response) => {
        if (response.status !== 200) {
            document.getElementById('log').innerHTML = "Authentication failed"
        } else {
            document.getElementById('log').innerHTML = ""
        }
        return response.json()
    }).then((response) => {
        if (response.code === 0) {
            if (!response.data.notebooks) {
                document.getElementById('log').innerHTML = "Please upgrade SiYuan to v1.3.5 or above"
                return
            }

            if (response.data.notebooks.length > 0) {
                let optionsHTML = ''
                response.data.notebooks.forEach(notebook => {
                    if (notebook.closed) {
                        return
                    }

                    optionsHTML += `<option value="${notebook.id}">${escapeHtml(notebook.name)}</option>`
                })
                notebooksElement.innerHTML = optionsHTML
                notebooksElement.value = notebooksElement.getAttribute("data-id")

                chrome.storage.sync.set({
                    notebook: notebooksElement.value,
                })
            } else {
                document.getElementById('log').innerHTML = "Please create a notebook before"
            }
        } else {
            document.getElementById('log').innerHTML = "Get notebooks failed"
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

const siyuanGetReadability = (tabId) => {
    try {
        siyuanShowTip('Clipping, please wait a moment...', 60 * 1000)
    } catch (e) {
        alert("After installing the SiYuan extension for the first time, please refresh the page before using it")
        window.location.reload()
        return
    }

    window.scrollTo(0, document.body.scrollHeight);
    scrollTo1(() => {
        toggle = false
        clearInterval(scrollTimer)
        window.scrollTo(0, 0);
        try {
            // 浏览器剪藏扩展剪藏某些网页代码块丢失注释 https://github.com/siyuan-note/siyuan/issues/5676
            document.querySelectorAll(".hljs-comment").forEach(item => {
                item.classList.remove("hljs-comment")
                item.classList.add("hljs-cmt")
            })

            const article = new Readability(document.cloneNode(true), {keepClasses: true,}).parse()
            const tempElement = document.createElement('div')
            tempElement.innerHTML = article.content
            // console.log(article)
            siyuanSendUpload(tempElement, tabId, undefined, "article", article, window.location.href)
            siyuanClearTip()
        } catch (e) {
            console.error(e)
            siyuanShowTip(e.message, 7 * 1000)
        }
    })
}

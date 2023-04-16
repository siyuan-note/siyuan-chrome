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
          optionsHTML += `<option value="${notebook.id}">${notebook.name}</option>`
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

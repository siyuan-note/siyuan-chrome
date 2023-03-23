document.addEventListener('DOMContentLoaded', () => {
  const ipElement = document.getElementById('ip')
  const tokenElement = document.getElementById('token')
  const showTipElement = document.getElementById('showTip')
  const notebooksElement = document.getElementById('notebooks')
  const tagPrefixElement = document.getElementById('tagPrefix')
  const tagsElement = document.getElementById('tags')
  const tagEnableElement = document.getElementById('tagEnable')
  const addTagElement = document.getElementById('addTag')
  const tagToPathElement = document.getElementById('tagToPath')
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
    getTags(ipElement, tokenElement, tagEnableElement, tagsElement, tagPrefixElement)
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
  tagEnableElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      tagEnable: tagEnableElement.checked,
    })
    tagGroupDisplay(tagEnableElement)
    getTags(ipElement, tokenElement, tagEnableElement, tagsElement, tagPrefixElement)
  })
  tagPrefixElement.addEventListener('change', () => {
    tagPrefixElement.setAttribute("data-id", tagPrefixElement.value)
    chrome.storage.sync.set({
      tagPrefix: tagPrefixElement.value,
    })
    getTags(ipElement, tokenElement, tagEnableElement, tagsElement, tagPrefixElement)
  })
  tagsElement.addEventListener('change', () => {
    tagsElement.setAttribute("data-id", tagsElement.value)
    chrome.storage.sync.set({
      tags: tagsElement.value,
    })
  })
  addTagElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      addTag: addTagElement.checked,
    })
  })
  tagToPathElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      tagToPath: tagToPathElement.checked,
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
    tagEnable: false,
    tags: '',
    tagPrefix: '',
    addTag: false,
    tagToPath: false,
  }, function (items) {
    ipElement.value = items.ip || 'http://127.0.0.1:6806'
    tokenElement.value = items.token || ''
    showTipElement.checked = items.showTip
    notebooksElement.setAttribute("data-id", items.notebook)
    tagEnableElement.checked = items.tagEnable
    tagPrefixElement.value = items.tagPrefix || ''
    tagsElement.setAttribute("data-id", items.tags)
    addTagElement.checked = items.addTag
    tagToPathElement.checked = items.tagToPath
    getNotebooks(ipElement, tokenElement, notebooksElement)
    getTags(ipElement, tokenElement, tagEnableElement, tagsElement, tagPrefixElement)
    tagGroupDisplay(tagEnableElement)
  })
})

const getNotebooks = (ipElement, tokenElement, notebooksElement) => {
  fetch(ipElement.value + '/api/notebook/lsNotebooks', {
    method: 'POST',
    redirect: "manual",
    headers: {
      'Authorization': 'Token ' + tokenElement.value,
    },
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

const tagGroupDisplay = (tagEnableElement) => {
  if(tagEnableElement.checked) {
    document.getElementById('tagGroup').style.display = 'inline'
  }else{
    document.getElementById('tagGroup').style.display = 'none'
  }
}
const getTags = (ipElement, tokenElement, tagEnableElement, tagsElement, tagPrefixElement) => {
  if(!tagEnableElement.checked) {
    return   
  }
  fetch(ipElement.value + '/api/tag/getTag', {
    method: 'POST',
    redirect: "manual",
    headers: {
      'Authorization': 'Token ' + tokenElement.value,
      "Content-Typent": 'application/json',
    },
    body: '{}',
  }).then((response) => {
    if (response.status !== 200) {
      document.getElementById('log').innerHTML = "Authentication failed"
    } else {
      document.getElementById('log').innerHTML = ""
    }
    return response.json()
  }).then((response) => {
    if (response.code === 0) {
      if (!response.data) {
        document.getElementById('log').innerHTML = "Please upgrade SiYuan to v1.3.5 or above"
        return
      }

      if (response.data.length > 0) {
        let optionsHTML = `<option value="">--choose tags--</option>`    // 增加一个空行用来表示不需要标签
        function addLeafTag(obj) {
          if(obj.length == 0) {
            return
          }
          obj.forEach(sub => {
            if (sub.type != 'tag') {
              return
            }
            if (!sub.children || sub.children == null) {
              if(sub.label.startsWith(tagPrefixElement.value)) {
                sub.label = sub.label.replace(new RegExp("^"+tagPrefixElement.value), "");     // 去除前缀
                optionsHTML += `<option value="${sub.label}">${sub.label}</option>` 
              }
            }else{
              addLeafTag(sub.children)
            }
          })
        }
        addLeafTag(response.data)

        tagsElement.innerHTML = optionsHTML
        tagsElement.value = tagsElement.getAttribute("data-id")

        chrome.storage.sync.set({
          tags: tagsElement.value,
        })
      } 
    } else {
      document.getElementById('log').innerHTML = response.msg
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

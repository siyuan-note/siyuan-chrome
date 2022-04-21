chrome.contextMenus.removeAll(function () {
  chrome.contextMenus.create({
    title: 'Copy to SiYuan',
    contexts: ['selection', 'image'],
    onclick: function (info, tab) {
      chrome.tabs.sendMessage(tab.id, {
        'func': 'copy',
        'tabId': tab.id,
        'srcUrl': info.srcUrl,
      })
    },
  })
})

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    let existAllowOrigin = false
    for (let i = 0; i < details.responseHeaders.length; i++) {
      if ('access-control-allow-origin' ===
        details.responseHeaders[i].name.toLowerCase()) {
        existAllowOrigin = true
        break
      }
    }

    if (!existAllowOrigin) {
      const cors = {name: 'Access-Control-Allow-Origin', value: '*'}
      return {responseHeaders: details.responseHeaders.concat(cors)}
    }
    return {responseHeaders: details.responseHeaders}
  },
  {
    urls: ['*://*/*'],
  },
  ['blocking', 'responseHeaders', 'extraHeaders'],
)

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.func !== 'upload-copy') {
    return
  }

  const jsonBlob = await fetch(request.dataURL).then(r => r.blob())
  const requestData = JSON.parse(await jsonBlob.text())
  const dom = requestData.dom
  const files = requestData.files
  const formData = new FormData()
  formData.append('dom', dom)
  for (const key of Object.keys(files)) {
    const data = files[key].data
    const base64Response = await fetch(data)
    const blob = base64Response.blob()
    formData.append(key, await blob)
  }
  formData.append("notebook", requestData.notebook)

  fetch(requestData.api + '/api/extension/copy', {
    method: 'POST',
    headers: {
      'Authorization': 'Token ' + requestData.token,
    },
    body: formData,
  }).then((response) => {
    if (response.redirected) {
      chrome.tabs.sendMessage(requestData.tabId, {
        'func': 'tip',
        'msg': 'Invalid API token',
        'tip': 'tip',
      })
    }
    return response.json()
  }).then((response) => {
    if (response.code < 0) {
      chrome.tabs.sendMessage(requestData.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': requestData.tip,
      })
      return
    }

    chrome.tabs.sendMessage(requestData.tabId, {
      'func': 'copy2Clipboard',
      'data': response.data.md,
    })

    if ('' !== response.msg && requestData.type !== 'article') {
      chrome.tabs.sendMessage(requestData.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': requestData.tip,
      })
    }

    if (requestData.type === 'article') {
      let title = requestData.title ? ('/' + requestData.title) : 'Untitled'
      title = title.replaceAll("/", "")
      const siteName = requestData.siteName
      const excerpt = requestData.excerpt
      const href = requestData.href
      let linkText = href
      if ("" !== siteName) {
        linkText += " - " + siteName
      }
      let markdown = "---\n\n* " + "[" + linkText + "](" + href + ")\n"
      if ("" !== excerpt) {
        markdown += "* " + excerpt + "\n"
      } else {
        markdown += "\n"
      }
      markdown += "* " + getDateTime() + "\n\n---\n\n" + response.data.md

      fetch(requestData.api + '/api/filetree/createDocWithMd', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + requestData.token,
        },
        body: JSON.stringify({
          'notebook': requestData.notebook,
          'path': title,
          'markdown': markdown,
        }),
      }).then((response) => {
        return response.json()
      }).then((response) => {
        if (0 === response.code) {
          chrome.tabs.sendMessage(requestData.tabId, {
            'func': 'tip',
            'msg': "Create article successfully",
            'tip': requestData.tip,
          })
        } else {
          chrome.tabs.sendMessage(requestData.tabId, {
            'func': 'tip',
            'msg': response.msg,
            'tip': requestData.tip,
          })
        }
      })
    }
  }).catch((e) => {
    console.warn(e)
  })
})

function getDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let hour = now.getHours();
  let minute = now.getMinutes();
  let second = now.getSeconds();
  if (month.toString().length === 1) {
    month = '0' + month;
  }
  if (day.toString().length === 1) {
    day = '0' + day;
  }
  if (hour.toString().length === 1) {
    hour = '0' + hour;
  }
  if (minute.toString().length === 1) {
    minute = '0' + minute;
  }
  if (second.toString().length === 1) {
    second = '0' + second;
  }
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
}
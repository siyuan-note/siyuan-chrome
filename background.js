chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    title: 'Copy to SiYuan',
    contexts: ['selection', 'image'],
    onclick: siyuan,
  })
})

function siyuan (info, tab) {
  chrome.tabs.sendMessage(tab.id, {
    'func': 'copy',
    'tabId': tab.id,
    'srcUrl': info.srcUrl,
  })
}

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
  console.log('background', request.func)
  if (request.func !== 'upload-copy') {
    return
  }

  const dom = request.dom
  const files = request.files
  const formData = new FormData()
  formData.append('dom', dom)
  for (const key of Object.keys(files)) {
    const data = files[key].data
    const base64Response = await fetch(data)
    const blob = base64Response.blob()
    formData.append(key, await blob)
  }
  fetch(request.api + '/api/extension/copy', {
    method: 'POST',
    headers: {
      'Authorization': 'Token ' + request.token,
    },
    body: formData,
  }).then((response) => {
    return response.json()
  }).then((response) => {
    if (response.code < 0) {
      chrome.tabs.sendMessage(request.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': request.tip,
      })
      return
    }

    chrome.tabs.sendMessage(request.tabId, {
      'func': 'copy2Clipboard',
      'data': response.data.md,
    })

    if ('' !== response.msg) {
      chrome.tabs.sendMessage(request.tabId, {
        'func': 'tip',
        'msg': response.msg,
        'tip': request.tip,
      })
    }
  }).catch((e) => {
    console.warn('fetch post error', e)
  })
})

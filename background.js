chrome.contextMenus.create({
  title: 'Copy to SiYuan',
  contexts: ['selection', 'image'],
  onclick: siyuan,
})

function siyuan (info, tab) {
  chrome.tabs.sendMessage(tab.id, {
    'func': 'copy',
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

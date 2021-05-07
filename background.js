chrome.contextMenus.create({
  title: "Copy to SiYuan",
  contexts: ["selection", "image"],
  onclick: siyuan,
});

function siyuan(info, tab) {
  chrome.tabs.sendMessage(tab.id, {"func": "copy", "srcUrl": info.srcUrl});
}

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    const cors = {name: "access-control-allow-origin", value: "*"};
    const responseHeaders = details.responseHeaders.concat(cors);
    return {responseHeaders};
  },
  {
    urls: ["*://*/*"],
  },
  ["blocking", "responseHeaders", "extraHeaders"]
);
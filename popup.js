document.addEventListener('DOMContentLoaded', () => {
  const ipElement = document.getElementById('ip')
  const tokenElement = document.getElementById('token')
  const showTipElement = document.getElementById('showTip')
  ipElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      ip: ipElement.value,
    })
  })
  tokenElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      token: tokenElement.value,
    })
  })
  showTipElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      showTip: showTipElement.checked,
    })
  })

  chrome.storage.sync.get({
    ip: 'http://127.0.0.1:6806',
    showTip: true,
    token: "",
  }, function (items) {
    ipElement.value = items.ip || 'http://127.0.0.1:6806'
    tokenElement.value = items.token || ""
    showTipElement.checked = items.showTip
  })
})

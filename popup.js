document.addEventListener('DOMContentLoaded', () => {
  const ipElement = document.getElementById('ip')
  const showTipElement = document.getElementById('showTip')
  ipElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      ip: ipElement.value,
    })
  })
  showTipElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      showTip: showTipElement.checked,
    })
  })

  chrome.storage.sync.get({
    ip: 'http://127.0.0.1:68061',
    showTip: true,
  }, function (items) {
    ipElement.value = items.ip || 'http://127.0.0.1:68061'
    showTipElement.checked = items.showTip
  })
})

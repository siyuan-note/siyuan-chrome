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
  })
  showTipElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      showTip: showTipElement.checked,
    })
  })
  notebooksElement.addEventListener('change', () => {
    chrome.storage.sync.set({
      notebook: notebooksElement.value,
    })
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

    fetch(ipElement.value + '/api/notebook/lsNotebooks', {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + tokenElement.value,
      },
    }).then((response) => {
      return response.json()
    }).then((response) => {
      if (response.code === 0 && response.data.files.length > 0) {
        let optionsHTML = ''
        response.data.files.forEach(file => {
          optionsHTML = `<option value="${file}">${file}</option>`
        })
        notebooksElement.value = items.notebook
        notebooksElement.innerHTML = optionsHTML
      }
    }).catch((e) => {
      console.warn(e)
    })
  })
})

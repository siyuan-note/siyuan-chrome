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
    chrome.storage.sync.set({
      notebook: notebooksElement.value,
    })
  })

  const sendElement = document.getElementById('send')
  sendElement.addEventListener('click', () => {
    chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
      chrome.tabs.executeScript(null, {
        code: `siyuanGetReadability(${tabs[0].id})`
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
  }).then((response) => {
    if (response.status !== 200) {
      document.getElementById('log').innerHTML = "Authentication failed"
    } else {
      document.getElementById('log').innerHTML = ""
    }
    return response.json()
  }).then((response) => {
    if (response.code === 0 && response.data.notebooks.length > 0) {
      let optionsHTML = ''
      response.data.notebooks.forEach(notebook => {
        if (notebook.closed) {
          return
        }
        optionsHTML += `<option value="${notebook.id}">${notebook.name}</option>`
      })
      notebooksElement.value = tokenElement.value
      notebooksElement.innerHTML = optionsHTML

      chrome.storage.sync.set({
        notebook: notebooksElement.value,
      })
    }
  })
}

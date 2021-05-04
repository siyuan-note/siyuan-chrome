chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.func !== 'copy') {
    return
  }
  const tempElement = document.createElement('div')
  tempElement.appendChild(
    window.getSelection().getRangeAt(0).cloneContents())

  const formData = new FormData()
  formData.append('dom', tempElement.innerHTML)
  tempElement.querySelectorAll('img').forEach((item) => {
    fetch(item.getAttribute('src')).
      then(response => response.blob()).
      then(image => {
        formData.append('file[]', image)
      })
  })

  fetch('http://127.0.0.1:6806/api/extension/copy', {
    method: 'POST',
    body: formData,
  }).then((response) => {
    return response.json()
  }).then((response) => {
    if (response.code < 0) {
      alert(response.msg)
    } else {
      alert('copy success')
    }
    console.log(response)
  }).catch((e) => {
    console.warn('fetch post error', e)
  })
})

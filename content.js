chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.func !== 'copy') {
    return
  }

  let srcList = []
  if (request.srcUrl) {
    srcList.push(request.srcUrl)
  }

  const selection = window.getSelection()
  let dom = ""
  if (selection && 0 < selection.rangeCount) {
    const range = selection.getRangeAt(0)
    const tempElement = document.createElement('div')
    tempElement.appendChild(range.cloneContents())
    dom = tempElement.innerHTML
    const images = tempElement.querySelectorAll('img')
    images.forEach(item => {
      srcList.push(item.getAttribute('src'))
    })
  }

  const formData = new FormData()
  formData.append('dom', dom)

  srcList = [...new Set(srcList)];
  for (let i = 0; i < srcList.length; i++) {
    const src = srcList[i]
    const response = await fetch(src)
    const image = await response.blob()
    formData.append(escape(src), image)
  }

  fetch('http://127.0.0.1:6806/api/extension/copy', {
    method: 'POST',
    body: formData,
  }).then((response) => {
    return response.json()
  }).then((response) => {
    if (response.code < 0) {
      alert(response.msg)
    } else {
      navigator.clipboard.writeText(response.data.md);
    }
  }).catch((e) => {
    console.warn('fetch post error', e)
  })
})

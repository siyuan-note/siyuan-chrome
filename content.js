chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.func !== 'copy') {
    return
  }

  const tempElement = document.createElement('div')
  tempElement.appendChild(window.getSelection().getRangeAt(0).cloneContents())

  const formData = new FormData()
  formData.append('dom', tempElement.innerHTML)

  const images = tempElement.querySelectorAll('img')
  let srcList = []
  images.forEach(item => {
    srcList.push(item.getAttribute('src'))
  })
  srcList.push(request.srcUrl)
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
    console.log(response)
  }).catch((e) => {
    console.warn('fetch post error', e)
  })
})

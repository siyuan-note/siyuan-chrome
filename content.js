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

  const isHTTPS = "https:" === window.location.protocol
  srcList = [...new Set(srcList)];
  for (let i = 0; i < srcList.length; i++) {
    let src = srcList[i]
    if (isHTTPS && src.startsWith("http:")) {
      src = src.replace("http:", "https:")
    }
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
      copyToClipboard(response.data.md).catch(() => console.log('error'));
    }
  }).catch((e) => {
    console.warn('fetch post error', e)
  })
})

function copyToClipboard(textToCopy) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(textToCopy);
  }

  let textArea = document.createElement("textarea");
  textArea.value = textToCopy;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  return new Promise((res, rej) => {
    document.execCommand('copy') ? res() : rej();
    textArea.remove();
  });
}
// on copy event, send a message to background.html
function onCopy(e) {
    chrome.extension.sendRequest({event: "copy"});
}

//register event listener for copy events on document
document.addEventListener('copy',onCopy,true);
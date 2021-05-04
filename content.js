chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.func) {
        case "copy":
            const selection = window.getSelection()
            console.log(selection.getRangeAt(0).cloneContents())
            break
    }
});

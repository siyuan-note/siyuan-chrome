chrome.extension.onRequest.addListener(
    function (request, sender, sendResponse) {
        if (request.event === "copy") {


            bg = chrome.extension.getBackgroundPage();        // get the background page
            bg.document.body.innerHTML = "";                   // clear the background page

            // add a DIV, contentEditable=true, to accept the paste action
            var helperdiv = bg.document.createElement("div");
            document.body.appendChild(helperdiv);
            helperdiv.contentEditable = true;

            // focus the helper div's content
            var range = document.createRange();
            range.selectNode(helperdiv);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            helperdiv.focus();

            // trigger the paste action
            bg.document.execCommand("Paste");

            // read the clipboard contents from the helperdiv
            var clipboardContents = helperdiv.innerHTML;
            console.log(clipboardContents)
        }
        sendResponse({});
    }
);


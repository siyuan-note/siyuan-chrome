chrome.contextMenus.create({
    title: "Copy to SiYuan",
    contexts: ["selection"],
    onclick: copy2SiYuan,
});

function copy2SiYuan(info, tab) {
    chrome.tabs.query({
        "active": true,
        "currentWindow": true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            "func": "copy"
        });
    });
}

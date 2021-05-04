chrome.contextMenus.create({
    title: "Copy to SiYuan",
    contexts: ["selection"],
    onclick: siyuan,
});

function siyuan(info, tab) {
    chrome.tabs.sendMessage(tab.id, {"func": "copy"});
}

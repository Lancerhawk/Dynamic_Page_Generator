"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePage = storePage;
exports.getPage = getPage;
exports.clearAllPages = clearAllPages;
const pageStore = new Map();
function storePage(intentId, html) {
    pageStore.set(intentId, {
        html,
        timestamp: Date.now()
    });
}
function getPage(intentId) {
    const page = pageStore.get(intentId);
    return page ? page.html : null;
}
function clearAllPages() {
    pageStore.clear();
}

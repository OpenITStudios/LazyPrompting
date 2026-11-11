/* Optional, status-only extension side. No network access and no transcript storage. */
(() => {
  'use strict';
  const lastByTab = new Map();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return;
    if (message?.type !== 'LP_FIXTURE_OBSERVATION') return;
    const tabId = sender.tab?.id;
    if (!Number.isSafeInteger(tabId) || tabId < 0 || message.protocolVersion !== 1 ||
        !['IDLE', 'INPUT_ATTEMPTED', 'GENERATING', 'UI_COMPLETED_OBSERVED',
          'ERROR', 'INTERRUPTED', 'UNKNOWN'].includes(message.state) ||
        !Number.isSafeInteger(message.seq) || message.seq < 1) return;
    const old = lastByTab.get(tabId);
    if (old && message.epoch < old.epoch) return;
    if (old && message.epoch === old.epoch && message.seq <= old.seq) return;
    const record = {epoch: message.epoch, promptId: message.promptId,
      seq: message.seq, state: message.state, observedAt: Date.now()};
    lastByTab.set(tabId, record);
    // Session storage is convenience cache, not authoritative delivery state.
    chrome.storage.session?.set({[`lp.fixture.${tabId}`]: record}).catch(() => {});
    sendResponse?.({accepted: true});
  });
  chrome.tabs?.onRemoved?.addListener(tabId => lastByTab.delete(tabId));
})();

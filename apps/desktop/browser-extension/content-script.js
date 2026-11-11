/* LazyPrompting: synthetic fixture only. No ChatGPT output, cookies, or network interception. */
(() => {
  'use strict';
  if (globalThis.__lpFixtureContentScript) return;
  const url = new URL(location.href);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !url.pathname.startsWith('/fixture-chat/')) return;
  globalThis.__lpFixtureContentScript = true;

  const root = document.querySelector('[data-lazy-fixture-root]');
  if (!root) return;
  const editor = root.querySelector('[data-lazy-fixture-editor]');
  const send = root.querySelector('[data-lazy-fixture-send]');
  const indicator = root.querySelector('#status');
  if (!editor || !send || !indicator) return;

  const validId = /^[A-Za-z0-9:_-]{1,128}$/;
  let epoch = 0;
  let promptId = null;
  let status = 'IDLE';
  let seq = 0;
  let dispatchAttempted = false;
  let armed = false;
  const used = new Set();
  let latestStatusText = '';

  function emit(next, reason = null) {
    if (next === status && !reason) return;
    status = next;
    const event = Object.freeze({
      type: 'LP_FIXTURE_OBSERVATION',
      protocolVersion: 1,
      epoch,
      promptId,
      seq: ++seq,
      state: next,
      reason,
      // No page content, user text, or assistant response is transmitted.
    });
    try { chrome.runtime.sendMessage(event).catch(() => {}); } catch {}
  }

  function statusFromFixture() {
    // The *owned fixture* exposes an explicit status marker. This is not a
    // ChatGPT selector nor a claim that consumer ChatGPT emits turn events.
    const text = String(indicator.textContent || '').trim();
    if (text === latestStatusText) return;
    latestStatusText = text;
    if (!dispatchAttempted) return;
    if (text === 'GENERATING') {
      armed = true;
      emit('GENERATING');
    } else if (text === 'DONE' && armed) {
      emit('UI_COMPLETED_OBSERVED');
    } else if (text === 'ERROR') {
      emit('ERROR');
    } else if (text === 'MANUAL_STOP') {
      emit('INTERRUPTED');
    }
  }

  const observer = new MutationObserver(statusFromFixture);
  observer.observe(indicator, {childList: true, subtree: true, characterData: true});
  function submit(command) {
    if (!command || command.protocolVersion !== 1 ||
        command.workspaceId === undefined || !/^workspace-(0[1-9]|10)$/.test(command.workspaceId) ||
        !Number.isSafeInteger(command.epoch) || command.epoch < 1 ||
        !validId.test(command.promptId || '') || typeof command.text !== 'string' ||
        !command.text.trim() || command.text.length > 12000) {
      return {attempted: false, reason: 'INVALID_FIXTURE_COMMAND'};
    }
    if (dispatchAttempted) return {attempted: false, reason: 'ACTIVE_PROMPT_UNRESOLVED'};
    const key = `${command.epoch}:${command.promptId}`;
    if (used.has(key)) return {attempted: false, reason: 'DUPLICATE_PROMPT_ID'};
    // Preserve manual user edits; never overwrite an existing composer.
    if (String(editor.value || '').trim() || editor.disabled || editor.readOnly || send.disabled)
      return {attempted: false, reason: 'COMPOSER_NOT_READY'};
    // Write the reservation before the side effect. A click is *not* proof of
    // acceptance; the controller must reconcile the outcome independently.
    used.add(key);
    dispatchAttempted = true;
    promptId = command.promptId;
    epoch = command.epoch;
    armed = false;
    seq = 0;
    emit('INPUT_ATTEMPTED');
    try {
      editor.focus();
      editor.value = command.text;
      editor.dispatchEvent(new Event('input', {bubbles: true}));
      if (send.disabled) return {attempted: false, reason: 'COMPOSER_REJECTED', uncertain: true};
      send.click();
      statusFromFixture();
      return {attempted: true, acknowledged: false, reason: 'UI_ACTION_ONLY'};
    } catch {
      emit('UNKNOWN', 'INPUT_OR_CLICK_EXCEPTION');
      return {attempted: true, acknowledged: false, reason: 'SEND_OUTCOME_UNKNOWN'};
    }
  }

  function reset(command) {
    // This is intentionally *not* exposed as a retry. Native authority must
    // verify the previous prompt before advancing to a new epoch.
    if (command?.verified !== true || command.epoch !== epoch || command.promptId !== promptId ||
        !['UI_COMPLETED_OBSERVED', 'ERROR', 'INTERRUPTED', 'UNKNOWN'].includes(status))
      return {reset: false, reason: 'VERIFIED_COMPLETION_REQUIRED'};
    dispatchAttempted = false;
    armed = false;
    promptId = null;
    emit('IDLE');
    return {reset: true};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return;
    if (message?.type === 'LP_FIXTURE_SEND') sendResponse(submit(message));
    else if (message?.type === 'LP_FIXTURE_STATUS') sendResponse({state: status, epoch, promptId, seq});
    else if (message?.type === 'LP_FIXTURE_RESET') sendResponse(reset(message));
  });
  emit('IDLE');
})();

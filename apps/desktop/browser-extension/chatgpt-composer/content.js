/* ChatGPT input only: no answer reading, page scraping, cookies or background loops. */
(() => {
  'use strict';
  if (globalThis.__lazyPromptingOperatorComposer) return;
  globalThis.__lazyPromptingOperatorComposer = true;
  let sending = false;
  // UI-only observation, deliberately not a trusted final-turn receipt.
  let phase = 'IDLE';
  let startedAt = 0;
  let generationSeen = false;
  let lastChangeAt = 0;
  let inspectQueued = false;
  const STOP_SELECTORS = [
    '[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop response"]',
    'button[aria-label="Stop"]'
  ];
  const ERROR_SELECTORS = [
    '[data-testid="conversation-turn-error"]',
    '[data-testid="response-error"]'
  ];
  const MAX_WAIT_MS = 90_000;
  const MAX_GENERATION_MS = 15 * 60_000;
  function pageAllowed() {
    const u = new URL(location.href);
    return u.protocol === 'https:' && u.hostname === 'chatgpt.com' &&
      ![...u.searchParams.keys()].some(k => /^temporary[-_]?chat$/i.test(k));
  }
  function actionable(element) {
    return !!element && !element.disabled && element.getClientRects().length > 0;
  }
  function visible(root, selectors) {
    return selectors.some(selector => actionable(root.querySelector(selector)));
  }
  function observePhase() {
    if (phase === 'IDLE' || phase === 'POSSIBLY_COMPLETED' ||
        phase === 'ERROR' || phase === 'UNKNOWN') return;
    if (!pageAllowed()) { phase = 'UNKNOWN'; return; }
    const now = Date.now();
    if (visible(document, ERROR_SELECTORS)) {
      phase = 'ERROR'; lastChangeAt = now; return;
    }
    if (visible(document, STOP_SELECTORS)) {
      generationSeen = true;
      phase = 'GENERATING';
      lastChangeAt = now;
    } else if (generationSeen) {
      // Stop disappearing is a UI hint only. It could also mean interruption.
      phase = 'POSSIBLY_COMPLETED';
      lastChangeAt = now;
    } else if (now - startedAt >= MAX_WAIT_MS) {
      phase = 'UNKNOWN'; lastChangeAt = now;
    }
    if (phase === 'GENERATING' && now - startedAt >= MAX_GENERATION_MS) {
      phase = 'UNKNOWN'; lastChangeAt = now;
    }
  }
  // Observe only UI controls; never collect response text or page contents.
  const observer = new MutationObserver(() => {
    if (inspectQueued || phase === 'IDLE') return;
    inspectQueued = true;
    queueMicrotask(() => { inspectQueued = false; observePhase(); });
  });
  observer.observe(document.documentElement, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['disabled','aria-label','data-testid','hidden','style','class']
  });
  function statusSnapshot() {
    observePhase();
    return {state:phase,source:'UNVERIFIED_PAGE_UI',
      generationSeen,deliveryVerified:false,resultVerified:false,
      nextPromptAllowed:false,startedAt:lastChangeAt ? startedAt : 0};
  }
  const EDITORS = ['#prompt-textarea','[data-testid="composer-text-input"]','[role="textbox"][contenteditable="true"]'];
  const BUTTONS = ['[data-testid="send-button"]','button[aria-label="Send prompt"]','button[aria-label="Send message"]','button[type="submit"]'];
  function find(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }
  function value(element) {
    return 'value' in element ? String(element.value ?? '') : String(element.textContent ?? '');
  }
  function fill(editor, text) {
    editor.focus();
    if ('value' in editor) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor),'value')?.set;
      if (setter) setter.call(editor,text);
      else editor.value = text;
      editor.dispatchEvent(new Event('input',{bubbles:true}));
      return value(editor) === text;
    }
    if (editor.getAttribute('contenteditable') !== 'true') return false;
    if (document.execCommand('insertText',false,text) !== true) return false;
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    return value(editor) === text;
  }
  chrome.runtime.onMessage.addListener((message,sender,respond) => {
    if (sender?.id !== chrome.runtime.id) return;
    if (message?.type === 'LP_OPERATOR_STATUS') {
      respond(statusSnapshot()); return;
    }
    if (message?.type !== 'LP_OPERATOR_SEND_ONCE') return;
    const u = new URL(location.href);
    if (u.protocol !== 'https:' || u.hostname !== 'chatgpt.com' ||
        [...u.searchParams.keys()].some(k => /^temporary[-_]?chat$/i.test(k))) {
      respond({attempted:false,reason:'UNSUPPORTED_PAGE'});
      return;
    }
    if (sending) {respond({attempted:false,reason:'SEND_ALREADY_IN_PROGRESS'});return;}
    if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 12000) {
      respond({attempted:false,reason:'INVALID_PROMPT'});return;
    }
    const editor = find(document,EDITORS);
    const button = editor && find(editor.closest('form') ?? document,BUTTONS);
    if (!editor || !button || editor.disabled || editor.readOnly || button.disabled ||
        value(editor).trim() || !editor.getClientRects().length) {
      respond({attempted:false,reason:'COMPOSER_NOT_READY'});return;
    }
    sending = true;
    try {
      if (!fill(editor,message.text)) {
        respond({attempted:true,reason:'INPUT_RESULT_UNKNOWN'});return;
      }
      if (button.disabled) {
        respond({attempted:true,reason:'SEND_NOT_ACTIONABLE'});return;
      }
      // Start observing before the click so fast generating transitions
      // are not missed; no automatic resend on an uncertain outcome.
      phase = 'WAITING';
      startedAt = Date.now();
      lastChangeAt = startedAt;
      generationSeen = false;
      button.click();
      observePhase();
      respond({attempted:true,reason:'UI_ACTION_ONLY',...statusSnapshot()});
    } catch {
      phase = 'UNKNOWN';
      respond({attempted:true,reason:'SEND_OUTCOME_UNKNOWN',...statusSnapshot()});
    } finally {
      sending = false;
    }
  });
})();

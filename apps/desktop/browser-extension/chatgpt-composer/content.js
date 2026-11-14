/* ChatGPT input only: no answer reading, page scraping, cookies or background loops. */
(() => {
  'use strict';
  if (globalThis.__lazyPromptingOperatorComposer) return;
  globalThis.__lazyPromptingOperatorComposer = true;
  let sending = false;
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
    if (sender?.id !== chrome.runtime.id || message?.type !== 'LP_OPERATOR_SEND_ONCE') return;
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
      button.click();
      respond({attempted:true,reason:'UI_ACTION_ONLY'});
    } catch {
      respond({attempted:true,reason:'SEND_OUTCOME_UNKNOWN'});
    } finally {
      sending = false;
    }
  });
})();

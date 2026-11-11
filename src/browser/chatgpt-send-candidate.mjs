// ChatGPT composer candidate: SOURCE ONLY, intentionally not imported by the
// shipped fixture extension, installed WebView2, or production MCP gateway.
// It is *not* a supported consumer ChatGPT automation transport. This module
// never accesses assistant responses, private endpoints, cookies or transcripts.

const WORKSPACE = /^workspace-(0[1-9]|10)$/;
const PROMPT_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const EDITOR_SELECTORS = [
  '#prompt-textarea',
  '[data-testid="composer-text-input"]',
  '[role="textbox"][contenteditable="true"]',
];
const SEND_SELECTORS = [
  '[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[type="submit"]',
];

const isChatGptOrigin = url => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'chatgpt.com' &&
      u.username === '' && u.password === '';
  } catch { return false; }
};

function findElement(root, selectors) {
  for (const selector of selectors) {
    const result = root?.querySelector?.(selector);
    if (result) return result;
  }
  return null;
}

const currentText = element => element && 'value' in element
  ? String(element.value ?? '') : String(element?.textContent ?? '');

function insertText({document, editor, text}) {
  editor.focus?.();
  if ('value' in editor) {
    const proto = Object.getPrototypeOf(editor);
    const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (typeof setter === 'function') setter.call(editor, text);
    else editor.value = text;
    editor.dispatchEvent?.(new Event('input', {bubbles:true}));
    return currentText(editor) === text;
  }
  if (editor.getAttribute?.('contenteditable') !== 'true') return false;
  // execCommand is a compatibility candidate, not guaranteed by React.
  // If the editor declines the operation, fail rather than faking a keystroke.
  if (document.execCommand?.('insertText', false, text) !== true) return false;
  editor.dispatchEvent?.(new Event('input', {bubbles:true}));
  return currentText(editor) === text;
}

export function createChatGptSendCandidate({document, pageUrl, authorize, verifyCompletion}={}) {
  if (!document || !isChatGptOrigin(pageUrl) || typeof authorize !== 'function' ||
      typeof verifyCompletion !== 'function')
    throw new Error('TRUSTED_CHATGPT_SITE_ADAPTER_UNAVAILABLE');
  const attempted = new Set();
  const pending = new Set();
  const outstanding = new Map();
  return Object.freeze({
    async submit({workspaceId, epoch, promptId, text}={}) {
      if (!WORKSPACE.test(workspaceId??'') || !Number.isSafeInteger(epoch) || epoch<1 ||
        !PROMPT_ID.test(promptId??'') || typeof text !== 'string' ||
        !text.trim() || text.length > 12000)
        return {attempted:false,reason:'INVALID_PROMPT_SCOPE'};
      const key = `${workspaceId}:${epoch}:${promptId}`;
      if (attempted.has(key))return {attempted:false,reason:'PROMPT_ALREADY_ATTEMPTED'};
      if (pending.has(workspaceId) || outstanding.has(workspaceId))
        return {attempted:false,reason:'WORKSPACE_PROMPT_PENDING'};
      // Reserve the workspace BEFORE awaiting authorization, otherwise two
      // concurrent calls can both be admitted and click Send twice.
      pending.add(workspaceId);
      try {
        // Only the native host can supply an authenticated, one-use admission
        // callback. A model-provided boolean is not authorization.
        if ((await authorize({workspaceId,epoch,promptId,origin:'https://chatgpt.com'})) !== true)
          return {attempted:false,reason:'NATIVE_HOST_ADMISSION_REQUIRED'};
        const editor = findElement(document,EDITOR_SELECTORS);
        const container = editor?.closest?.('form') ?? document;
        const button = findElement(container,SEND_SELECTORS);
        if (!editor || !button || editor.disabled || editor.readOnly ||
            button.disabled || currentText(editor).trim())
          return {attempted:false,reason:'COMPOSER_NOT_READY'};
        // The attempted identity and workspace lock are recorded before any
        // side effect. Unknown outcomes cannot be retried automatically.
        attempted.add(key);
        outstanding.set(workspaceId,{epoch,promptId});
        try {
          if (!insertText({document,editor,text}))
            return {attempted:true,accepted:false,reason:'INPUT_RESULT_UNKNOWN'};
          if (button.disabled)return {attempted:true,accepted:false,reason:'SEND_NOT_ACTIONABLE'};
          button.click();
          return {attempted:true,accepted:false,reason:'UI_ACTION_ONLY'};
        } catch {return {attempted:true,accepted:false,reason:'SEND_OUTCOME_UNKNOWN'};}
      } finally {pending.delete(workspaceId);}
    },
    async release({workspaceId,epoch,promptId}={}) {
      const active=outstanding.get(workspaceId);
      if (!active || active.epoch!==epoch || active.promptId!==promptId)
        return {released:false,reason:'PROMPT_IDENTITY_MISMATCH'};
      // A browser's idle state is not proof of completion. The trusted host
      // must reconcile GitHub/task evidence before allowing another prompt.
      if ((await verifyCompletion({workspaceId,epoch,promptId}))!==true)
        return {released:false,reason:'INDEPENDENT_EVIDENCE_REQUIRED'};
      outstanding.delete(workspaceId);
      return {released:true};
    },
  });
}

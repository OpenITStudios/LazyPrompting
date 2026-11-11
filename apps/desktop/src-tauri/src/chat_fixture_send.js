/* Owned fixture only: native host schedules this code in one WebView2 view.
 * This source is embedded with Rust include_str!. No page-to-native requests,
 * assistant text, cookies, private APIs, extension ports or screenshots. */
function lazyFixtureSend(input) {
  if (!input || input.protocolVersion !== 1 ||
      typeof input.expectedOrigin !== 'string' ||
      typeof input.expectedHref !== 'string' ||
      typeof input.promptId !== 'string' ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.promptId) ||
      !Number.isSafeInteger(input.epoch) || input.epoch < 1 ||
      typeof input.text !== 'string' || !input.text.trim() ||
      input.text.length > 12000) {
    return {attempted:false, reason:'INVALID_FIXTURE_COMMAND'};
  }
  const url = new URL(location.href);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !url.pathname.startsWith('/fixture-chat/') ||
      url.origin !== input.expectedOrigin || location.href !== input.expectedHref) {
    return {attempted:false, reason:'FIXTURE_ORIGIN_MISMATCH'};
  }
  const root = document.querySelector('[data-lazy-fixture-root]');
  const editor = root?.querySelector('[data-lazy-fixture-editor]');
  const send = root?.querySelector('[data-lazy-fixture-send]');
  const key = `${input.epoch}:${input.promptId}`;
  if (root?.dataset?.lpFixtureLastPrompt === key) {
    return {attempted:false, reason:'DUPLICATE_PROMPT_ID'};
  }
  if (!editor || !send || editor.disabled || editor.readOnly ||
      send.disabled || typeof editor.value !== 'string' || editor.value.trim()) {
    return {attempted:false, reason:'COMPOSER_NOT_READY'};
  }
  // Fixture-only UI marker. Host's durable reservation is authoritative;
  // this is a best-effort duplicate guard for a single page instance.
  if (!root.dataset) return {attempted:false, reason:'FIXTURE_ROOT_INVALID'};
  root.dataset.lpFixtureLastPrompt = key;
  try {
    editor.focus();
    editor.value = input.text;
    editor.dispatchEvent(new Event('input', {bubbles:true}));
    if (send.disabled) return {attempted:true, reason:'SEND_OUTCOME_UNKNOWN'};
    send.click();
    return {attempted:true, reason:'UI_ACTION_ONLY'};
  } catch {
    return {attempted:true, reason:'SEND_OUTCOME_UNKNOWN'};
  }
}

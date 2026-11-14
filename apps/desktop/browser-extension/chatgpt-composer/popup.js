/* Operator-triggered only. No automatic follow-up or stored prompt. */
const input = document.getElementById('prompt');
const button = document.getElementById('send');
const status = document.getElementById('status');
let busy = false;
button.addEventListener('click', async () => {
  if (busy) return;
  const text = input.value;
  if (!text.trim() || text.length > 12000) {
    status.textContent = 'Enter a prompt (maximum 12,000 characters).';
    return;
  }
  busy = true;
  button.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const u = new URL(tab?.url ?? '');
    if (u.protocol !== 'https:' || u.hostname !== 'chatgpt.com' ||
        [...u.searchParams.keys()].some(k => /^temporary[-_]?chat$/i.test(k)))
      throw Error('Open an ordinary ChatGPT tab first.');
    const result = await chrome.tabs.sendMessage(tab.id, {type:'LP_OPERATOR_SEND_ONCE',text});
    if (!result?.attempted) {
      status.textContent = result?.reason || 'The ChatGPT composer is not ready.';
      return;
    }
    input.value = '';
    status.textContent = 'Send button clicked once. Confirm delivery in the conversation.';
  } catch (error) {
    status.textContent = error?.message || 'Unable to reach the ChatGPT tab.';
  } finally {
    busy = false;
    button.disabled = false;
  }
});

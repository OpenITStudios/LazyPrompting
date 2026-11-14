/* Operator-triggered only. No automatic follow-up or stored prompt. */
const input = document.getElementById('prompt');
const button = document.getElementById('send');
const status = document.getElementById('status');
const check = document.getElementById('check-status');
const render = state => {
  const names={IDLE:'No observed send',WAITING:'Waiting for generation',GENERATING:'Generating',
    POSSIBLY_COMPLETED:'Possibly completed (not verified)',ERROR:'Page error observed',
    UNKNOWN:'Unknown / timed out'};
  status.textContent=(names[state] || 'Unknown')+' — UI observation only.';
};
async function activeChatTab(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const u=new URL(tab?.url ?? '');
  if(u.protocol!=='https:'||u.hostname!=='chatgpt.com'||
     [...u.searchParams.keys()].some(k=>/^temporary[-_]?chat$/i.test(k)))
    throw Error('Open an ordinary ChatGPT tab first.');
  return tab;
}
check.addEventListener('click',async()=>{
  try{
    const tab=await activeChatTab();
    const receipt=await chrome.tabs.sendMessage(tab.id,{type:'LP_OPERATOR_STATUS'});
    render(receipt?.state);
  }catch(error){status.textContent=error?.message||'Status unavailable.';}
});
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
    const tab=await activeChatTab();
    const result = await chrome.tabs.sendMessage(tab.id, {type:'LP_OPERATOR_SEND_ONCE',text});
    if (!result?.attempted) {
      status.textContent = result?.reason || 'The ChatGPT composer is not ready.';
      return;
    }
    input.value = '';
    render(result.state);
    status.textContent += ' Send was attempted once; confirm delivery in ChatGPT.';
  } catch (error) {
    status.textContent = error?.message || 'Unable to reach the ChatGPT tab.';
  } finally {
    busy = false;
    button.disabled = false;
  }
});

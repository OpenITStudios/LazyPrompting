/* One ChatGPT Companion UI shared byte-for-byte by Helium and WebView2.
 * The existing original Usage Meter may supply a visible token estimate;
 * without it, Context is unknown. No transcript/endpoint interception. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionActive)return;
  const C=globalThis.__lpCompanionCore;
  const M=globalThis.__lpCompactHistory;
  const H=globalThis.__lpHistoryVisibility;
  const U=globalThis.__lpCompanionUsageSignal;
  const S=globalThis.__lpCompanionSettings;
  const L=globalThis.__lpCompanionLimit;
  const R=globalThis.__lpCompanionNewChat;
  const P=globalThis.__lpCompanionStatusResolver;
  if(!C||!M||!H||!U||!S||!L||!R||!P||!globalThis.chrome?.storage?.local)return;
  globalThis.__lpCompanionActive=true;
  const store=chrome.storage.local;
  let state=S.normalize(),current=null,bar=null,panel=null,context=null,chats=null,status=null;
  let statusText=null,retryButton=null,lastRetryKey=null,newChatErrorFor=null;
  let settingsButton=null,compactCheck=null,historySelect=null,customRow=null,customInput=null;
  let soonLabel=null,switchLabel=null,editButton=null,editArea=null,editSoon=null,editSwitch=null;
  let feedback=null,historyExpanded=false,editing=false,menuOpen=false;
  let scheduled=null,lastScan=0,lastCompact=0,compactBatchTimer=null;
  function el(tag,className,text){
    const item=document.createElement(tag);
    if(className)item.className=className;
    if(text!==undefined)item.textContent=text;
    return item;
  }
  function button(label,action,aria){
    const b=el("button","",label);
    b.type="button";
    if(aria)b.setAttribute("aria-label",aria);
    b.addEventListener("click",action);
    return b;
  }
  // Small brand mark from the repository-owned lazyprompting-icon.svg.
  // Inline SVG avoids an extra extension permission or icon asset loader.
  function appIcon(){
    const ns="http://www.w3.org/2000/svg";
    const icon=document.createElementNS(ns,"svg");
    icon.setAttribute("viewBox","235 290 785 680");
    icon.setAttribute("aria-hidden","true");
    icon.setAttribute("focusable","false");
    for(const [fill,data] of [
      ["#F4F7FF","M421 369 L421 812 L667 812 L610 940 L377 940 C302 940 255 891 255 817 L255 484 C255 455 270 435 291 421 L415 369 Q421 366 421 369 Z"],
      ["#27C5F4","M445 461 L497 353 Q520 309 570 309 H675 L598 462 H449 Q442 462 445 461 Z"],
      ["#078CFB","M621 462 L700 309 H823 C921 309 995 385 995 481 V634 C995 739 916 812 810 812 H440 L498 690 H789 C825 690 851 661 851 624 V522 C851 485 825 462 789 462 Z"]
    ]){
      const path=document.createElementNS(ns,"path");
      path.setAttribute("d",data);path.setAttribute("fill",fill);
      icon.append(path);
    }
    for(const d of ["M525 520 L604 577 L525 634","M642 630 H732"]){
      const path=document.createElementNS(ns,"path");
      path.setAttribute("d",d);path.setAttribute("fill","none");
      path.setAttribute("stroke","#fff");path.setAttribute("stroke-width","34");
      path.setAttribute("stroke-linecap","round");path.setAttribute("stroke-linejoin","round");
      icon.append(path);
    }
    const brand=el("span","lp-brand");
    brand.title="LazyPrompting";
    brand.setAttribute("aria-label","LazyPrompting");
    brand.append(icon);
    return brand;
  }
  function plusIcon(){
    const ns="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");
    const path=document.createElementNS(ns,"path");
    path.setAttribute("d","M12 5v14M5 12h14");
    path.setAttribute("fill","none");path.setAttribute("stroke","currentColor");
    path.setAttribute("stroke-width","2.2");path.setAttribute("stroke-linecap","round");
    svg.append(path);return svg;
  }
  async function newChat(event){
    // One explicit operator/approved-host pointer action. Synthetic page
    // script clicks cannot authorize navigation or native Work rollover.
    if(!event?.isTrusted||!current||
       C.safeChatId(location.href)!==current)return;
    openMenu(false);
    const chatId=current;
    if(!await R.begin(chatId)){
      if(current===chatId){
        newChatErrorFor=chatId;
        refreshStatus();
      }
    }else newChatErrorFor=null;
  }
  function responseErrorPresent(notice){
    return L.observeLatestError(document)||notice?.status==="RESPONSE_ERROR_POSSIBLE";
  }
  function currentRetryKey(){
    return current+"|"+(C.turnMarker(C.turns(document,1)[0])??"latest");
  }
  function retryGeneration(event){
    // An actual user click invokes the site's own Regenerate once.
    // No automatic, background, or parallel prompt transport is created.
    if(!event?.isTrusted||!current||C.safeChatId(location.href)!==current)return;
    const notice=L.observe(document);
    if(!responseErrorPresent(notice)||L.isGenerating(document)||
       ["USAGE_CAP_POSSIBLE","CHAT_LENGTH_POSSIBLE"].includes(notice?.status)||
       U.observe(document)?.limit)return;
    const control=L.retryControl(document);
    const key=currentRetryKey();
    if(!control||lastRetryKey===key)return;
    lastRetryKey=key;retryButton.disabled=true;
    control.click();
    schedule();
  }
  function itemRow(name,value){
    const row=el("div","lp-row");
    row.append(el("span","lp-row-label",name),value);
    return row;
  }
  function message(value){if(feedback)feedback.textContent=value||"";}
  function build(){
    bar=el("div","lp-companion");
    bar.id="lp-companion";
    bar.setAttribute("role","group");
    bar.setAttribute("aria-label","ChatGPT context monitor");
    const strip=el("div","lp-strip");
    strip.setAttribute("role","group");
    strip.setAttribute("aria-label","LazyPrompting context monitoring");
    const contextMetric=el("span","lp-metric lp-context-metric");
    const dot=el("span","lp-context-dot");
    dot.setAttribute("aria-hidden","true");
    context=el("strong","lp-context","—");
    context.title="Automatic estimate unavailable. No private ChatGPT API is called.";
    contextMetric.append(dot,el("span","lp-metric-label","Context"),context);
    const chatMetric=el("span","lp-metric lp-chat-metric");
    chats=el("strong","lp-chat-count","—");
    chats.title="Full chat message count cannot be confirmed.";
    chatMetric.append(el("span","lp-metric-label","Chat"),chats);
    status=el("span","lp-status","");
    status.hidden=true;status.setAttribute("role","group");
    statusText=el("span","lp-status-text","");
    statusText.setAttribute("role","status");
    retryButton=button("Retry",retryGeneration,"Retry failed response");
    retryButton.className="lp-retry";
    retryButton.hidden=true;
    status.append(statusText,retryButton);
    const statusSpacer=el("span","lp-status-spacer");
    statusSpacer.setAttribute("aria-hidden","true");
    const newButton=button("",newChat,"New Chat");
    newButton.className="lp-new-chat";
    newButton.title="Open a new ChatGPT chat. Previous chat stays; use Work for reviewed rollover and cleanup.";
    newButton.append(plusIcon(),el("span","lp-new-chat-label","New Chat"));
    settingsButton=button("⚙",()=>openMenu(!menuOpen),"Settings");
    settingsButton.className="lp-settings-icon";
    settingsButton.title="Settings";
    strip.append(appIcon(),el("span","lp-sep"),contextMetric,
      el("span","lp-sep"),chatMetric,statusSpacer,status,newButton,settingsButton);
    bar.append(strip);

    // Settings are a portal, not an extra row or an extension action popup.
    panel=el("section","lp-settings-panel");
    panel.id="lp-companion-settings";
    panel.setAttribute("aria-label","Companion settings");
    panel.hidden=true;
    const head=el("div","lp-settings-head");
    head.append(el("strong","","Settings"),button("×",()=>openMenu(false),"Close settings"));
    panel.append(head);
    const compact=el("section","lp-settings-section");
    const compactTitle=el("div","lp-row");
    const compactText=el("div","lp-col");
    compactText.append(el("strong","","Compact History"),
      el("span","lp-hint","Optimize older messages"));
    compactCheck=document.createElement("input");
    compactCheck.type="checkbox";compactCheck.setAttribute("aria-label","Enable Compact History");
    compactCheck.addEventListener("change",()=>void persist({compact:compactCheck.checked}));
    compactTitle.append(compactText,compactCheck);
    compact.append(compactTitle);
    historySelect=document.createElement("select");
    historySelect.setAttribute("aria-label","Keep visible recent history");
    for(const [value,label] of [["1","Last 1"],["3","Last 3"],["5","Last 5"],
      ["10","Last 10"],["25","Last 25"],["unlimited","Unlimited"],["custom","Custom…"]]){
      const opt=document.createElement("option");
      opt.value=value;opt.textContent=label;historySelect.append(opt);
    }
    historySelect.addEventListener("change",()=>void persist({history:historySelect.value}));
    const historyRow=itemRow("Keep visible",historySelect);
    historyRow.classList.add("lp-history-row");
    compact.append(historyRow);
    customInput=document.createElement("input");
    customInput.type="number";customInput.min="1";customInput.max="1500";customInput.step="1";
    customInput.setAttribute("aria-label","Custom visible exchanges");
    customInput.addEventListener("change",()=>{
      const value=Number(customInput.value);
      if(!Number.isSafeInteger(value)||value<1||value>1500){
        message("Enter a value from 1 to 1500.");return;
      }
      void persist({custom:value});
    });
    customRow=itemRow("Custom count",customInput);
    customRow.classList.add("lp-custom-row");
    compact.append(customRow);
    compact.append(el("p","lp-description","Older messages stay accessible; nothing is deleted."));
    panel.append(compact);

    const warns=el("section","lp-settings-section");
    const whead=el("div","lp-row");
    const wtext=el("div","lp-col");
    wtext.append(el("strong","","Context Warnings"),
      el("span","lp-hint","Two inline warning levels"));
    editButton=button("Edit",()=>void toggleEdit());
    editButton.className="lp-outline-button";
    whead.append(wtext,editButton);
    warns.append(whead);
    const summary=el("div","lp-warnings-summary");
    soonLabel=el("span","","3.6M");
    switchLabel=el("span","","4M");
    const a=itemRow("New chat soon",soonLabel);
    const b=itemRow("Switch chat",switchLabel);
    summary.append(a,b);
    warns.append(summary);
    editArea=el("div","lp-warning-editor");
    editArea.hidden=true;
    editSoon=document.createElement("input");
    editSwitch=document.createElement("input");
    for(const input of [editSoon,editSwitch]){
      input.type="number";input.step="0.1";input.min="0.1";input.max="100";
      input.className="lp-warning-value";
    }
    editSoon.setAttribute("aria-label","New chat soon threshold in millions of tokens");
    editSwitch.setAttribute("aria-label","Switch chat threshold in millions of tokens");
    editArea.append(itemRow("New chat soon",editSoon),itemRow("Switch chat",editSwitch),
      el("p","lp-description","Values in millions of estimated tokens."));
    warns.append(editArea);
    panel.append(warns);
    const footer=el("footer","lp-settings-footer");
    feedback=el("span","lp-feedback","");
    const reset=button("Reset defaults",()=>void persist(S.DEFAULTS));
    reset.className="lp-outline-button";
    footer.append(feedback,reset);
    panel.append(footer);
    document.body?.append(panel);
    refreshControls();
  }
  function refreshControls(){
    if(!panel)return;
    compactCheck.checked=state.compact;
    historySelect.value=state.history;
    customRow.hidden=!state.compact||state.history!=="custom";
    customInput.value=String(state.custom);
    historySelect.disabled=!state.compact;
    const row=historySelect.closest(".lp-history-row");
    if(row)row.hidden=!state.compact;
    soonLabel.textContent=S.millionText(state.soon)+"M";
    switchLabel.textContent=S.millionText(state.switchAt)+"M";
    if(!editing){
      editSoon.value=S.millionText(state.soon);
      editSwitch.value=S.millionText(state.switchAt);
    }
  }
  async function persist(patch){
    const next=S.normalize({...state,...patch});
    try{
      await store.set({[S.KEY]:next});
      state=next;
      historyExpanded=false;
      refreshControls();
      applyHistory(true);
      message("");
    }catch{
      refreshControls();message("Settings could not be saved.");
    }
  }
  async function toggleEdit(){
    if(!editing){
      editing=true;editArea.hidden=false;editButton.textContent="Done";
      editSoon.value=S.millionText(state.soon);
      editSwitch.value=S.millionText(state.switchAt);
      editSoon.focus();return;
    }
    const soon=S.fromMillions(editSoon.value);
    const switchAt=S.fromMillions(editSwitch.value);
    if(soon===null||switchAt===null||soon>=switchAt){
      message("Switch chat must be greater than New chat soon.");return;
    }
    const previous=state;
    try{
      const next=S.normalize({...state,soon,switchAt});
      await store.set({[S.KEY]:next});
      state=next;editing=false;editArea.hidden=true;editButton.textContent="Edit";
      message("");refreshControls();refreshStatus();
    }catch{
      state=previous;message("Thresholds could not be saved.");
    }
  }
  function positionMenu(){
    if(!menuOpen||!panel||!settingsButton?.isConnected)return;
    const buttonBox=settingsButton.getBoundingClientRect();
    const width=panel.offsetWidth||352;
    const height=panel.offsetHeight||360;
    const left=Math.max(8,Math.min(buttonBox.right-width,window.innerWidth-width-8));
    const top=Math.max(8,buttonBox.top-height-9);
    panel.style.left=Math.round(left)+"px";
    panel.style.top=Math.round(top)+"px";
  }
  function openMenu(open){
    menuOpen=Boolean(open)&&Boolean(bar?.isConnected);
    panel.hidden=!menuOpen;
    settingsButton?.setAttribute("aria-expanded",String(menuOpen));
    if(menuOpen){refreshControls();positionMenu();}
    else {editing=false;editArea.hidden=true;editButton.textContent="Edit";message("");}
  }
  function chatCount(){
    const list=C.turns(document,3001);
    if(!list.length)return {label:"—",title:"No structural chat turns are currently loaded."};
    const numbers=list.map(n=>{
      const t=n.getAttribute?.("data-testid")??"";
      const m=/^conversation-turn-(\d+)$/.exec(t);
      return m?Number(m[1]):null;
    });
    const first=numbers[0];
    const complete=(first===0||first===1)&&numbers.every((n,i)=>n===i+first);
    return complete?
      {label:list.length+"x",title:list.length+" contiguous indexed messages loaded from the start of this chat."}:
      {label:"—",title:list.length+" messages currently loaded, but complete message count is not verified."};
  }
  function refreshStatus(){
    if(!bar?.isConnected)return;
    const usage=U.observe(document);
    const tokens=usage?.tokens??null;
    const tokenText=U.format(tokens);
    if(context.textContent!==tokenText)context.textContent=tokenText;
    context.title=tokens===null?
      "Automatic token estimate unavailable. No chat content is read.":
      "Approximate chat tokens from the separately installed Usage Meter, not the official model context limit.";
    const count=chatCount();
    if(chats.textContent!==count.label)chats.textContent=count.label;
    chats.title=count.title;
    document.documentElement.classList.toggle("lp-companion-has-meter",tokens!==null);
    const notice=L.observe(document);
    const responseError=responseErrorPresent(notice);
    if(!responseError)lastRetryKey=null;
    const canRetry=responseError&&!L.isGenerating(document)&&
      Boolean(L.retryControl(document))&&lastRetryKey!==currentRetryKey();
    const chosen=P.resolve({
      meterLimit:usage?.limit===true,responseError,notice:notice?.status??null,
      retryAvailable:canRetry,tokens,soon:state.soon,switchAt:state.switchAt,
      newChatUnavailable:newChatErrorFor===current,
      cleanupStatus:R.resultFor(current)
    });
    // Stable, bounded UI-only enum for the owned WebView2 readback.
    // Never put chat text, a prompt, authorization, or a host grant here.
    if(bar.dataset.statusKind!==chosen.id)bar.dataset.statusKind=chosen.id;
    const hidden=chosen.id==="none";
    if(status.hidden!==hidden)status.hidden=hidden;
    if(statusText.textContent!==chosen.label)statusText.textContent=chosen.label;
    if(status.dataset.level!==chosen.level)status.dataset.level=chosen.level;
    if(status.title!==chosen.title)status.title=chosen.title;
    const showRetry=chosen.retry===true;
    if(retryButton.hidden===showRetry)retryButton.hidden=!showRetry;
    if(retryButton.disabled===showRetry)retryButton.disabled=!showRetry;
    const dot=bar.querySelector(".lp-context-dot");
    if(dot&&dot.dataset.level!==chosen.level)dot.dataset.level=chosen.level;
  }
  function applyHistory(force=false){
    if(!current)return;
    const now=Date.now();
    if(!force&&now-lastCompact<1500)return;
    lastCompact=now;
    const active=document.activeElement;
    const selection=globalThis.getSelection?.()??null;
    const opts={enabled:state.compact,activeElement:active,selection};
    // Hide old history before measuring visible turn heights: hidden turns
    // must not cause forced layout reads in the rendering optimization.
    H.apply(document,{enabled:state.compact,visibleTurns:S.visibleTurns(state),
      expanded:historyExpanded,activeElement:active,selection,
      onReveal:()=>{historyExpanded=true;applyHistory(true);}});
    const compact=state.compact?M.apply(document,opts):
      {status:"OFF",pending:0,loaded:0};
    if(!state.compact)M.reset(document);
    if(compact.pending>0&&compactBatchTimer===null){
      const chat=current;
      compactBatchTimer=setTimeout(()=>{
        compactBatchTimer=null;
        if(chat===current)applyHistory(true);
      },150);
    }
  }
  function sync(){
    scheduled=null;lastScan=Date.now();
    const chat=C.safeChatId(location.href);
    if(chat!==current){
      lastRetryKey=null;newChatErrorFor=null;
      M.reset(document);H.reset(document);historyExpanded=false;
      current=chat;lastCompact=0;openMenu(false);
    }
    if(!chat){
      document.documentElement.classList.remove("lp-companion-has-meter");
      bar?.remove();return;
    }
    const editor=document.querySelector('#prompt-textarea,[data-testid="composer-text-input"]');
    const anchor=editor?.closest("form")??editor?.parentElement;
    if(anchor?.parentNode&&bar.parentNode!==anchor.parentNode)anchor.before(bar);
    if(!bar.isConnected){
      document.documentElement.classList.remove("lp-companion-has-meter");
      return;
    }
    const root=document.documentElement;
    const dark=root.classList.contains("dark")||root.dataset.theme==="dark"||
      (!(root.classList.contains("light")||root.dataset.theme==="light")&&
      globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches===true);
    bar.classList.toggle("lp-dark",dark);
    panel.classList.toggle("lp-dark",dark);
    refreshStatus();applyHistory();
    if(menuOpen)positionMenu();
  }
  function schedule(){
    if(scheduled!==null)return;
    scheduled=setTimeout(sync,Math.max(50,850-(Date.now()-lastScan)));
  }
  build();
  void store.get(S.KEY).then(row=>{
    state=S.normalize(row?.[S.KEY]);refreshControls();applyHistory(true);
  }).catch(()=>{message("Settings storage unavailable.");});
  chrome.storage.onChanged?.addListener((changes,area)=>{
    if(area!=="local"||!changes[S.KEY])return;
    state=S.normalize(changes[S.KEY].newValue);
    refreshControls();applyHistory(true);refreshStatus();
  });
  document.addEventListener("lp-companion-new-chat-state",()=>refreshStatus());
  document.addEventListener("pointerdown",event=>{
    if(menuOpen&&!panel.contains(event.target)&&!settingsButton.contains(event.target))openMenu(false);
  },true);
  document.addEventListener("keydown",event=>{
    if(menuOpen&&event.key==="Escape")openMenu(false);
  },true);
  globalThis.addEventListener("resize",positionMenu);
  globalThis.addEventListener("scroll",positionMenu,true);
  const observer=new MutationObserver(records=>{
    if(C.mutationNeedsRefresh(records,"monitor"))schedule();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  globalThis.addEventListener("popstate",schedule);
  globalThis.addEventListener("hashchange",schedule);
  schedule();
})();


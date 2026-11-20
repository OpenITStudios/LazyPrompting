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
  if(!C||!M||!H||!U||!S||!L||!globalThis.chrome?.storage?.local)return;
  globalThis.__lpCompanionActive=true;
  const store=chrome.storage.local;
  let state=S.normalize(),current=null,bar=null,panel=null,context=null,chats=null,status=null;
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
    context=el("span","lp-context","Context —");
    context.title="Token estimate unavailable. If installed, the original Usage Meter supplies the estimate.";
    chats=el("span","lp-chat-count","Chat —");
    chats.title="The complete chat message count cannot be confirmed.";
    status=el("span","lp-status","");
    status.hidden=true;status.setAttribute("role","status");
    settingsButton=button("⚙",()=>openMenu(!menuOpen),"Settings");
    settingsButton.className="lp-settings-icon";
    settingsButton.title="Settings";
    strip.append(el("span","lp-brand","LP"),el("span","lp-sep"),context,
      el("span","lp-sep"),chats,status,settingsButton);
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
    if(!list.length)return {label:"Chat —",title:"No structural chat turns are currently loaded."};
    const numbers=list.map(n=>{
      const t=n.getAttribute?.("data-testid")??"";
      const m=/^conversation-turn-(\d+)$/.exec(t);
      return m?Number(m[1]):null;
    });
    const complete=numbers.every((n,i)=>n===i);
    return complete?
      {label:"Chat "+list.length+"x",title:list.length+" contiguous indexed messages loaded from the start of this chat."}:
      {label:"Chat —",title:list.length+" messages currently loaded, but complete message count is not verified."};
  }
  function refreshStatus(){
    if(!bar?.isConnected)return;
    const usage=U.observe(document);
    const tokens=usage?.tokens??null;
    context.textContent="Context "+U.format(tokens);
    context.title=tokens===null?
      "Automatic token estimate unavailable. No chat content is read.":
      "Approximate chat tokens from the separately installed Usage Meter, not the official model context limit.";
    const count=chatCount();
    chats.textContent=count.label;chats.title=count.title;
    // Only suppress the original strip while its token value is readable.
    // Leave its underlying DOM available to its original extension.
    document.documentElement.classList.toggle("lp-companion-has-meter",tokens!==null);
    const probable=L.observe(document);
    let label="",level="";
    if(usage?.limit){label="Limit hit";level="limit";}
    else if(probable?.status){
      label=probable.status==="USAGE_CAP_POSSIBLE"?"Possible usage limit":"Possible chat limit";
      level="advisory";
    }else if(tokens!==null&&tokens>=state.switchAt){label="Switch chat";level="switch";}
    else if(tokens!==null&&tokens>=state.soon){label="New chat soon";level="soon";}
    status.hidden=!label;
    status.textContent=label;
    status.dataset.level=level;
    status.title=level==="limit"?"Limit hit reported by the separate Usage Meter; confirm it in ChatGPT.":
      level==="advisory"?"Unverified ChatGPT page alert; check the original notice.":
      "Planning warning based on estimated tokens, not a confirmed model limit.";
  }
  function applyHistory(force=false){
    if(!current)return;
    const now=Date.now();
    if(!force&&now-lastCompact<1500)return;
    lastCompact=now;
    const active=document.activeElement;
    const selection=globalThis.getSelection?.()??null;
    const opts={enabled:state.compact,activeElement:active,selection};
    const compact=state.compact?M.apply(document,opts):
      {status:"OFF",pending:0,loaded:0};
    if(!state.compact)M.reset(document);
    H.apply(document,{enabled:state.compact,visibleTurns:S.visibleTurns(state),
      expanded:historyExpanded,activeElement:active,selection,
      onReveal:()=>{historyExpanded=true;applyHistory(true);}});
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
  document.addEventListener("pointerdown",event=>{
    if(menuOpen&&!panel.contains(event.target)&&!settingsButton.contains(event.target))openMenu(false);
  },true);
  document.addEventListener("keydown",event=>{
    if(menuOpen&&event.key==="Escape")openMenu(false);
  },true);
  globalThis.addEventListener("resize",positionMenu);
  globalThis.addEventListener("scroll",positionMenu,true);
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  globalThis.addEventListener("popstate",schedule);
  globalThis.addEventListener("hashchange",schedule);
  schedule();
})();


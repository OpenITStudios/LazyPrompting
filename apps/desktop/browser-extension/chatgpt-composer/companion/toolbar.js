/* LazyPrompting Companion — user-operated control strip.
 * Reads structural turn markers only; no automated transcript/output extraction.
 * Notes contain ONLY operator-authored text; no model reply is persisted.
 * Native app remains the sole owner of approved goals, sending and rollover. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionActive)return;
  globalThis.__lpCompanionActive=true;
  const C=globalThis.__lpCompanionCore;
  if(!C||!globalThis.chrome?.storage?.local)return;
  let current=null,notes=[],bar=null,panel=null,turnLabel=null,noteList=null;
  let noteInput=null,linkInput=null,notice=null,showPanel=false;
  let pending=false,lastList="",lastScanAt=0,pendingMarker=null;
  const NO_CHAT="Open an ordinary saved ChatGPT conversation.";
  const maxVisible=6;
  const node=(tag,props={},label)=>{
    const n=document.createElement(tag);
    for(const [key,value] of Object.entries(props)){
      if(key==="className")n.className=value;
      else n.setAttribute(key,String(value));
    }
    if(label!==undefined)n.textContent=label;
    return n;
  };
  const button=(label,title,callback)=>{
    const b=node("button",{type:"button",title,"aria-label":title},label);
    b.addEventListener("click",callback);
    return b;
  };
  const message=(text)=>{if(notice)notice.textContent=text;};
  function activeTurn(){
    const sel=globalThis.getSelection?.();
    let element=sel?.anchorNode?.nodeType===1?sel.anchorNode:
      sel?.anchorNode?.parentElement;
    if(element?.closest){
      for(const turn of C.turns(document))if(turn.contains(element))return turn;
    }
    const list=C.turns(document);
    return list.find(el=>el.getBoundingClientRect().top>=0)??list.at(-1)??null;
  }
  function goToTurn(el){
    if(!el?.scrollIntoView)return false;
    el.scrollIntoView({behavior:globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?
      "auto":"smooth",block:"center"});
    return true;
  }
  function step(direction){
    const list=C.turns(document);
    if(!list.length){message("No loaded turn markers. Older messages may be virtualized.");return;}
    const pivot=Math.max(0,list.findIndex(el=>el.getBoundingClientRect().bottom>100));
    const idx=Math.max(0,Math.min(list.length-1,pivot+direction));
    goToTurn(list[idx]);
    message("Navigated within currently loaded turns only.");
  }
  function refreshNotes(){
    if(!noteList)return;
    const signature=JSON.stringify(notes);
    if(signature===lastList)return;
    lastList=signature;
    noteList.replaceChildren();
    if(!notes.length){
      noteList.append(node("p",{},"No operator notes saved for this chat."));
      return;
    }
    for(const item of notes.slice(-maxVisible).reverse()){
      const row=node("div",{className:"lp-companion-note-row"});
      row.append(node("span",{title:item.note},item.note));
      row.append(button("Go","Jump to saved turn marker",()=>{
        const dest=C.turns(document).find(el=>C.turnMarker(el)===item.marker);
        if(!dest){message("Turn not loaded. Navigate or scroll the chat first.");return;}
        goToTurn(dest);
      }));
      row.append(button("×","Delete this local note",async()=>{
        notes=notes.filter(x=>x.id!==item.id);
        await saveNotes();refreshNotes();
      }));
      noteList.append(row);
    }
  }
  async function readNotes(id){
    const data=await chrome.storage.local.get(C.storageKey(id));
    return C.normalizeNotes(data?.[C.storageKey(id)]);
  }
  async function saveNotes(){
    if(!current)return;
    await chrome.storage.local.set({[C.storageKey(current)]:C.normalizeNotes(notes)});
    lastList="";refreshNotes();
  }
  async function addNote(){
    if(!current){message(NO_CHAT);return;}
    const text=C.normalizeNote(noteInput?.value);
    if(!text){message("Write a short decision note first.");return;}
    if(notes.length>=C.MAX_NOTES){message("Note limit reached. Remove an old note first.");return;}
    const marker=pendingMarker??C.turnMarker(activeTurn());
    notes=[...notes,{id:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),
      note:text,marker,at:Date.now()}];
    try{await saveNotes();noteInput.value="";pendingMarker=null;
      message(marker?"Operator note saved for this turn.":"Note saved; exact turn anchor unavailable.");
    }catch{notes.pop();message("Local note storage unavailable.");}
  }
  function copySelection(){
    const selection=globalThis.getSelection?.();
    if(!selection||selection.isCollapsed){message("Select text manually before copying.");return;}
    // Browser native Copy transfers only the human selection, not a scripted read.
    const success=document.execCommand?.("copy")===true;
    message(success?"Selection copied.":"Use Ctrl+C for the selected text.");
  }
  function exportNotes(){
    if(!current||!notes.length){message("No operator notes to export.");return;}
    const lines=["# LazyPrompting operator notes","","Chat: https://chatgpt.com/c/"+current,
      "Source: operator-authored notes; not a ChatGPT transcript or verified evidence.",""];
    for(const item of notes)lines.push("- "+item.note.replace(/\r?\n/g," "));
    const blob=new Blob([lines.join("\n")+"\n"],{type:"text/markdown;charset=utf-8"});
    const u=URL.createObjectURL(blob),a=node("a",{href:u,download:"lp-notes-"+current+".md"});
    a.click();URL.revokeObjectURL(u);
    message("Operator notes exported; no chat transcript was read.");
  }
  function openForReview(){
    const url=C.safeReviewUrl(linkInput?.value);
    if(!url){message("Enter one valid public HTTPS link for manual review.");return;}
    const view=globalThis.open?.(url,"_blank","noopener,noreferrer");
    message(view===null?"Review the new-tab offer in LazyPrompting.":"Source opened for manual review. Relevance is not verified.");
  }
  function createUI(){
    bar=node("div",{id:"lp-companion",className:"lp-companion",
      role:"group","aria-label":"LazyPrompting Companion"});
    const title=node("span",{className:"lp-companion-title"},"LP");
    turnLabel=node("span",{className:"lp-companion-count",
      title:"Loaded turn nodes only. Not all chat tokens."},"Chat · —");
    const prev=button("‹","Previous loaded turn",()=>step(-1));
    const next=button("›","Next loaded turn",()=>step(1));
    const mark=button("Bookmark","Add an operator decision note",()=>{
      pendingMarker=C.turnMarker(activeTurn());setExpanded(true);
    });
    const copy=button("Copy","Copy your manual text selection",copySelection);
    const more=button("More","Show or hide Companion controls",()=>setExpanded(!showPanel));
    panel=node("div",{className:"lp-companion-panel"});
    panel.hidden=true;
    const line1=node("div",{className:"lp-companion-field"});
    noteInput=node("input",{type:"text",maxlength:"160",placeholder:"Decision or constraint (your own note)",
      "aria-label":"Operator decision note"});
    line1.append(noteInput,button("Save","Save note for selected/current turn",()=>void addNote()));
    noteList=node("div",{className:"lp-companion-notes"});
    const line2=node("div",{className:"lp-companion-field"});
    linkInput=node("input",{type:"url",placeholder:"https://reference.example",
      "aria-label":"HTTPS link to review"});
    line2.append(linkInput,button("Open link","Open link for manual source review",openForReview));
    notice=node("p",{role:"status",className:"lp-companion-notice"});
    const hint=node("p",{className:"lp-companion-hint"},
      "Token estimate and New Chat recovery: LazyPrompting Work. Turn count is partial. Notes are local, not verified project decisions.");
    const actions=node("div",{className:"lp-companion-field"});
    actions.append(button("Export notes","Download your local notes, not ChatGPT messages",exportNotes));
    panel.append(node("span",{className:"lp-companion-heading"},"Decision bookmarks"),
      line1,noteList,node("span",{className:"lp-companion-heading"},"Source review"),
      line2,actions,hint,notice);
    bar.append(title,turnLabel,prev,next,mark,copy,more,panel);
  }
  function setExpanded(value){
    showPanel=!!value;
    if(panel)panel.hidden=!showPanel;
    if(showPanel){refreshNotes();noteInput?.focus();}
  }
  async function syncChat(){
    const id=C.safeChatId(location.href);
    if(id!==current){
      current=id;notes=[];lastList="";pendingMarker=null;
      if(showPanel)setExpanded(false);
      if(id){
        try{const loaded=await readNotes(id);
          if(current===id){notes=loaded;lastList="";refreshNotes();}
        }catch{message("Bookmark storage unavailable.");}
      }
    }
    if(!id){
      bar?.remove();return;
    }
    const editor=document.querySelector('#prompt-textarea,[data-testid="composer-text-input"]');
    const anchor=editor?.closest("form")??editor?.parentElement;
    if(anchor?.parentNode&&bar.parentNode!==anchor.parentNode)anchor.before(bar);
    if(turnLabel){
      const count=C.turns(document).length;
      const msg="Chat · "+count+" shown";
      if(turnLabel.textContent!==msg)turnLabel.textContent=msg;
    }
  }
  function schedule(){
    if(pending)return;
    pending=true;
    // One trailing coalesced refresh: cannot miss a quiet SPA route change.
    const delay=Math.max(0,750-(Date.now()-lastScanAt));
    setTimeout(()=>{lastScanAt=Date.now();pending=false;void syncChat();},delay);
  }
  // Attach once even on ChatGPT home; its SPA may navigate to /c/<id>
  // without reloading the extension. Mounting is restricted by safeChatId().
  createUI();
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  globalThis.addEventListener("popstate",schedule);
  globalThis.addEventListener("hashchange",schedule);
  schedule();
})();

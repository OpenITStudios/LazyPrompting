/* Helium standalone-only manual ChatGPT chat length advisory.
 * No private ChatGPT API, transcript, DOM extraction, or site send control. */
(() => {
  "use strict";
  if(globalThis.__lpHeliumMeter)return;
  const PREFIX="lp-helium-reported-tokens:", MAX=100_000_000;
  const THRESHOLDS=Object.freeze({checkpoint:3_200_000,move:3_600_000,stop:4_000_000});
  const key=id=>PREFIX+id;
  const parse=input=>{
    if(typeof input!=="string"||input.length>160)return null;
    const v=input.trim().replace(/^Chat\s*/i,"").replace(/\s+tokens?$/i,"").trim();
    const short=/^~?(\d{1,3}(?:\.\d{1,2})?)\s*([kKmM])$/.exec(v);
    const num=short?Math.round(Number(short[1])*(short[2].toLowerCase()==="m"?1_000_000:1_000))
      :/^(?:\d{1,9}|\d{1,3}(?:,\d{3})+)$/.test(v)?Number(v.replace(/,/g,"")):NaN;
    return Number.isSafeInteger(num)&&num>=0&&num<=MAX?num:null;
  };
  const stage=n=>!Number.isSafeInteger(n)||n<=0||n>MAX?"UNKNOWN":
    n>=THRESHOLDS.stop?"STOP_PLAN":n>=THRESHOLDS.move?"MOVE_SOON":
    n>=THRESHOLDS.checkpoint?"CHECKPOINT":"TRACKED";
  const el=(tag,attrs={},label)=>{
    const e=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
    if(label!==undefined)e.textContent=label;
    return e;
  };
  let current=null,count=null,busy=false,revision=0,readout=null,input=null,notice=null,saveButton=null,clearButton=null;
  function render(){
    if(!readout)return;
    const s=stage(count);
    readout.setAttribute("data-stage",s);
    readout.textContent=s==="UNKNOWN"?"Chat size: not reported":
      (s==="STOP_PLAN"?"4M planning stop · ":s==="MOVE_SOON"?"New Chat due · ":
       s==="CHECKPOINT"?"Checkpoint advised · ":"Chat ~")+
      new Intl.NumberFormat("en-US").format(count);
    readout.title="Operator-reported only. No official ChatGPT limit measured; no Send blocking in Helium.";
    saveButton.disabled=busy||!current;
    clearButton.disabled=busy||!current||count===null;
  }
  function mount(bar,panel){
    if(readout||!bar||!panel)return;
    const old=bar.querySelector(".lp-companion-target");
    if(old)old.hidden=true;
    readout=el("span",{class:"lp-helium-readout",role:"status"},"Chat size: not reported");
    const chat=bar.querySelector(".lp-companion-chat");
    if(!chat)return;
    chat.append(readout);
    const section=el("section",{class:"lp-helium-controls","aria-label":"Helium chat length"});
    const caption=el("span",{class:"lp-companion-heading"},"Helium · chat estimate");
    const hint=el("p",{class:"lp-companion-hint"},"Manually report an external estimate; stored locally per chat. Compact History defaults on.");
    const controls=el("div",{class:"lp-companion-field"});
    input=el("input",{type:"text",maxlength:160,placeholder:"Chat ~3.60M or 3,600,000","aria-label":"Reported chat tokens"});
    saveButton=el("button",{type:"button"},"Save");
    clearButton=el("button",{type:"button"},"Clear");
    notice=el("p",{class:"lp-companion-hint",role:"status"},"");
    saveButton.addEventListener("click",()=>{void save();});
    clearButton.addEventListener("click",()=>{void clear();});
    controls.append(input,saveButton,clearButton);
    section.append(caption,hint,controls,el("p",{class:"lp-companion-hint"},
      "3.2M checkpoint · 3.6M prepare new chat · 4M move chat. This is advisory and cannot block ChatGPT Send."),notice);
    panel.prepend(section);
    render();
  }
  async function sync(id){
    if(id===current)return;
    current=id;count=null;revision++;
    const seen=revision;
    if(input)input.value="";
    if(notice)notice.textContent="";
    render();
    if(!id)return;
    try{
      const result=await chrome.storage.local.get(key(id));
      if(current!==id||revision!==seen)return;
      const n=result?.[key(id)];
      count=Number.isSafeInteger(n)&&n>0&&n<=MAX?n:null;
      if(input&&count!==null)input.value=String(count);
      render();
    }catch{
      if(current===id&&revision===seen&&notice)notice.textContent="Local estimate unavailable.";
    }
  }
  async function save(){
    if(busy||!current||!input)return;
    const value=parse(input.value);
    if(value===null||value===0){if(notice)notice.textContent="Use 3.60M or 3,600,000.";return;}
    const id=current;revision++;busy=true;render(); // invalidate a stale per-chat read
    try{
      await chrome.storage.local.set({[key(id)]:value});
      if(current===id){count=value;notice.textContent="Local estimate saved for this chat.";}
    }catch{if(current===id&&notice)notice.textContent="Estimate not saved.";}
    finally{busy=false;render();}
  }
  async function clear(){
    if(busy||!current)return;
    const id=current;revision++;busy=true;render(); // invalidate a stale per-chat read
    try{
      await chrome.storage.local.remove(key(id));
      if(current===id){count=null;if(input)input.value="";notice.textContent="Local estimate cleared.";}
    }catch{if(current===id&&notice)notice.textContent="Estimate not cleared.";}
    finally{busy=false;render();}
  }
  globalThis.__lpHeliumMeter=Object.freeze({mount,sync,parse,stage,key,preferCompact:true,THRESHOLDS});
})();


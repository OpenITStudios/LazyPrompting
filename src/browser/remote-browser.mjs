import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Browser navigation is restricted to explicit public HTTPS origins. No ChatGPT Web automation.
const prohibited = new Set(["chatgpt.com","www.chatgpt.com","chat.openai.com","auth.openai.com"]);
function privateAddress(ip) {
  if (ip.includes(":")) return true; // deny IPv6 until a complete IPv6 classifier is reviewed
  const p=ip.split(".").map(Number);
  return p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255)||
    p[0]===0||p[0]===10||p[0]===127||p[0]>=224||
    (p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||
    (p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||
    (p[0]===192&&p[1]===0)||(p[0]===198&&[18,19].includes(p[1]))||
    (p[0]===192&&p[1]===0&&p[2]===2)||
    (p[0]===198&&p[1]===51&&p[2]===100)||
    (p[0]===203&&p[1]===0&&p[2]===113);
}
export class RemoteBrowser {
  constructor({allowedOrigins,headless=true}={}) {
    if(!Array.isArray(allowedOrigins)||allowedOrigins.length===0) throw new Error("EXPLICIT_ORIGIN_ALLOWLIST_REQUIRED");
    this.allowed=new Set(allowedOrigins.map(x=>{
      const u=new URL(x);
      if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash) throw new Error("INVALID_ALLOWED_ORIGIN");
      if(prohibited.has(u.hostname)||isIP(u.hostname)) throw new Error("PROHIBITED_ORIGIN");
      return u.origin;
    }));
    this.headless=headless;
    this.browser=null;this.context=null;this.page=null;
  }
  async validate(target){
    const u=new URL(target);
    if(u.protocol!=="https:"||u.username||u.password||!this.allowed.has(u.origin)||prohibited.has(u.hostname)||isIP(u.hostname))
      throw new Error("ORIGIN_DENIED");
    const addresses=await lookup(u.hostname,{all:true,verbatim:true});
    if(!addresses.length||addresses.some(x=>privateAddress(x.address)))throw new Error("UNSAFE_DNS_RESULT");
    return u.toString();
  }
  async start(){
    if(this.browser)throw new Error("ALREADY_STARTED");
    const {chromium}=await import("playwright");
    this.browser=await chromium.launch({headless:this.headless});
    this.context=await this.browser.newContext({acceptDownloads:false,serviceWorkers:"block",permissions:[]});
    this.page=await this.context.newPage();
    await this.page.route("**/*",async route=>{
      try {
        await this.validate(route.request().url());
        // Browser DNS is independently resolved after this check: host/network egress policy is still required.
        await route.continue();
      }catch{await route.abort();}
    });
    return {state:"STARTED",allowedOrigins:[...this.allowed]};
  }
  async navigate(url){
    if(!this.page)throw new Error("BROWSER_NOT_STARTED");
    await this.page.goto(await this.validate(url),{waitUntil:"domcontentloaded",timeout:15000});
    await this.validate(this.page.url());
    return {url:this.page.url(),title:(await this.page.title()).slice(0,300)};
  }
  async snapshot(){
    if(!this.page)throw new Error("BROWSER_NOT_STARTED");
    return {url:this.page.url(),title:(await this.page.title()).slice(0,300),
      text:(await this.page.locator("body").innerText({timeout:5000})).slice(0,12000)};
  }
  async close(){
    try{await this.browser?.close();}finally{this.browser=null;this.context=null;this.page=null;}
  }
}

// Optional browser adapter: localhost test pages only. Not an MCP tool and not active by default.
// Playwright is intentionally loaded only when explicitly called, and is not bundled here.
export class LocalBrowserAdapter {
  constructor({allowedOrigins=["http://127.0.0.1","http://localhost"]}={}){
    if(!Array.isArray(allowedOrigins)||!allowedOrigins.length)throw new TypeError("Allowed origins required");
    this.allowedOrigins=new Set(allowedOrigins.map(x=>new URL(x).origin));
    this.browser=null;
    this.page=null;
  }
  assertAllowed(target){
    const url=new URL(target);
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password||!this.allowedOrigins.has(url.origin))
      throw new Error("BROWSER_ORIGIN_DENIED");
    if(url.hostname!=="localhost"&&url.hostname!=="127.0.0.1")throw new Error("BROWSER_HOST_DENIED");
    return url.toString();
  }
  async start(){
    if(this.browser)throw new Error("BROWSER_ALREADY_STARTED");
    const {chromium}=await import("playwright");
    this.browser=await chromium.launch({headless:true});
    this.page=await this.browser.newPage();
    await this.page.route("**/*",route=>{
      try{this.assertAllowed(route.request().url());return route.continue();}
      catch{return route.abort();}
    });
    return {status:"STARTED",scope:"LOCAL_TEST_ORIGINS_ONLY"};
  }
  async open(url){
    if(!this.page)throw new Error("BROWSER_NOT_STARTED");
    return {url:await this.page.goto(this.assertAllowed(url),{waitUntil:"domcontentloaded",timeout:10000}).then(()=>this.page.url())};
  }
  async title(){
    if(!this.page)throw new Error("BROWSER_NOT_STARTED");
    return this.page.title();
  }
  async close(){
    if(this.browser)await this.browser.close();
    this.browser=null;this.page=null;
  }
}

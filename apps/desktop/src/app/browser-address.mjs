export function resolveBrowserAddress(value) {
  const input=value.trim();
  if(!input)return null;

  const local=/^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?=[:/?#]|$)/i;
  const host=/^(?:[^\s/:?#]+\.[^\s/:?#]+|\[[\da-f:]+\])(?=[:/?#]|$)/i;
  const explicit=/^https?:\/\//i.test(input);
  const localAddress=local.test(input);
  const hostAddress=host.test(input);
  if(explicit||localAddress||hostAddress){
    try{
      const address=new URL(explicit?input:`${localAddress?"http":"https"}://${input}`);
      return address.username||address.password?null:address.href;
    }catch{return null;}
  }
  // Never turn a disallowed protocol or a credential-bearing address into a query.
  if(/^[a-z][a-z\d+.-]*:/i.test(input)||input.includes("://"))return null;
  const search=new URL("https://www.bing.com/search");
  search.searchParams.set("q",input);
  return search.href;
}

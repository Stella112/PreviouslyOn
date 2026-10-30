type Options = {clientId:string; getAccessToken:()=>string; refresh:()=>Promise<void>; fetcher?:typeof fetch; sleep?:(ms:number)=>Promise<void>; now?:()=>number};
export class HelixClient {
 constructor(private options: Options) {}
 async request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid Helix path');
  let refreshed = false; let retries = 0;
  for (;;) {
   const headers = new Headers(init.headers); headers.set('Client-Id',this.options.clientId); headers.set('Authorization',`Bearer ${this.options.getAccessToken()}`);
   const response = await (this.options.fetcher ?? fetch)(`https://api.twitch.tv/helix${path}`,{...init,headers});
   if (response.status === 401 && !refreshed) { await this.options.refresh(); refreshed = true; continue; }
   if ((response.status === 429 || response.status >= 500) && retries < 3) {
    const reset = Number(response.headers.get('Ratelimit-Reset')); const now = (this.options.now ?? Date.now)();
    const delay = response.status === 429 && reset > 0 ? Math.max(0,reset*1000-now)+1000 : 1000 * 2**retries;
    retries++; await (this.options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve,ms))))(delay); continue;
   }
   return response;
  }
 }
}

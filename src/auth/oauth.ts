import { config, scopes } from '../config.js';
import { clearToken, getToken, saveToken, type Token } from '../db.js';
type Grant = { access_token: string; refresh_token: string; expires_in: number; scope: string[] };
type Validated = { client_id: string; user_id: string; login: string; scopes: string[]; expires_in: number };
async function grant(body: URLSearchParams): Promise<Grant> {
 const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body });
 if (!response.ok) throw new Error(`Twitch token request failed (${response.status})`);
 return await response.json() as Grant;
}
async function validate(access: string): Promise<{status: number; value?: Validated}> {
 const response = await fetch('https://id.twitch.tv/oauth2/validate', { headers: {Authorization:`Bearer ${access}`} });
 if (!response.ok) return {status: response.status};
 return {status: response.status, value: await response.json() as Validated};
}
function credentials(): Record<string,string> { return {client_id:config.clientId,client_secret:config.clientSecret}; }
export function authorizeUrl(state: string): string {
 const params = new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:scopes.join(' '),state});
 return `https://id.twitch.tv/oauth2/authorize?${params}`;
}
export async function exchange(code: string): Promise<void> {
 const result = await grant(new URLSearchParams({...credentials(),code,grant_type:'authorization_code',redirect_uri:config.redirectUri}));
 const check = await validate(result.access_token);
 if (!check.value || check.value.client_id !== config.clientId || !check.value.user_id || !check.value.login) throw new Error('Twitch token validation failed');
 saveToken({user_id:check.value.user_id,login:check.value.login,access_token:result.access_token,refresh_token:result.refresh_token,scopes:JSON.stringify(check.value.scopes),expires_at:Date.now()+check.value.expires_in*1000});
}
let refreshing: Promise<Token> | undefined;
export function refresh(): Promise<Token> {
 if (refreshing) return refreshing;
 refreshing = (async () => {
  const old = getToken(); if (!old) throw new Error('Not logged in');
  const result = await grant(new URLSearchParams({...credentials(),grant_type:'refresh_token',refresh_token:old.refresh_token}));
  const updated = {...old,access_token:result.access_token,refresh_token:result.refresh_token,scopes:JSON.stringify(result.scope),expires_at:Date.now()+result.expires_in*1000};
  saveToken(updated); return updated;
 })().finally(() => { refreshing = undefined; });
 return refreshing;
}
export async function validateSession(): Promise<void> {
 const token = getToken(); if (!token) return;
 const result = await validate(token.access_token);
 if (result.status === 401) { clearToken(); console.warn('Twitch session invalid; log in again.'); return; }
 if (!result.value) throw new Error(`Twitch validation failed (${result.status})`);
 if (result.value.client_id !== config.clientId || result.value.user_id !== token.user_id) { clearToken(); throw new Error('Twitch token identity mismatch; log in again'); }
 saveToken({...token,login:result.value.login,scopes:JSON.stringify(result.value.scopes),expires_at:Date.now()+result.value.expires_in*1000});
}

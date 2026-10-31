import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { EventSubClient, subscriptions } from '../src/eventsub/client.js';
import { parseMessage, normalize, Deduper } from '../src/eventsub/messages.js';
class Socket extends EventEmitter {
 readyState=1; closed=false;
 close(){this.closed=true; this.readyState=3; this.emit('close');}
 terminate(){this.close();}
 message(type:string,payload:object,id='id'){this.emit('message',Buffer.from(JSON.stringify({metadata:{message_id:id,message_type:type,message_timestamp:'2026-01-01T00:00:00Z'},payload})));}
}
const welcome={session:{id:'session',keepalive_timeout_seconds:10}};
describe('EventSub',()=>{
 it('parses and normalizes chat emotes and badges',()=>{
  const msg=parseMessage(JSON.stringify({metadata:{message_id:'1',message_type:'notification',message_timestamp:'now'},payload:{subscription:{type:'channel.chat.message'},event:{chatter_user_name:'A',message:{text:'hi Kappa',fragments:[{type:'emote',text:'Kappa'}]},badges:[{set_id:'moderator'}]}}}))!;
  expect(normalize(msg)).toMatchObject({type:'channel.chat.message',userName:'A',emotes:['Kappa'],badges:['moderator']});
  expect(parseMessage('bad')).toBeUndefined();
 });
 it('deduplicates notification IDs',()=>{const d=new Deduper(); expect(d.accept('a')).toBe(true); expect(d.accept('a')).toBe(false); expect(d.accept('b')).toBe(true);});
 it('uses documented conditions and follow version',()=>{ expect(subscriptions('42')).toHaveLength(5); expect(subscriptions('42')[2]).toEqual({type:'channel.follow',version:'2',condition:{broadcaster_user_id:'42',moderator_user_id:'42'}}); });
 it('moves directed reconnect without resubscribing',async()=>{
  const sockets:Socket[]=[]; const urls:string[]=[]; const subscribe=vi.fn(async()=>{});
  const c=new EventSubClient(subscribe,'42',()=>{},()=>{},url=>{urls.push(url); const ws=new Socket(); sockets.push(ws); return ws as unknown as WebSocket;});
  c.start(); sockets[0].message('session_welcome',welcome); await vi.waitFor(()=>expect(subscribe).toHaveBeenCalledTimes(5));
  sockets[0].message('session_reconnect',{session:{reconnect_url:'wss://eventsub.wss.twitch.tv?session=2'}});
  expect(sockets[0].closed).toBe(false); expect(urls).toHaveLength(2);
  sockets[1].message('session_welcome',welcome); expect(sockets[0].closed).toBe(true); expect(subscribe).toHaveBeenCalledTimes(5); c.stop();
 });
 it('resubscribes after an unexpected disconnect',async()=>{
  vi.useFakeTimers();
  const sockets:Socket[]=[]; const subscribe=vi.fn(async()=>{});
  const c=new EventSubClient(subscribe,'42',()=>{},()=>{},()=>{const ws=new Socket(); sockets.push(ws); return ws as unknown as WebSocket;});
  c.start(); sockets[0].message('session_welcome',welcome); for(let i=0;i<6;i++) await Promise.resolve();
  expect(subscribe).toHaveBeenCalledTimes(5); sockets[0].close(); await vi.advanceTimersByTimeAsync(1000); expect(sockets).toHaveLength(2);
  sockets[1].message('session_welcome',welcome); for(let i=0;i<6;i++) await Promise.resolve(); expect(subscribe).toHaveBeenCalledTimes(10); c.stop(); vi.useRealTimers();
 });
});

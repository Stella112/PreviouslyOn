import { randomUUID } from 'node:crypto';
import { addEvent } from '../eventsub/runtime.js';
export function demoEvent(type:string): void {
 const examples: Record<string,{user:string;text:string;emotes:string[]}> = {
  chat:{user:'viewer_demo',text:'That was amazing!',emotes:[]},
  emote:{user:'viewer_demo',text:'PogChamp PogChamp',emotes:['PogChamp','PogChamp']},
  raid:{user:'raider_demo',text:'SIMULATED raid',emotes:[]},
  follow:{user:'follower_demo',text:'SIMULATED follow',emotes:[]},
  online:{user:'',text:'SIMULATED stream online',emotes:[]},
  offline:{user:'',text:'SIMULATED stream offline',emotes:[]}
 };
 const e=examples[type]; if (!e) return;
 addEvent({id:randomUUID(),type:`demo.${type}`,at:new Date().toISOString(),userName:e.user,text:e.text,emotes:e.emotes,badges:[],data:{},simulated:true});
}
export function startDemo(): void { let i=0; const events=['chat','chat','emote','chat','raid','follow']; setInterval(()=>demoEvent(events[i++%events.length]),5000).unref(); }

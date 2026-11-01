import {getEpisode} from '../episodes/editor.js';
type State={playing:boolean;id?:string;episode?:unknown;startedAt?:number};
let state:State={playing:false};let timer:NodeJS.Timeout|undefined;
export function playbackState():State{return state;}
export function playEpisode(id:number):boolean {const episode=getEpisode(id);if(!episode||!episode.moments.length)return false;clearTimeout(timer);state={playing:true,id:crypto.randomUUID(),episode,startedAt:Date.now()};timer=setTimeout(()=>{state={playing:false}},Math.ceil(episode.total_seconds*1000)+5000);timer.unref();return true;}
export function stopPlayback():void {clearTimeout(timer);state={playing:false};}

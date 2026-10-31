import type {TwitchClip} from './api.js';
export async function createAndPoll(create:()=>Promise<string>,get:(id:string)=>Promise<TwitchClip|undefined>,sleep:(ms:number)=>Promise<void>,timeoutMs=60000):Promise<TwitchClip> {
 for(let attempt=0;attempt<2;attempt++) {
  const id=await create();
  for(let elapsed=0;elapsed<=timeoutMs;elapsed+=3000) {
   const clip=await get(id);if(clip)return clip;
   if(elapsed<timeoutMs) await sleep(Math.min(3000,timeoutMs-elapsed));
  }
 }
 throw new Error('Clip did not appear after two attempts');
}

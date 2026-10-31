import { mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { isMp4 } from './logic.js';
import { randomUUID } from 'node:crypto';
export async function downloadMedia(url:string,fetcher:typeof fetch=fetch):Promise<string> {
 const parsed=new URL(url);if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.port || !/(^|\.)twitchcdn\.net$/i.test(parsed.hostname)) throw new Error('Untrusted clip download URL');
 const response=await fetcher(url,{redirect:'error'});if(!response.ok || !response.body)throw new Error(`Clip download failed (HTTP ${response.status})`);
 await mkdir('data/media',{recursive:true});const name=`${randomUUID()}.mp4`;const dest=join('data','media',name);const temp=dest+'.part';
 const file=await open(temp,'wx');let size=0;let prefix=Buffer.alloc(0);
 try {
  for await(const chunk of response.body) {const data=Buffer.from(chunk);size+=data.length;if(size>200*1024*1024)throw new Error('Clip download exceeds size limit');if(prefix.length<12)prefix=Buffer.concat([prefix,data]).subarray(0,12);await file.writeFile(data);}
  if(!isMp4(prefix))throw new Error('Downloaded media is not a valid MP4');
  await file.close();await rename(temp,dest);return dest;
 } catch(e){await file.close().catch(()=>{});await rm(temp,{force:true});throw e;}
}

import {describe,it,expect} from 'vitest';
import {isMp4,nearestMoment,recapLink} from '../src/clips/logic.js';
import {createAndPoll} from '../src/clips/poll.js';
import {vi} from 'vitest';
import {downloadMedia} from '../src/clips/media.js';
import {readFile,rm} from 'node:fs/promises';
import {ClipsApi} from '../src/clips/api.js';
import type {HelixClient} from '../src/twitch/helix.js';
describe('clip helpers',()=>{
 it('matches nearest moment within the capture window',()=>{const moments=[{id:1,peak_at:'2026-01-01T00:00:00Z'},{id:2,peak_at:'2026-01-01T00:01:00Z'}];expect(nearestMoment({id:'c',created_at:'2026-01-01T00:00:50Z'},moments)).toBe(2);expect(nearestMoment({id:'c',created_at:'2026-01-01T00:05:00Z'},moments)).toBeUndefined();});
 it('uses VOD links only when the offset and id are valid',()=>{expect(recapLink('123',42.5,'clip')).toBe('https://www.twitch.tv/videos/123?t=42s');expect(recapLink('123',null,'clip')).toBe('clip');});
 it('checks for an MP4 file signature',()=>{expect(isMp4(new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109]))).toBe(true);expect(isMp4(new Uint8Array([0,0,0,0]))).toBe(false);});
 it('polls until a clip appears and does not create a duplicate',async()=>{const create=vi.fn(async()=> 'id');const get=vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({id:'id'});const sleep=vi.fn(async()=>{});expect(await createAndPoll(create,get,sleep,6000)).toMatchObject({id:'id'});expect(create).toHaveBeenCalledTimes(1);expect(sleep).toHaveBeenCalledWith(3000);});
 it('retries creation once only after the poll timeout',async()=>{const create=vi.fn(async()=> 'id');const get=vi.fn(async()=>undefined);const sleep=vi.fn(async()=>{});await expect(createAndPoll(create,get,sleep,6000)).rejects.toThrow('two attempts');expect(create).toHaveBeenCalledTimes(2);expect(sleep).toHaveBeenCalledTimes(4);});
 it('stores an MP4 and rejects invalid or untrusted media',async()=>{const data=new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109]);const fetcher=vi.fn(async()=>new Response(data));const path=await downloadMedia('https://assets.twitchcdn.net/test',fetcher as typeof fetch);try{expect(await readFile(path)).toEqual(Buffer.from(data));}finally{await rm(path,{force:true});}await expect(downloadMedia('https://example.com/test',fetcher as typeof fetch)).rejects.toThrow('Untrusted');await expect(downloadMedia('https://assets.twitchcdn.net/test',vi.fn(async()=>new Response('not an mp4')) as typeof fetch)).rejects.toThrow('valid MP4');});
 it('uses the portrait download if Twitch has no landscape version',async()=>{const request=vi.fn(async()=>new Response(JSON.stringify({data:[{landscape_download_url:null,portrait_download_url:'https://example.cloudfront.net/clip'}]})));const api=new ClipsApi({request} as unknown as HelixClient,'123');expect(await api.downloadUrl('clip')).toBe('https://example.cloudfront.net/clip');});
});

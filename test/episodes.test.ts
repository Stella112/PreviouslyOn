import {describe,it,expect} from 'vitest';
import {rank,trim,totalSeconds,type Candidate,type EpisodeMoment} from '../src/episodes/logic.js';
import {caption,fallbackCaption,validCaption} from '../src/captions/captions.js';
const base:Candidate={clipId:1,localPath:'/media/x.mp4',duration:30,requestedAt:'2026-01-01T00:01:00Z',peakAt:'2026-01-01T00:00:55Z',score:4,trigger:'auto',reason:'spike',creditUser:null,creditKind:null,sampleMessages:[]};
describe('episode drafts',()=>{
 it('boosts manual moments and skips unplayable clips',()=>{const result=rank([base,{...base,clipId:2,score:1,trigger:'banger'},{...base,clipId:3,localPath:''}]);expect(result.map(x=>x.clipId)).toEqual([2,1]);});
 it('clamps estimated trims to available media',()=>{expect(trim(base)).toEqual({inPoint:16.5,outPoint:23.5,checkTrim:true});expect(trim({...base,duration:4})).toEqual({inPoint:0,outPoint:4,checkTrim:true});});
 it('calculates title, clips, credits and teaser time',()=>{const item={inPoint:0,outPoint:7} as EpisodeMoment;expect(totalSeconds([item,item,item])).toBe(31);});
 it('uses a safe fallback without an API key',async()=>{expect(await caption('x',[],undefined,undefined)).toBe(fallbackCaption());expect(validCaption('invented claim')).toBe(false);});
});

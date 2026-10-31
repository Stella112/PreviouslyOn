import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {MomentEngine,type Input,type Moment,type Settings} from '../src/moments/engine.js';
const settings=(JSON.parse(readFileSync('config.json','utf8')) as {moments:Settings}).moments;
describe('moment engine',()=>{
 for(const name of ['quiet','spike','raid']) it(`scores ${name} fixture`,()=>{
  const fixture=JSON.parse(readFileSync(`test/fixtures/${name}.json`,'utf8')) as {events:Input[],end:number,expected:Partial<Moment>[]};
  const moments:Moment[]=[]; const engine=new MomentEngine(settings,(m,merged)=>{if(merged) moments[moments.length-1]=m;else moments.push(m);});
  fixture.events.forEach(e=>engine.ingest(e));engine.advance(fixture.end);
  expect(moments).toHaveLength(fixture.expected.length);fixture.expected.forEach((e,i)=>expect(moments[i]).toMatchObject(e));
 });
 it('merges within cooldown and accepts later events',()=>{const ms:Moment[]=[];const e=new MomentEngine(settings,(m,merged)=>{if(merged)ms[ms.length-1]=m;else ms.push(m);});e.mark(100000,'hotkey');e.mark(110000,'hotkey');e.mark(180000,'hotkey');expect(ms).toHaveLength(2);});
 it('enforces per-user and global banger cooldowns',()=>{const ms:Moment[]=[];const e=new MomentEngine(settings,(m,merged)=>{if(!merged)ms.push(m);});for(const at of [100000,140000,230000])e.ingest({at,type:'channel.chat.message',userId:'a',userName:'A',text:'!banger',emotes:[]});expect(ms).toHaveLength(2);expect(ms[0].creditUser).toBe('A');});
});

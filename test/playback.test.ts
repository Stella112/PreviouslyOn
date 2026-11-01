import {describe,it,expect} from 'vitest';
import {PlaybackGuard} from '../src/playback/state.js';
describe('playback guard',()=>{
 it('blocks concurrent playback and repeat automatic playback in a session',()=>{const g=new PlaybackGuard();expect(g.start('stream1',true)).toBe(true);expect(g.start('stream1',false)).toBe(false);g.stop();expect(g.start('stream1',true)).toBe(false);expect(g.start('stream1',false)).toBe(true);g.stop();expect(g.start('stream2',true)).toBe(true);});
 it('requires a session for automatic playback',()=>{const g=new PlaybackGuard();expect(g.start(undefined,true)).toBe(false);expect(g.start(undefined,false)).toBe(true);g.stop();expect(g.start('new',true)).toBe(true);});
});

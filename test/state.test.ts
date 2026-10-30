import {describe,it,expect} from 'vitest';
import {newState,validState} from '../src/auth/state.js';
describe('OAuth state',()=>{ it('accepts only an exact random state',()=>{const s=newState(); expect(validState(s,s)).toBe(true); expect(validState(s,newState())).toBe(false); expect(validState(undefined,s)).toBe(false); expect(validState('a','a')).toBe(false);}); });

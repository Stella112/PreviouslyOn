import {describe,it,expect} from 'vitest';
import {validateEdit} from '../src/episodes/validation.js';
const allowed=new Map([[1,{path:'/media/test.mp4',duration:10}]]);
const m={clipId:1,localPath:'/media/test.mp4',inPoint:0,outPoint:7,caption:'A moment',checkTrim:true};
describe('Studio validation',()=>{
 it('accepts an editable episode with an allowed clip',()=>expect(validateEdit({title:'Previously',teaser:'Tonight',moments:[m],alternates:[]},allowed)).toBe(true));
 it('rejects out-of-range trim, duplicate clips, and untrusted paths',()=>{for(const moments of [[{...m,outPoint:11}],[m,m],[{...m,localPath:'https://example.com'}]])expect(validateEdit({title:'Previously',teaser:'',moments,alternates:[]},allowed)).toBe(false);});
 it('rejects oversized text and invalid credits',()=>{expect(validateEdit({title:'x',teaser:'x'.repeat(61),moments:[m],alternates:[]},allowed)).toBe(false);expect(validateEdit({title:'x',teaser:'',moments:[{...m,credit:{userName:'bad name',kind:'called_it'}}],alternates:[]},allowed)).toBe(false);});
});

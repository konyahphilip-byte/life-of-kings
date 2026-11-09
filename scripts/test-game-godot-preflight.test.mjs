import {describe,it,expect} from 'vitest';
import {verifyNativeFixtureResult} from './test-game-godot-preflight.mjs';
const intended='ERROR: Parse Error: Parse error. [Resource file res://scenes/main.tscn:3]\nERROR: Failed loading resource: res://scenes/main.tscn.\n';
const finished={status:0,signal:null,stdout:'Godot Engine v4.7.2\n',stderr:''};
describe('trusted native fixture acceptance',()=>{
 it('accepts a completed clean positive import',()=>expect(verifyNativeFixtureResult(finished,false).errors).toBe(false));
 it('accepts only the completed expected negative scene failure',()=>expect(verifyNativeFixtureResult({...finished,stderr:intended},true).errors).toBe(true));
 it.each([
 ['timeout',{error:Object.assign(new Error('timed out'),{code:'ETIMEDOUT'})}],
 ['signal',{status:null,signal:'SIGTERM'}],
 ['nonzero',{status:1}],
 ['unrelated error',{stderr:'ERROR: Could not create editor cache.\n'}],
 ['wrong source line',{stderr:intended.replace('tscn:3','tscn:8')}],
 ['wrong source file',{stderr:intended.replaceAll('main.tscn','other.tscn')}],
 ['additional unrelated error',{stderr:intended+'ERROR: Could not create editor cache.\n'}],
 ])('rejects %s rather than reporting a native pass',(_label,delta)=>expect(()=>verifyNativeFixtureResult({...finished,stderr:intended,...delta},true)).toThrow());
 it('rejects errors during a positive import',()=>expect(()=>verifyNativeFixtureResult({...finished,stderr:intended},false)).toThrow());
});

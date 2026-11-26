import {describe,it,expect,beforeAll,vi} from 'vitest';
import {parse,type AnyNode} from 'postcss';
let css:string;
beforeAll(async()=>{
 const {readFileSync}=await vi.importActual<{readFileSync:(path:string,encoding:'utf8')=>string}>('node:fs');
 css=readFileSync('src/modules/marketplace/m01-studio.css','utf8');
});

// Source-palette regression; actual browser-computed cascade is verified separately.
function properties(theme:'light'|'dark',selector:string){
 const result:Record<string,string>={};
 parse(css).walkRules(rule=>{
  if(!rule.selector.split(',').map(s=>s.trim()).includes(selector))return;
  for(let parent:AnyNode|undefined=rule.parent;parent;parent=parent.parent){
   if(parent.type==='atrule'&&parent.name==='media'&&!(theme==='dark'&&parent.params==='(prefers-color-scheme:dark)'))return;
  }
  rule.walkDecls(d=>{result[d.prop]=d.value;});
 });
 return result;
}
function resolve(value:string,variables:Record<string,string>,seen=new Set<string>()):string{
 if(!value)throw Error('Missing source colour');
 const match=value.match(/^var\((--[\w-]+)\)$/);
 if(!match)return value;
 if(seen.has(match[1]))throw Error('Cyclic source colour');
 seen.add(match[1]);return resolve(variables[match[1]],variables,seen);
}
function luminance(value:string){
 if(!/^#[\da-f]{6}$/i.test(value))throw Error('Unsupported opaque source colour: '+value);
 const rgb=[1,3,5].map(n=>Number.parseInt(value.slice(n,n+2),16)/255);
 return rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
}
describe.each(['light','dark'] as const)('%s enquiry surfaces',theme=>{
 it('keeps selected enquiry and message metadata above 4.5:1',()=>{
  const root=properties(theme,'.m01-shell');
  const selected=properties(theme,'.m01-thread-list>button[aria-current=true]');
  const own=properties(theme,'.m01-messages article.m01-my-message');
  const selectedVars={...root,...selected},ownVars={...root,...own};
  const pairs=[
   [resolve(selected.color||root['--m01-ink'],selectedVars),selected.background],
   [resolve('var(--m01-muted)',selectedVars),selected.background],
   [resolve('var(--m01-muted)',ownVars),own.background]
  ];
  for(const [foreground,background] of pairs){
   const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
   expect((values[0]+.05)/(values[1]+.05),foreground+' on '+background).toBeGreaterThanOrEqual(4.5);
  }
 });
});

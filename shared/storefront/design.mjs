// Shared by the local preview and future server validation. No HTML, CSS, script,
// media URLs, private records or financial authority enter this configuration.
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => { Object.values(value).forEach(v=>{if(v&&typeof v==='object')freeze(v)}); return Object.freeze(value); };
export const templates = freeze([
 {id:'the-living-edit',name:'The Living Edit',version:'0.1.0',status:'library-candidate',schemaVersion:1,
  description:'Editorial photographs, considered space and a distinctive merchant story.',listingTypes:['goods','vehicle','property','rental'],
  components:['brand-header','hero','collections','products','story','contact'],interactions:['depth','restrained','none'],
  approval:{candidate:true,production:false},minimumRuntime:'Accessible HTML/CSS; no 3D required'},
 {id:'everyday-market',name:'Everyday Market',version:'0.1.0',status:'experimental',schemaVersion:1,
  description:'Practical, spacious catalogue browsing for everyday essentials.',listingTypes:['goods'],
  components:['brand-header','hero','collections','products','story','contact'],interactions:['depth','restrained','none'],
  approval:{candidate:false,production:false},minimumRuntime:'Accessible HTML/CSS'},
 {id:'precision-showroom',name:'Precision Showroom',version:'0.1.0',status:'experimental',schemaVersion:1,
  description:'A focused presentation for vehicles, equipment and considered purchases.',listingTypes:['vehicle','property','rental','goods'],
  components:['brand-header','hero','collections','products','story','contact'],interactions:['depth','restrained','none'],
  approval:{candidate:false,production:false},minimumRuntime:'Accessible HTML/CSS'}
]);
const keys=['schemaVersion','shopId','templateId','templateVersion','palette','typography','layout','motion','headline','sections','productIds'];
const allowed={palette:['emerald','clay','midnight'],typography:['editorial','modern'],layout:['editorial','catalogue','showroom'],motion:['depth','restrained','none']};
const fail = code => {throw Error(code)};
export function defaultTheme(shop) {
 return {schemaVersion:1,shopId:shop.id,templateId:'the-living-edit',templateVersion:'0.1.0',palette:'emerald',typography:'editorial',layout:'editorial',motion:'restrained',headline:'An edit of your own.',sections:['hero','collections','products','story','contact'],productIds:shop.products.slice(0,24).map(p=>p.id)};
}
export function validateTheme(input, shop) {
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).length!==keys.length||Object.keys(input).some(k=>!keys.includes(k)))fail('THEME_FIELDS');
 if(input.shopId!==shop.id)fail('SHOP_SCOPE');
 if(input.schemaVersion!==1)fail('SCHEMA_VERSION');
 const template=templates.find(t=>t.id===input.templateId); if(!template||template.version!==input.templateVersion)fail('TEMPLATE_VERSION');
 for(const [key,values] of Object.entries(allowed))if(!values.includes(input[key]))fail('THEME_TOKEN');
 if(typeof input.headline!=='string'||!input.headline.trim()||input.headline.length>120||/[<>\x00-\x1f\x7f]/.test(input.headline))fail('HEADLINE');
 if(!Array.isArray(input.sections)||input.sections.length<2||input.sections.length>5||new Set(input.sections).size!==input.sections.length||input.sections.some(s=>!['hero','collections','products','story','contact'].includes(s))||!input.sections.includes('products')||!input.sections.includes('contact'))fail('SECTIONS');
 const ids=new Set(shop.products.map(p=>p.id));
 if(!Array.isArray(input.productIds)||input.productIds.length>24||new Set(input.productIds).size!==input.productIds.length||input.productIds.some(id=>!ids.has(id)))fail('PRODUCT_SCOPE');
 return copy(input);
}
export function resolveTheme(input,shop){try{return{theme:validateTheme(input,shop),usedFallback:false}}catch{return{theme:defaultTheme(shop),usedFallback:true}}}
export function createDraft(initial, shop){
 const current=validateTheme(initial,shop); let theme=copy(current), history=[copy(current)], approvedRevision=null, undoStack=[];
 function record(value){theme=validateTheme(value,shop);history.push(copy(theme));approvedRevision=null;return snapshot()}
 function snapshot(){return copy({theme,history,revision:history.length-1,approved:approvedRevision===history.length-1})}
 return {snapshot,edit:patch=>{const next=validateTheme({...theme,...patch},shop);undoStack.push(copy(theme));return record(next)},approve:()=>{approvedRevision=history.length-1;return snapshot()},
  undo:()=>undoStack.length?record(undoStack.pop()):snapshot(),
  restore:index=>{if(!Number.isInteger(index)||index<0||index>=history.length)fail('HISTORY_VERSION');undoStack.push(copy(theme));return record(history[index])},
  compare:()=>copy({current,draft:theme})};
}
// Explicit local demonstration, not model inference. Existing Chale adapters will
// later supply the same strictly validated shape through permissioned tools.
export function proposeTheme(prompt,current){
 if(typeof prompt!=='string'||prompt.length>600)fail('PROMPT_LENGTH');
 const p=prompt.toLowerCase(), patch={};
 if(/warm|clay|terracotta/.test(p))patch.palette='clay';else if(/dark|night/.test(p))patch.palette='midnight';else if(/emerald|green/.test(p))patch.palette='emerald';
 if(/modern|minimal/.test(p))patch.typography='modern';else if(/editorial|luxury/.test(p))patch.typography='editorial';
 if(/automotive|showroom|vehicle/.test(p))Object.assign(patch,{templateId:'precision-showroom',templateVersion:'0.1.0',layout:'showroom'});
 else if(/grocery|groceries|catalogue/.test(p))Object.assign(patch,{templateId:'everyday-market',templateVersion:'0.1.0',layout:'catalogue'});
 else if(/editorial/.test(p))Object.assign(patch,{templateId:'the-living-edit',templateVersion:'0.1.0',layout:'editorial'});
 if(/less motion|no motion|lite/.test(p))patch.motion='none';
 return patch;
}

export const happeningSources=Object.freeze({
 searches:Object.freeze({source:'Google Trends',label:'Trending searches in Ghana',sourceUrl:'https://trends.google.com/trending?geo=GH',endpoint:'https://trends.google.com/trending/rss?geo=GH',ttl:600000,maxAge:48*3600000}),
 music:Object.freeze({source:'Apple Music',label:'Apple Music Ghana Top Songs',sourceUrl:'https://rss.marketingtools.apple.com/api/v2/gh/music/most-played/10/songs.json',endpoint:'https://rss.marketingtools.apple.com/api/v2/gh/music/most-played/10/songs.json',ttl:3600000,maxAge:72*3600000})
});
export function plainPublicText(value,max=200){return typeof value==='string'&&value.trim()&&value.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(value)?value.trim():null;}
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function publicTrendItem(id,value,now){
 const cfg=happeningSources[id];if(!cfg||!value||!plainPublicText(value.title)||typeof value.subtitle!=='string'||value.subtitle.length>160||(value.subtitle&&!plainPublicText(value.subtitle))||!stamp(value.date))return null;
 const age=now-Date.parse(value.date);if(age < -300000||age>=cfg.maxAge||typeof value.url!=='string'||value.url.length>2048)return null;
 let url;try{url=new URL(value.url);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
 if(id==='music'&&(url.hostname!=='music.apple.com'||!url.pathname.startsWith('/gh/')))return null;
 if(id==='searches'&&(url.hostname!=='trends.google.com'||url.pathname!=='/trends/explore'||url.searchParams.get('geo')!=='GH'||!url.searchParams.get('q')))return null;
 return {title:value.title.trim(),subtitle:value.subtitle.trim(),url:url.href,date:value.date};
}
export function readHappening(value,now=Date.now()){
 if(!value||!stamp(value.asOf)||!Array.isArray(value.sections)||value.sections.length!==2)return null;
 const sections=[];
 for(const [index,id] of ['searches','music'].entries()){
  const s=value.sections[index],cfg=happeningSources[id];
  if(!s||s.id!==id||s.source!==cfg.source||s.label!==cfg.label||s.sourceUrl!==cfg.sourceUrl||!['available','empty','unavailable','disabled'].includes(s.status)||!stamp(s.checkedAt)||!stamp(s.expiresAt)||Date.parse(s.checkedAt)>now+300000||Date.parse(s.expiresAt)<=now||Date.parse(s.expiresAt)>Date.parse(s.checkedAt)+cfg.ttl||!Array.isArray(s.items)||s.items.length>4||typeof s.copyright!=='string'||s.copyright.length>200||(s.copyright&&!plainPublicText(s.copyright)))return null;
  if(s.updatedAt!==null&&(!stamp(s.updatedAt)||Date.parse(s.updatedAt)>now+300000||now-Date.parse(s.updatedAt)>cfg.maxAge))return null;
  const items=s.items.map(item=>publicTrendItem(id,item,now));if(items.some(item=>!item)||(s.status==='available'&&(!items.length||!s.updatedAt))||(s.status!=='available'&&items.length))return null;
  sections.push({id,source:s.source,label:s.label,sourceUrl:s.sourceUrl,status:s.status,checkedAt:s.checkedAt,updatedAt:s.updatedAt,expiresAt:s.expiresAt,copyright:s.copyright,items});
 }
 return {asOf:value.asOf,sections};
}

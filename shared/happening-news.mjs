import {plainPublicText} from './public-trends.mjs';
export const headlineSources=Object.freeze({
 'ghana-news':{source:'Google Trends',label:'News behind Ghana’s searches',sourceUrl:'https://trends.google.com/trending?geo=GH',ttl:600000,maxAge:48*3600000},
 'world-news':{source:'UN Geneva',label:'UN world briefings',sourceUrl:'https://www.ungeneva.org/en/news-media/press-items-list/rss.xml',ttl:900000,maxAge:7*86400000}
});
export const headlinePublishers=Object.freeze({'gna.org.gh':'Ghana News Agency','myjoyonline.com':'MyJoyOnline','graphic.com.gh':'Graphic Online','ghanafa.org':'Ghana Football Association','citinewsroom.com':'Citi Newsroom','3news.com':'3News','reuters.com':'Reuters','apnews.com':'Associated Press','bbc.com':'BBC','bbc.co.uk':'BBC'});
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function headlineItem(id,item,now){
 const cfg=headlineSources[id];if(!cfg||!item||!plainPublicText(item.title)||/%AutoEntityLabel/i.test(item.title)||!stamp(item.date)||now-Date.parse(item.date)>=cfg.maxAge||Date.parse(item.date)>now+300000||typeof item.url!=='string'||item.url.length>2048)return null;
 let url;try{url=new URL(item.url);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
 const host=url.hostname.replace(/^www\./,'');
 const publisher=id==='world-news'?(host==='ungeneva.org'&&url.pathname.startsWith('/en/news-media/')?'UN Geneva':null):(Object.hasOwn(headlinePublishers,host)?headlinePublishers[host]:null);
 if(typeof publisher!=='string'||item.publisher!==publisher||item.dateKind!==(id==='world-news'?'published':'trend'))return null;
 return {title:item.title.trim(),url:url.href,publisher,date:item.date,dateKind:item.dateKind};
}
export function emptyHeadlines(id,now,status='unavailable'){const cfg=headlineSources[id];return {id,source:cfg.source,label:cfg.label,sourceUrl:cfg.sourceUrl,status,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString(),updatedAt:null,items:[]};}
export function readHeadlines(value,now=Date.now()){
 if(!Array.isArray(value)||value.length!==2)return null;
 const result=[];for(const [i,id]of ['ghana-news','world-news'].entries()){
  const s=value[i],cfg=headlineSources[id];if(!s||s.id!==id||s.source!==cfg.source||s.label!==cfg.label||s.sourceUrl!==cfg.sourceUrl||!['available','empty','unavailable','disabled'].includes(s.status)||!stamp(s.checkedAt)||Date.parse(s.checkedAt)>now+300000||!stamp(s.expiresAt)||Date.parse(s.expiresAt)<=now||Date.parse(s.expiresAt)>Date.parse(s.checkedAt)+cfg.ttl||!Array.isArray(s.items)||s.items.length>4)return null;
  const items=s.items.map(item=>headlineItem(id,item,now));if(items.some(item=>!item)||(s.status==='available'&&(!items.length||!stamp(s.updatedAt)||s.updatedAt!==items.map(item=>item.date).sort().at(-1)))||(s.status!=='available'&&(items.length||s.updatedAt!==null)))return null;
  result.push({id,source:s.source,label:s.label,sourceUrl:s.sourceUrl,status:s.status,checkedAt:s.checkedAt,expiresAt:s.expiresAt,updatedAt:s.updatedAt,items});
 }return result;
}

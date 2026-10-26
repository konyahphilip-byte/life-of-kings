export const publicNewsSources = Object.freeze({
  'gna.org.gh': { kind: 'ghana', source: 'Ghana News Agency' },
  'myjoyonline.com': { kind: 'ghana', source: 'MyJoyOnline' },
  'graphic.com.gh': { kind: 'ghana', source: 'Graphic Online' },
  'reuters.com': { kind: 'world', source: 'Reuters' },
  'apnews.com': { kind: 'world', source: 'Associated Press' },
  'news.un.org': { kind: 'world', source: 'UN News' },
});
export const appReleaseUpdates = Object.freeze([
  {kind:'app',title:'Chale answers everyday questions and warm conversations; the latest correction keeps advice relevant.',url:'https://github.com/konyahphilip-byte/life-of-kings/pull/17',date:'2026-10-26T16:42:58.244Z',source:'EcoVibes release record'},
  {kind:'app',title:'Chale has a 40-request daily allowance. Greetings use no model request; shared free capacity limits still apply.',url:'https://github.com/konyahphilip-byte/life-of-kings/pull/15',date:'2026-10-26T08:38:46.220Z',source:'EcoVibes release record'},
  {kind:'app',title:'Home and Waste-to-Money now have updated photographs.',url:'https://github.com/konyahphilip-byte/life-of-kings/pull/13',date:'2026-10-26T05:33:46.189Z',source:'EcoVibes release record'},
]);

export function chaleUpdateIntent(value) {
  if(typeof value!=='string') return null;
  const q=value.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
    .replace(/^please /,'').replace(/ please (?:use|include|show) (?:separate )?verified (?:current )?(?:news|sources)$/,'').replace(/ please$/,'');
  if(/^(?:whats|what is) (?:trending|happening)(?: (?:now|today|currently))?$/.test(q))return 'both';
  if(/^(?:(?:show|give|tell) me |what(?:s| is| are) )?(?:the )?(?:(?:latest|current) )?(?:ecovibes(?: app)? (?:updates|news)|app updates)(?: (?:today|now|currently))?$/.test(q)
    || /^(?:whats|what is) new (?:in|on) ecovibes$/.test(q))return 'app';
  const geographic=/^(?:what is|whats) (?:happening|trending) (?:in|around) (?:ghana|the world)(?: (?:today|now|currently))?$/.test(q);
  const digest=/^(?:(?:show|give|tell) me |what(?:s| is| are) )?(?:the )?(?:(?:latest|current|todays) )?(?:(?:ghana|world|global|international)(?: and (?:ghana|world))? )?(?:news|headlines|news updates)(?: (?:in|from|about) (?:ghana|the world|ghana and the world))?(?: (?:today|now|currently))?$/.test(q)
    && (/\b(?:latest|current|todays|today|now|currently|ghana|world|global|international)\b/.test(q)||/^(?:show|give|tell) me /.test(q));
  if(!(geographic||digest))return null;
  const ghana=/\bghana\b/.test(q),world=/\b(?:world|global|international)\b/.test(q);
  if(ghana && !world) return 'ghana';
  if(world && !ghana) return 'world';
  return 'both';
}

export function readPublicUpdates(payload, now=Date.now()) {
  if(!payload || !Array.isArray(payload.entries) || !Number.isFinite(now)) return [];
  const seen=new Set(); const counts={app:0,ghana:0,world:0};
  return payload.entries.slice(0,100).flatMap(entry=>{
    if(!entry || !['app','ghana','world'].includes(entry.kind) || typeof entry.title!=='string' || !entry.title.trim()
      || entry.title.length>200 || /[<>\u0000-\u001f\u007f]/.test(entry.title) || typeof entry.url!=='string' || entry.url.length>2048) return [];
    let url;try{url=new URL(entry.url);}catch{return [];}
    if(url.protocol!=='https:' || url.username || url.password || url.port || url.hash) return [];
    const date=Date.parse(entry.date);
    if(!Number.isFinite(date) || new Date(date).toISOString()!==entry.date || date>now+300_000) return [];
    if(entry.kind==='app') {
      if(!appReleaseUpdates.some(record=>Object.keys(record).every(key=>entry[key]===record[key]))) return [];
    }else{
      const source=publicNewsSources[url.hostname.replace(/^www\./,'')];
      if(!source || entry.kind!==source.kind || entry.source!==source.source || now-date>36*3600_000) return [];
    }
    if(seen.has(url.href) || counts[entry.kind]>= (entry.kind==='app'?3:4)) return [];
    seen.add(url.href);counts[entry.kind]++;
    return [{kind:entry.kind,title:entry.title.trim(),url:url.href,date:entry.date,source:entry.source}];
  });
}

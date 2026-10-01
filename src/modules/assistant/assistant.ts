import { opportunities, products, initialPosts } from '../../data/seed';
import { handiDirectory } from '../quickhandi/domain';

export type AssistantDestination = 'Explore' | 'Marketplace' | 'Opportunities' | 'Gaming' | 'Messages' | 'Rewards' | 'Wallet' | 'Profile' | 'Communities' | 'Quick&Handi';
export type AssistantItem = { id: string; eyebrow: string; title: string; detail: string; destination: AssistantDestination; score: number };
export type AssistantReply = { text: string; items: AssistantItem[]; suggestions: string[] };

const catalog: AssistantItem[] = [
  ...handiDirectory.map(item => ({id:item.id,eyebrow:`QUICK&HANDI · ${item.category} · ${item.area}`,title:item.businessName||item.name,detail:`${item.services.slice(0,2).join(', ')} · ${item.ecoId} · sample profile`,destination:'Quick&Handi' as const,score:0})),
  ...products.map(item => ({ id:item.id, eyebrow:`MARKETPLACE · ${item.category}`, title:item.name, detail:`${item.seller} · GH₵${item.price}`, destination:'Marketplace' as const, score:0 })),
  ...opportunities.map(item => ({ id:item.id, eyebrow:`OPPORTUNITY · ${item.type}`, title:item.title, detail:`${item.org} · ${item.place}`, destination:'Opportunities' as const, score:0 })),
  ...initialPosts.map(item => ({ id:item.id, eyebrow:`COMMUNITY · ${item.tag}`, title:`${item.name}’s post`, detail:item.text, destination:'Explore' as const, score:0 })),
  {id:'creator-akosua',eyebrow:'CREATOR · ACCRA',title:'Akosua Anim',detail:'Illustrator sharing new work and ideas.',destination:'Explore',score:0},
  {id:'creator-jay',eyebrow:'CREATOR · TEMA',title:'Jay Tetteh',detail:'Game developer and community host.',destination:'Explore',score:0},
  {id:'game-arena',eyebrow:'GAMING · COMMUNITY CHALLENGE',title:'Weekend Arena',detail:'Quick rounds and a friendly leaderboard.',destination:'Gaming',score:0},
  {id:'community-makers',eyebrow:'COMMUNITY · MAKERS',title:'People making things happen',detail:'Meet creators, sellers and collaborators.',destination:'Communities',score:0},
  {id:'community-gaming',eyebrow:'COMMUNITY · GAMING',title:'Ghana game makers',detail:'Players and developers sharing local games.',destination:'Communities',score:0},
  {id:'wallet',eyebrow:'ECOVIBES WALLET',title:'Wallet and transaction history',detail:'Payment services are not connected in this preview.',destination:'Wallet',score:0},
  {id:'rewards',eyebrow:'ECOVIBES REWARDS',title:'Your points and badges',detail:'Recognition points have no cash value.',destination:'Rewards',score:0}
];
const stopWords = new Set(['the','a','an','for','me','my','to','in','on','of','and','with','can','you','find','show','help','look','please','near','nearby','some','something','what','where','is','are']);
const aliases:Record<string,string[]> = {
  grant:['opportunity','creator'],grants:['grant','opportunity','creator'],plumber:['plumbing','pipe'],plumbing:['pipe','repair'],electrician:['electrical'],cleaner:['cleaning'],scholarship:['grant','opportunity','education'],scholarships:['scholarship','grant','opportunity'],laptops:['laptop','marketplace','gaming'],computers:['computer','marketplace','gaming'],jobs:['job','work','opportunity'],gigs:['gig','freelance','opportunity'],gig:['freelance','work','opportunity'],job:['work','opportunity'],laptop:['marketplace','gaming'],affordable:['price','marketplace'],game:['gaming','play','tournament'],tournament:['gaming','challenge'],creator:['artist','community','post'],shop:['marketplace','product','seller'],buy:['marketplace','product'],group:['community','people'],community:['people','makers'],money:['wallet','payment'],points:['rewards','badge'],event:['community','opportunity']
};
function tokensOf(value:string){return value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(token=>token.length>1&&!stopWords.has(token));}
function withAliases(tokens:string[]){return new Set(tokens.flatMap(token=>[token,...(aliases[token]||[])]));}

export function answerEcoVibesQuery(query:string):AssistantReply {
  const tokens=withAliases(tokensOf(query));
  const ranked=catalog.map(item=>{
    const haystack=withAliases(tokensOf(`${item.eyebrow} ${item.title} ${item.detail}`));
    const overlap=[...tokens].filter(token=>haystack.has(token)).length;
    return {...item,score:overlap};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
  const raw=tokensOf(query);
  const asksScholarship=raw.some(token=>['scholarship','scholarships','education'].includes(token));
  const asksLaptop=raw.some(token=>['laptop','laptops','computer','computers'].includes(token));
  let text='I searched the EcoVibes preview catalogue and found a few useful places to start.';
  const asksPlumbing=raw.some(token=>['plumber','plumbing','pipe','pipes'].includes(token));
  if(asksPlumbing&&ranked.some(item=>item.destination==='Quick&Handi')){
    text='This sounds like a plumbing request. I found a sample local profile; open Quick&Handi to add your area, describe the job and request a quote.';
  } else if(asksScholarship && !ranked.some(item=>item.title.toLowerCase().includes('scholarship'))){
    text='I don’t see a scholarship listing in this preview. I did find a creator micro-grant and other opportunity listings you can review.';
  } else if(asksLaptop && !ranked.some(item=>/laptop|computer/i.test(item.title))){
    text='There are no laptop listings in the preview catalogue yet. I can show the current marketplace and gaming community while you explore.';
  } else if(!ranked.length){
    text='I couldn’t find a direct match in the preview catalogue. Try a creator, game, marketplace item, opportunity or community topic.';
  }
  return {text,items:ranked,suggestions:['Find grants','Show creators','Explore gaming','Open communities']};
}

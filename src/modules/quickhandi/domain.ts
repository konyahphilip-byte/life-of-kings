import { serviceCategories, type HandiProfile, type JobStatus, type QuickHandiState, type ServiceCategory, type ServiceRequest, type CustomJob, type JobOffer, type CustomJobStatus, type ProviderType, type CustomJobEvent } from './model';

export const handiDirectory:HandiProfile[]=[
 {id:'h-plumb-ama',providerType:'business',teamSize:3,ecoId:'@akua-fixes',name:'Akua Boateng',businessName:'Akua Home Care',category:'Plumbing',services:['Pipe repairs','Tap installation','Leak checks'],area:'Osu, Accra',serviceRadiusKm:12,bio:'Residential plumbing and careful small repairs, with clear updates from arrival to wrap-up.',estimateMinor:18000,pricing:'from',availability:'Today · 2:30–5:00 PM',responseTime:'Usually replies in 12 min',rating:4.8,reviewCount:38,completedJobs:64,verification:'unverified',sample:true},
 {id:'h-photo-kofi',providerType:'individual',ecoId:'@kofiframes',name:'Kofi Mensah',businessName:'Kofi Frames',category:'Photography',services:['Portraits','Small events','Product photos'],area:'East Legon, Accra',serviceRadiusKm:18,bio:'Portrait and event photographer. Natural light, thoughtful direction, easy delivery.',estimateMinor:35000,pricing:'quote',availability:'Tomorrow · morning',responseTime:'Usually replies in 20 min',rating:4.9,reviewCount:24,completedJobs:41,verification:'unverified',sample:true},
 {id:'h-clean-esi',providerType:'team',teamSize:5,ecoId:'@freshstartgh',name:'Esi Owusu',businessName:'Fresh Start Cleaning',category:'Cleaning',services:['Home cleaning','Move-out cleaning','Laundry'],area:'Adenta, Accra',serviceRadiusKm:15,bio:'Reliable home cleaning with a checklist agreed before the visit.',estimateMinor:22000,pricing:'fixed',availability:'Today · 4:00 PM',responseTime:'Usually replies in 8 min',rating:4.7,reviewCount:53,completedJobs:92,verification:'unverified',sample:true},
 {id:'h-design-nana',providerType:'individual',ecoId:'@nanamakes',name:'Nana Agyeman',category:'Graphic Design',services:['Brand identity','Social graphics','Print design'],area:'Tema Community 25',serviceRadiusKm:25,bio:'Independent designer helping small teams bring ideas into focus.',estimateMinor:25000,pricing:'quote',availability:'Taking bookings this week',responseTime:'Usually replies in 35 min',rating:4.9,reviewCount:17,completedJobs:29,verification:'unverified',sample:true},
 {id:'h-delivery-kwame',providerType:'business',teamSize:4,ecoId:'@kwameonthego',name:'Kwame Osei',businessName:'On the Go Accra',category:'Delivery & Errands',services:['Local pickup','Document drop-off','Shopping errands'],area:'Labone, Accra',serviceRadiusKm:10,bio:'Local errands and careful same-day pickups in central Accra.',estimateMinor:8000,pricing:'from',availability:'Available now',responseTime:'Usually replies in 5 min',rating:4.6,reviewCount:31,completedJobs:118,verification:'unverified',sample:true},
 {id:'h-tutor-yaw',providerType:'individual',ecoId:'@yawkofi',name:'Yaw Kofi',category:'Tutoring',services:['Maths','Physics','Online lessons'],area:'Madina, Accra',serviceRadiusKm:20,bio:'Patient senior tutor offering clear lessons and practical revision plans.',estimateMinor:15000,pricing:'fixed',availability:'Weekday evenings',responseTime:'Usually replies in 25 min',rating:4.8,reviewCount:19,completedJobs:47,verification:'unverified',sample:true}
];

export function formatGhs(minor:number){return `GH₵${(minor/100).toFixed(2)}`;}
export function matchHandis(profiles:HandiProfile[],query:string,category:ServiceCategory|'All',area:string){
 const synonyms:Record<string,string[]>={plumber:['plumbing','pipe','repair'],plumbing:['pipe','repair'],electrician:['electrical','repairs'],cleaner:['cleaning'],fix:['repair','repairs'],repair:['repairs'],photographer:['photography'],designer:['design','graphic'],delivery:['errands','pickup'],tomorrow:['scheduled'],today:['asap'],someone:[],need:[],help:[],please:[],the:[],for:[],with:[],and:[],a:[],to:[],me:[],my:[],in:[],on:[],at:[],can:[],could:[],find:[],get:[],do:[],done:[],service:[],services:[]};
 const terms=query.toLocaleLowerCase().trim().split(/[^\p{L}\p{N}]+/u).filter(term=>term.length>1&&!['morning','afternoon','evening','asap','scheduled','service','services'].includes(term));
 const areaIsAccra=area==='Anywhere in Accra';
 return profiles.map(profile=>{
  const searchable=`${profile.name} ${profile.businessName||''} ${profile.category} ${profile.services.join(' ')} ${profile.area} ${profile.bio}`.toLocaleLowerCase();
  const score=terms.reduce((sum,term)=>{
   if(synonyms[term]?.length===0)return sum;
   const variants=[term,...(synonyms[term]||[])];
   return sum+(variants.some(variant=>searchable.includes(variant))?1:0);
  },0);
  const categoryMatch=category==='All'||profile.category===category;
  const areaMatch=areaIsAccra?profile.area.toLowerCase().includes('accra'):!area||profile.area.toLowerCase().includes(area.toLowerCase());
  return {profile,score,categoryMatch,areaMatch};
 }).filter(result=>result.categoryMatch&&result.areaMatch&&(terms.length===0||result.score>0))
  .sort((a,b)=>b.score-a.score||(b.profile.rating||0)-(a.profile.rating||0)).map(result=>result.profile);
}

export function createServiceRequest(input:{provider:HandiProfile;category:ServiceCategory;title:string;details:string;area:string;timing:'asap'|'scheduled';scheduledAt?:string;now?:Date;random?:()=>number}):ServiceRequest{
 const now=input.now||new Date();const suffix=Math.floor((input.random||Math.random)()*0xffffff).toString(36).toUpperCase().padStart(4,'0').slice(-4);
 return {id:`QH-${now.toISOString().slice(0,10).replaceAll('-','')}-${suffix}`,providerId:input.provider.id,providerName:input.provider.name,category:input.category,title:input.title.trim(),details:input.details.trim(),area:input.area.trim(),timing:input.timing,scheduledAt:input.timing==='scheduled'?input.scheduledAt:undefined,pricing:input.provider.pricing,estimateMinor:input.provider.estimateMinor,status:'requested',createdAt:now.toISOString(),messages:[{id:`m-${suffix}`,sender:'system',text:'Service request sent. Provider response is not connected in this preview.',at:now.toISOString()}]};
}
const transitions:Record<JobStatus,JobStatus[]>={requested:['quoted','accepted','cancelled'],quoted:['confirmed','cancelled'],accepted:['confirmed','cancelled'],confirmed:['in_progress','cancelled'],in_progress:['awaiting_customer','disputed'],awaiting_customer:['completed','disputed'],completed:[],cancelled:[],disputed:['completed','cancelled']};
export function transitionJob(job:ServiceRequest,next:JobStatus):ServiceRequest{
 if(!transitions[job.status].includes(next))throw new Error(`Cannot move a ${job.status} request to ${next}.`);
 return {...job,status:next};
}
export function saveQuote(job:ServiceRequest,amountMinor:number,note:string,now=new Date()):ServiceRequest{
 if(job.status!=='requested')throw new Error('A quote can only be sent for a new request.');
 if(!Number.isInteger(amountMinor)||amountMinor<100)throw new Error('Enter a quote of at least GH₵1.00.');
 const next=transitionJob(job,'quoted');
 return {...next,quoteMinor:amountMinor,quoteNote:note.trim(),messages:[...job.messages,{id:`quote-${now.getTime()}`,sender:'system',text:`A sample quote of ${formatGhs(amountMinor)} was added. No payment was taken.`,at:now.toISOString()}]};
}
export function makeSampleCustomJob():CustomJob{return {id:'QHJ-20260930-CIRC',ownerEcoId:'@abena-boateng',ownerName:'Abena Boateng',category:'Delivery & Errands',title:'Pick up groceries from Circle and deliver to Osu',details:'Collect one small shopping bag from the Makola/Circle area. Please message before leaving the pickup point.',area:'Osu, Accra',budgetMinor:6500,timing:'asap',status:'open',createdAt:'2026-09-30T10:00:00.000Z',sample:true,events:[{id:'event-sample-post',type:'JOB_POSTED',actorEcoId:'@abena-boateng',at:'2026-09-30T10:00:00.000Z'},{id:'event-sample-offer',type:'JOB_OFFERED',actorEcoId:'@kwameonthego',at:'2026-09-30T10:15:00.000Z'}],offers:[{id:'offer-sample-kwame',providerId:'h-delivery-kwame',providerEcoId:'@kwameonthego',providerName:'Kwame Osei · On the Go Accra',providerType:'business',amountMinor:5800,note:'Local pickup, careful delivery, and a message at collection.',eta:'About 45 minutes',status:'pending',createdAt:'2026-09-30T10:15:00.000Z',sample:true}]};}
export function createCustomJob(input:{ownerEcoId:string;ownerName:string;category:ServiceCategory;title:string;details:string;area:string;budgetMinor:number;timing:'asap'|'scheduled';scheduledAt?:string;now?:Date;random?:()=>number}):CustomJob{
 const title=input.title.trim(),details=input.details.trim(),area=input.area.trim();
 if(!title||!details||!area)throw new Error('Add a title, description and service area.');
 if(!Number.isInteger(input.budgetMinor)||input.budgetMinor<100)throw new Error('Set a budget of at least GH₵1.00.');
 const now=input.now||new Date();const suffix=Math.floor((input.random||Math.random)()*0xffffff).toString(36).toUpperCase().padStart(4,'0').slice(-4);
 return {id:`QHJ-${now.toISOString().slice(0,10).replaceAll('-','')}-${suffix}`,ownerEcoId:input.ownerEcoId,ownerName:input.ownerName,category:input.category,title,details,area,budgetMinor:input.budgetMinor,timing:input.timing,scheduledAt:input.timing==='scheduled'?input.scheduledAt:undefined,status:'open',offers:[],events:[{id:`event-${suffix}`,type:'JOB_POSTED',actorEcoId:input.ownerEcoId,at:now.toISOString()}],createdAt:now.toISOString()};
}
export function submitCustomJobOffer(job:CustomJob,input:{providerId:string;providerEcoId:string;providerName:string;providerType:ProviderType;amountMinor:number;note:string;eta:string;now?:Date;random?:()=>number}):CustomJob{
 if(job.status!=='open')throw new Error('Offers are closed for this job.');
 if(job.ownerEcoId===input.providerEcoId)throw new Error('You cannot make an offer on your own job.');
 if(job.offers.some(offer=>offer.providerEcoId===input.providerEcoId&&offer.status!=='declined'))throw new Error('You already have an active offer on this job.');
 if(!Number.isInteger(input.amountMinor)||input.amountMinor<100)throw new Error('Enter an offer of at least GH₵1.00.');
 if(!input.note.trim()||!input.eta.trim())throw new Error('Add what the offer includes and an estimated arrival or delivery time.');
 const now=input.now||new Date();const suffix=Math.floor((input.random||Math.random)()*0xffffff).toString(36).toUpperCase().padStart(4,'0').slice(-4);
 const offer:JobOffer={id:`QHO-${suffix}`,providerId:input.providerId,providerEcoId:input.providerEcoId,providerName:input.providerName,providerType:input.providerType,amountMinor:input.amountMinor,note:input.note.trim(),eta:input.eta.trim(),status:'pending',createdAt:now.toISOString()};
 return {...job,offers:[...job.offers,offer],events:[...(job.events||[]),{id:`event-${suffix}`,type:'JOB_OFFERED',actorEcoId:input.providerEcoId,at:now.toISOString(),details:`${offer.id} · ${offer.amountMinor} ${job.id}`} ]};
}
export function selectJobOffer(job:CustomJob,offerId:string,actorEcoId:string):CustomJob{
 if(job.ownerEcoId!==actorEcoId)throw new Error('Only the job owner can select an offer.');
 if(job.status!=='open')throw new Error('This job is no longer open.');
 if(!job.offers.some(offer=>offer.id===offerId&&offer.status==='pending'))throw new Error('That offer is no longer available.');
 const now=new Date().toISOString();return {...job,status:'assigned',offers:job.offers.map(offer=>({...offer,status:offer.id===offerId?'selected':'declined'})),events:[...(job.events||[]),{id:`event-${Date.now()}`,type:'JOB_ASSIGNED',actorEcoId,at:now,details:offerId}]};
}
const customTransitions:Record<CustomJobStatus,CustomJobStatus[]>={open:['cancelled'],assigned:['in_progress','cancelled'],in_progress:['awaiting_customer','disputed'],awaiting_customer:['completed','disputed'],completed:[],cancelled:[],disputed:['completed','cancelled']};
export function transitionCustomJob(job:CustomJob,next:CustomJobStatus,actorEcoId='system'):CustomJob{if(!customTransitions[job.status].includes(next))throw new Error(`Cannot move a ${job.status} job to ${next}.`);const eventType:Record<CustomJobStatus,CustomJobEvent['type']>={open:'JOB_POSTED',assigned:'JOB_ASSIGNED',in_progress:'JOB_STARTED',awaiting_customer:'JOB_FINISHED',completed:'JOB_COMPLETED',cancelled:'JOB_CANCELLED',disputed:'JOB_DISPUTED'};return {...job,status:next,events:[...(job.events||[]),{id:`event-${Date.now()}`,type:eventType[next],actorEcoId,at:new Date().toISOString()}]};}
export function initialQuickHandiState():QuickHandiState{return {mode:'customer',requests:[],customJobs:[makeSampleCustomJob()],categories:[...serviceCategories]};}

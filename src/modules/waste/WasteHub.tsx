import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, CircleHelp, Leaf, Recycle, ShieldCheck, Truck, Users, Waves } from 'lucide-react';
import JobsBoard, { type NewJobInput, type NewOfferInput } from '../quickhandi/JobsBoard';
import type { CustomJob, CustomJobEvent, CustomJobStatus, HandiProfile, JobOffer, ProviderType, ServiceCategory } from '../quickhandi/model';
import { apiUrl } from '../../lib/api';
import './waste.css';

type ApiIdentity = { id:string; eco_id:string; display_name:string; roles:string[] };
type Verification = { id:string; business_type:string; status:string; created_at:string };
type WasteJob = CustomJob & { category:ServiceCategory };

async function wasteApi<T>(path:string,csrf:string,init:RequestInit={}) {
  const response=await fetch(apiUrl(path),{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init.method&&init.method!=='GET'?{'X-CSRF-Token':csrf}:{}),...init.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error?.message||'Could not complete this Waste request.');
  return data as T;
}

function mapJob(row:Record<string,unknown>):WasteJob {
  const offers=Array.isArray(row.offers)?row.offers as Array<Record<string,unknown>>:[];
  const events=Array.isArray(row.events)?row.events as Array<Record<string,unknown>>:[];
  return {
    id:String(row.id),ownerEcoId:`@${String(row.customer_eco_id||'unknown')}`,ownerName:String(row.customer_name||'EcoVibes member'),
    category:'Waste & Recycling',title:String(row.title),details:String(row.description),area:String(row.area),budgetMinor:Number(row.budget_minor),
    timing:row.timing==='scheduled'?'scheduled':'asap',scheduledAt:row.scheduled_at?String(row.scheduled_at):undefined,
    status:String(row.status) as CustomJobStatus,
    offers:offers.map(offer=>({id:String(offer.id),providerId:'',providerEcoId:`@${String(offer.provider_eco_id||'unknown')}`,providerName:String(offer.provider_name||'EcoVibes provider'),providerType:String(offer.provider_type||'individual') as ProviderType,amountMinor:Number(offer.amount_minor),note:String(offer.note),eta:String(offer.eta),status:String(offer.status) as JobOffer['status'],createdAt:String(offer.created_at)})),
    events:events.map(event=>({id:`${String(event.event_type)}-${String(event.created_at)}`,type:String(event.event_type) as CustomJobEvent['type'],actorEcoId:`@${String(event.actor_eco_id||'')}`,at:String(event.created_at)})),
    createdAt:String(row.created_at),sample:false,
  };
}

export default function WasteHub({identityId:nullIdentity=null}:{identityId?:string|null}) {
  const [identity,setIdentity]=useState<ApiIdentity|null>(null);
  const [csrf,setCsrf]=useState('');
  const [jobs,setJobs]=useState<WasteJob[]>([]);
  const [verifications,setVerifications]=useState<Verification[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [view,setView]=useState<'customer'|'provider'>('customer');

  const refresh=useCallback(async()=>{
    const me=await wasteApi<{user:ApiIdentity|null;csrfToken:string|null}>('/auth/me','');
    setIdentity(me.user);setCsrf(me.csrfToken||'');
    if(!me.user){setJobs([]);setVerifications([]);return;}
    const [jobRows,verificationRows]=await Promise.all([
      wasteApi<Array<Record<string,unknown>>>('/jobs',me.csrfToken||''),
      wasteApi<Verification[]>('/trust/verifications',me.csrfToken||''),
    ]);
    setJobs(jobRows.filter(row=>String(row.category)==='Waste & Recycling').map(mapJob));
    setVerifications(verificationRows);
  },[]);

  useEffect(()=>{let active=true;setLoading(true);void refresh().catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Waste services are temporarily unavailable.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[refresh,nullIdentity]);

  const wasteVerification=verifications.find(item=>item.business_type==='Waste services provider');
  const providerApproved=Boolean(wasteVerification?.status==='approved');
  const providerProfile:HandiProfile|undefined=identity?.roles.includes('provider')?{
    id:`waste-${identity.id}`,ecoId:`@${identity.eco_id}`,name:identity.display_name,category:'Waste & Recycling',services:['Waste and recycling collection'],area:'Your service area',serviceRadiusKm:0,bio:'Waste service provider on EcoVibes.',estimateMinor:0,pricing:'quote',availability:'By arrangement',responseTime:'',reviewCount:0,completedJobs:0,verification:providerApproved?'verified':'unverified',sample:false,
  }:undefined;
  const activeView=providerApproved&&view==='provider'?'handi':'customer';

  async function createJob(input:NewJobInput){
    if(!identity||!csrf)throw new Error('Sign in with your EcoVibes ID before posting a collection request.');
    await wasteApi('/jobs',csrf,{method:'POST',body:JSON.stringify({...input,category:'Waste & Recycling'})});
    await refresh();
  }
  async function addOffer(job:CustomJob,input:NewOfferInput){
    if(!identity||!csrf)throw new Error('Sign in with your EcoVibes ID before sending an offer.');
    if(!providerApproved)throw new Error('Waste provider review must be approved before you can make offers.');
    await wasteApi(`/jobs/${job.id}/offers`,csrf,{method:'POST',body:JSON.stringify(input)});await refresh();
  }
  async function selectOffer(job:CustomJob,offer:JobOffer){if(!csrf)throw new Error('Sign in to choose a provider.');await wasteApi(`/jobs/${job.id}/offers/${offer.id}/select`,csrf,{method:'POST',body:'{}'});await refresh();}
  async function moveJob(job:CustomJob,next:CustomJobStatus){
    if(!csrf)throw new Error('Sign in to update this collection request.');
    const actions:Partial<Record<CustomJobStatus,string>>={in_progress:'start',awaiting_customer:'finish',completed:'complete',cancelled:'cancel',disputed:'dispute'};
    const action=actions[next];if(!action)return;
    await wasteApi(`/jobs/${job.id}/${action}`,csrf,{method:'POST',body:JSON.stringify(next==='disputed'?{reason:'A problem was reported on the Waste collection request.'}:{})});await refresh();
  }

  async function onboardProvider(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setSuccess('');
    try{
      if(!identity||!csrf){window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'EcoVibes ID'}));throw new Error('Sign in with your EcoVibes ID to apply as a waste-service provider.');}
      const form=new FormData(event.currentTarget);
      const businessName=String(form.get('businessName')||'').trim();
      const providerType=String(form.get('providerType')||'individual');
      const serviceArea=String(form.get('serviceArea')||'').trim();
      const services=String(form.get('services')||'').trim();
      const materials=String(form.get('materials')||'').trim();
      if(!businessName||!serviceArea||services.length<10||materials.length<3)throw new Error('Complete the business name, service area, service description, and materials accepted.');
      let current=identity;
      if(!current.roles.includes('provider')){
        const added=await wasteApi<{user:ApiIdentity}>('/identity/roles',csrf,{method:'POST',body:JSON.stringify({role:'provider'})});current=added.user;setIdentity(current);
      }
      await wasteApi('/identity/profiles',csrf,{method:'PATCH',body:JSON.stringify({profile:'provider',providerType,businessName,serviceArea})});
      if(wasteVerification?.status==='pending')throw new Error('Your Waste service application is already waiting for staff review.');
      const evidenceNote=`Type: ${providerType}. Service: ${services.slice(0,180)}. Materials: ${materials.slice(0,90)}. Area: ${serviceArea.slice(0,80)}. Business: ${businessName.slice(0,70)}.`;
      await wasteApi('/trust/verifications',csrf,{method:'POST',body:JSON.stringify({businessType:'Waste services provider',evidenceNote})});
      await refresh();setSuccess('Waste provider application submitted. Staff review is required before you can send collection offers.');
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not submit the provider application.');}
    finally{setBusy(false);}
  }

  return <div className="waste-hub">
    <section className="waste-hero">
      <div className="waste-hero-copy"><span className="waste-mark"><Recycle size={16}/> ECOVIBES · CIRCULAR ECONOMY</span><h1>Waste, put to better use.</h1><p>Request local collection, connect with waste and recycling providers, and keep useful materials in circulation.</p><div className="waste-hero-actions"><button className="waste-primary" onClick={()=>{if(!identity){window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'EcoVibes ID'}));return;}setView('customer');document.getElementById('waste-requests')?.scrollIntoView({behavior:'smooth'});}}>Request a collection <ArrowRight size={16}/></button><button className="waste-secondary" onClick={()=>document.getElementById('waste-provider')?.scrollIntoView({behavior:'smooth'})}>Offer a service <Users size={15}/></button></div><small>EcoVibes ID required to create requests. Exact addresses should be shared only after a provider is selected.</small></div>
      <div className="waste-orbit" aria-hidden="true"><span className="waste-orbit-ring ring-a"/><span className="waste-orbit-ring ring-b"/><span className="waste-orbit-leaf"><Leaf size={31}/></span><i className="waste-orbit-dot dot-a"/><i className="waste-orbit-dot dot-b"/><b>REUSE<br/>REPAIR<br/>RECYCLE</b></div>
    </section>

    <div className="waste-pillars"><article><span><Truck size={18}/></span><b>Collection requests</b><small>Post material, quantity estimate, area and timing.</small></article><article><span><Users size={18}/></span><b>Local providers</b><small>Providers send scoped offers for you to compare.</small></article><article><span><ShieldCheck size={18}/></span><b>Reviewed providers</b><small>Waste-service offers require EcoVibes staff review.</small></article></div>

    <section className="waste-section" id="waste-requests"><div className="waste-section-heading"><div><span className="waste-kicker"><CalendarDays size={14}/> WASTE REQUESTS</span><h2>Find a collection provider</h2><p>Post a request with your neighbourhood and proposed budget. Keep your exact address private until you choose a provider.</p></div><div className="waste-view-switch" role="group" aria-label="Waste workspace"><button className={view==='customer'?'selected':''} onClick={()=>setView('customer')}>Request service</button><button className={view==='provider'?'selected':''} onClick={()=>setView('provider')} disabled={!providerApproved}>Provider work</button></div></div>
      {error&&<div className="waste-message error" role="alert">{error}</div>}{success&&<div className="waste-message success" role="status">{success}</div>}
      {!identity&&!loading?<div className="waste-sign-in"><CircleHelp size={19}/><div><b>Sign in to use Waste</b><p>Collection requests and provider offers are attached to your EcoVibes ID.</p></div><button onClick={()=>window.dispatchEvent(new CustomEvent('ecovibes:navigate',{detail:'EcoVibes ID'}))}>Sign in <ArrowRight size={14}/></button></div>:loading?<div className="waste-loading">Loading your Waste workspace…</div>:<JobsBoard mode={activeView} currentEcoId={identity?`@${identity.eco_id}`:'@guest'} currentName={identity?.display_name||'EcoVibes member'} profile={activeView==='handi'?providerProfile:undefined} jobs={jobs} onCreate={createJob} onOffer={addOffer} onSelect={selectOffer} onMove={moveJob} categoryLock={activeView==='customer'?'Waste & Recycling':undefined}/>}
      {identity?.roles.includes('provider')&&wasteVerification?.status==='pending'&&<div className="waste-review-status"><ShieldCheck size={16}/><span>Your waste-service application is <b>pending staff review</b>. Provider work is locked until it is approved.</span></div>}
      {identity?.roles.includes('provider')&&wasteVerification?.status==='approved'&&<div className="waste-review-status approved"><BadgeCheck size={16}/><span>Your Waste provider profile is approved. Open <b>Provider work</b> to make offers.</span></div>}
    </section>

    <section className="waste-section waste-provider-section" id="waste-provider"><div className="waste-section-heading"><div><span className="waste-kicker"><Waves size={14}/> PROVIDER ONBOARDING</span><h2>Bring your waste service onto EcoVibes</h2><p>Register your collection, sorting, recycling, repair or reuse service. Staff review is required before provider offers become available.</p></div><span className="waste-review-badge"><ShieldCheck size={14}/> Reviewed before offers</span></div>
      {wasteVerification?.status==='pending'?<div className="waste-sign-in"><ShieldCheck size={19}/><div><b>Application under review</b><p>We’ll show provider work after the EcoVibes trust team approves your profile.</p></div></div>:<form className="waste-onboarding-form" onSubmit={onboardProvider}><label>Business or provider name<input name="businessName" required maxLength={90} defaultValue={identity?.display_name||''} placeholder="Name customers will recognize"/></label><div className="waste-form-grid"><label>Provider type<select name="providerType" defaultValue="business"><option value="individual">Individual collector</option><option value="business">Small business</option><option value="company">Company</option><option value="team">Collection team</option></select></label><label>Operating area<input name="serviceArea" required maxLength={120} placeholder="Town, district or neighbourhoods"/></label></div><label>What service do you provide?<textarea name="services" required minLength={10} maxLength={300} rows={3} placeholder="For example: scheduled household pickup, office recycling collection, sorting or e-waste collection."/></label><label>What materials do you accept?<input name="materials" required maxLength={160} placeholder="Plastic, paper, metal, electronics, organic waste…"/></label><div className="waste-onboarding-foot"><p><ShieldCheck size={15}/> Your service is not published until staff review. Do not enter government ID or banking details here.</p><button className="waste-primary" disabled={busy||!identity}>{busy?'Submitting…':'Apply to provide a service'} <ArrowRight size={15}/></button></div></form>}
      {wasteVerification?.status==='rejected'&&<p className="waste-rejected-note">Your last application needs changes. Update the details above and submit again.</p>}
    </section>

    <div className="waste-disclosure"><CircleHelp size={16}/><p><b>First release:</b> Waste requests and provider offers use the EcoVibes job workflow. A live recycling-plant map, buyer prices, receiving capacity, verified weights, truck dispatch, recycling credits and Waste payments are not connected yet. Agree on the scope and price before collection; do not treat an offer as a completed pickup.</p></div>
  </div>;
}

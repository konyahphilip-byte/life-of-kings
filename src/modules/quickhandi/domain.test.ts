import { describe, expect, it } from 'vitest';
import { createCustomJob, createServiceRequest, handiDirectory, matchHandis, saveQuote, selectJobOffer, submitCustomJobOffer, transitionCustomJob, transitionJob } from './domain';
import type { ServiceRequest } from './model';

const provider=handiDirectory[0];
function request():ServiceRequest{return createServiceRequest({provider,category:provider.category,title:'Fix leaking tap',details:'Kitchen sink is dripping',area:'Osu, Accra',timing:'asap',now:new Date('2026-09-30T12:00:00.000Z'),random:()=>0.5});}

describe('Quick&Handi service request domain',()=>{
 it('creates a budgeted custom job and rejects incomplete or invalid amounts',()=>{
  const job=createCustomJob({ownerEcoId:'@buyer',ownerName:'Buyer',category:'Delivery & Errands',title:'Collect a parcel',details:'Pick up a small parcel from Osu.',area:'Osu',budgetMinor:5000,timing:'asap',now:new Date('2026-09-30T12:00:00.000Z'),random:()=>0.5});
  expect(job.id).toMatch(/^QHJ-20260930-/);expect(job.status).toBe('open');expect(job.events?.[0].type).toBe('JOB_POSTED');
  expect(()=>createCustomJob({ownerEcoId:'@buyer',ownerName:'Buyer',category:'Other',title:' ',details:'Missing title',area:'Osu',budgetMinor:5000,timing:'asap'})).toThrow(/title/);
  expect(()=>createCustomJob({ownerEcoId:'@buyer',ownerName:'Buyer',category:'Other',title:'Parcel',details:'Collect parcel',area:'Osu',budgetMinor:0,timing:'asap'})).toThrow(/budget/);
 });
 it('validates offers, lets only the owner award one, and records lifecycle events',()=>{
  const job=createCustomJob({ownerEcoId:'@buyer',ownerName:'Buyer',category:'Delivery & Errands',title:'Collect parcel',details:'Pick up a parcel.',area:'Osu',budgetMinor:5000,timing:'asap'});
  const input={providerId:'provider-1',providerEcoId:'@handi',providerName:'Local Handi',providerType:'team' as const,amountMinor:4500,note:'Pickup and careful delivery.',eta:'45 minutes'};
  expect(()=>submitCustomJobOffer(job,{...input,providerEcoId:'@buyer'})).toThrow(/own job/);
  const offered=submitCustomJobOffer(job,input);
  expect(()=>submitCustomJobOffer(offered,input)).toThrow(/already have/);
  expect(()=>selectJobOffer(offered,offered.offers[0].id,'@other')).toThrow(/Only the job owner/);
  const assigned=selectJobOffer(offered,offered.offers[0].id,'@buyer');
  expect(assigned.status).toBe('assigned');expect(assigned.events?.at(-1)?.type).toBe('JOB_ASSIGNED');
  const done=transitionCustomJob(transitionCustomJob(transitionCustomJob(assigned,'in_progress','@handi'),'awaiting_customer','@handi'),'completed','@buyer');
  expect(done.status).toBe('completed');expect(done.events?.map(event=>event.type)).toEqual(['JOB_POSTED','JOB_OFFERED','JOB_ASSIGNED','JOB_STARTED','JOB_FINISHED','JOB_COMPLETED']);
  expect(()=>transitionCustomJob(done,'in_progress','@handi')).toThrow(/Cannot move/);
 });
 it('creates a unique, date-stamped request with an audit-friendly starter message',()=>{
  const first=request();const second=createServiceRequest({provider,category:provider.category,title:'Pipe check',details:'Check the pipe',area:'Osu',timing:'asap',now:new Date('2026-09-30T12:00:00.000Z'),random:()=>0.6});
  expect(first.id).toMatch(/^QH-20260930-/);expect(first.id).not.toBe(second.id);expect(first.messages[0].sender).toBe('system');
 });
 it('matches by service and local area, then uses transparent sample ratings',()=>{
  const results=matchHandis(handiDirectory,'pipe','All','Osu');
  expect(results).toHaveLength(1);expect(results[0].category).toBe('Plumbing');
  expect(matchHandis(handiDirectory,'I need someone to fix a leaking kitchen pipe tomorrow morning','All','Anywhere in Accra')[0].category).toBe('Plumbing');
 });
 it('permits a quote and booking progression but rejects invalid transitions',()=>{
  const job=saveQuote(request(),22500,'Includes fitting and inspection',new Date('2026-09-30T12:10:00Z'));
  expect(job.status).toBe('quoted');expect(job.quoteMinor).toBe(22500);
  expect(()=>transitionJob(job,'in_progress')).toThrow(/Cannot move/);
  const completed=transitionJob(transitionJob(transitionJob(transitionJob(job,'confirmed'),'in_progress'),'awaiting_customer'),'completed');
  expect(completed.status).toBe('completed');
 });
 it('never accepts zero or fractional-minor-unit quotes',()=>{
  expect(()=>saveQuote(request(),0,'')).toThrow(/at least/);
  expect(()=>saveQuote(request(),100.5,'')).toThrow(/at least/);
 });
});

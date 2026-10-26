import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { apiUrl } from '../../lib/api';
import './people-lookup.css';
import { FriendActions } from './FriendsPanel';

export type PublicPerson = { id:string; eco_id:string; display_name:string; followed:boolean; followsYou:boolean };
export default function PeopleLookup({userId,onSelect,initialQuery='',csrfToken=''}:{userId:string|null;onSelect:(person:PublicPerson)=>void;initialQuery?:string;csrfToken?:string}) {
  const [query,setQuery]=useState(initialQuery),[person,setPerson]=useState<PublicPerson|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0), pending=useRef<AbortController|null>(null);
  function invalidate() { generation.current++; pending.current?.abort(); setPerson(null); setMessage(''); setBusy(false); }
  // Reset identity/query generation before new controls can be clicked.
  useLayoutEffect(()=>{ invalidate(); setQuery(initialQuery); return ()=>{generation.current++;pending.current?.abort();}; },[userId,initialQuery]);
  async function find(e:FormEvent) {
    e.preventDefault(); if(!userId)return;
    invalidate(); const revision=generation.current, controller=new AbortController(); pending.current=controller;setBusy(true);
    try {
      const response=await fetch(apiUrl(`/people/lookup?ecoId=${encodeURIComponent(query.trim())}`),{credentials:'include',signal:controller.signal});
      const data=await response.json();
      if(revision!==generation.current)return;
      if(!response.ok)throw Error(data.error?.message||'People lookup is unavailable.');
      if(data.person&&typeof data.person.id==='string'&&typeof data.person.eco_id==='string'&&typeof data.person.display_name==='string')setPerson(data.person);
      else setMessage('No other active account matches that exact ID. Check the @name on their Profile.');
    } catch(error) { if(revision===generation.current&&!controller.signal.aborted)setMessage(error instanceof Error?error.message:'People lookup is unavailable.'); }
    finally {if(revision===generation.current)setBusy(false);}
  }
  return <section className="people-lookup" aria-label="Find an EcoVibes person">
    <h2>Find your person</h2><p>Use the exact @name on their Profile. Capital letters do not matter; dots and underscores do.</p>
    {!userId?<p>Sign in to find an EcoVibes ID.</p>:<><form onSubmit={find}><label>EcoVibes ID<input aria-label="Find EcoVibes ID" value={query} maxLength={25} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="@their_id" onChange={e=>{invalidate();setQuery(e.target.value);}}/></label><button type="submit" disabled={busy||!query.trim()}>{busy?'Finding…':'Find person'}</button></form>
    {message&&<p role="status">{message}</p>}{person&&<><article><div><strong>{person.display_name}</strong><span>@{person.eco_id}</span></div><button type="button" onClick={()=>onSelect(person)} aria-label={`Select ${person.display_name}`}>Select</button></article>{csrfToken&&<FriendActions key={`${userId}:${person.id}`} userId={userId} csrfToken={csrfToken} person={person}/>}</>}</>}
  </section>;
}

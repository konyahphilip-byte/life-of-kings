import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Communications from './Communications';

const {mediaMount}=vi.hoisted(()=>({mediaMount:vi.fn()}));
vi.mock('@livekit/components-react',()=>({LiveKitRoom:()=>{mediaMount();return null;},AudioConference:()=>null,VideoConference:()=>null,RoomAudioRenderer:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});

function setup() {
  const writes:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:unknown,init?:RequestInit)=>{
    const path=String(input); if(init?.method==='POST')writes.push(path);
    const body=path.endsWith('/auth/me')?{user:{id:'caller',eco_id:'akonyah',display_name:'Caller'},csrfToken:'synthetic-csrf'}:
      path.endsWith('/media/status')?{configured:true,privateCallsConfigured:false}:
      path.endsWith('/media/sessions')?{sessions:[],configured:true}:
      path.includes('/people/lookup?')?{person:{id:'peer',eco_id:'philip_konyah',display_name:'Philip',followed:false,followsYou:false}}:{};
    return new Response(JSON.stringify(body));
  }));return writes;
}

describe('calling setup remains honest',()=>{
  it('can verify a selected ID while private media is unavailable, without sending a call',async()=>{
    const writes=setup(); render(<Communications initialEcoId="@Philip_konyah"/>);
    const lookup=within(screen.getByRole('region',{name:'Find an EcoVibes person'}));
    fireEvent.click(await lookup.findByRole('button',{name:'Find person'}));
    fireEvent.click(await lookup.findByRole('button',{name:'Select Philip'}));
    expect(screen.getByText(/Selected: Philip · @philip_konyah/)).toBeTruthy();
    expect((screen.getByRole('button',{name:'Start video call'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/no call is sent while calling is unavailable/)).toBeTruthy();
    expect(writes).toEqual([]);expect(mediaMount).not.toHaveBeenCalled();
  });
  it('uses the account data setting and keeps camera-first calling unavailable in Extreme Saver',async()=>{
    setup();render(<Communications saver="extreme"/>);
    await screen.findByRole('button',{name:'Find person'});
    expect(screen.getByText(/Extreme Saver · audio first/)).toBeTruthy();
    expect(screen.queryByText(/LIVEKIT_API_SECRET/)).toBeNull();
    expect(mediaMount).not.toHaveBeenCalled();
  });
});

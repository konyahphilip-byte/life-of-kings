import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sidekick from './Sidekick';
import { appGuides } from './guide';
import { appReleaseUpdates } from '../../../shared/chale-updates.mjs';

const product = {
  id: '11111111-1111-4111-8111-111111111111', kind: 'product', title: 'Recycled plant pot',
  detail: 'Made from reclaimed plastic', category: 'Garden', destination: 'Marketplace', actor_eco_id: 'ama',
};
const diagnostic = {
  id: 'waste-requirements', title: 'Waste collection requirements', summary: 'Review the requirements for the collection workflow.',
  checks: [
    { label: 'Signed-in account', status: 'ready', detail: 'An authenticated EcoVibes session is available.' },
    { label: 'Provider approval', status: 'unknown', detail: 'Provider approval has not been checked.' },
  ], guideIds: ['waste'], destination: 'Waste',
};
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const props = { onNavigate: vi.fn(), page: 'Waste' as const, userId: 'account-a', csrfToken: 'csrf-a', dataMode: 'saver' as const, online: true };
type FetchHandler = (path: string, init?: RequestInit) => Response | Promise<Response>;

function mockFetch(handler?: FetchHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (handler) return handler(path, init);
    if (path.endsWith('/ai/status')) return response({ configured: true });
    if (path.endsWith('/recommendations')) return response({ enabled: true });
    if (path.endsWith('/ai/chat')) return response({ text: 'Here is a practical next step.', source: 'model', items: [], guides: [], drafts: [] });
    return response({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function openPanel() { fireEvent.click(screen.getByRole('button', { name: /Ask Chale AI/ })); fireEvent.click(screen.getByRole('checkbox',{name:/Allow model processing/})); }
function ask(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask Chale AI' }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
}

describe('Chale AI app integration', () => {
  beforeEach(() => { props.onNavigate.mockReset(); mockFetch(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('shows app records and news as separate linked source groups, not a model answer',async()=>{
    const date=new Date().toISOString();
    mockFetch(path=>path.endsWith('/ai/chat')?response({source:'public_updates',text:'Indexed headlines, not a popularity ranking.',entries:[...appReleaseUpdates,{kind:'ghana',source:'Ghana News Agency',title:'Publisher headline for Ghana',url:'https://gna.org.gh/example/',date},{kind:'world',source:'Reuters',title:'World publisher headline',url:'https://www.reuters.com/world/example/',date}]}):response({configured:true}));
    render(<Sidekick {...props}/>);openPanel();ask("What's trending?");
    await screen.findByLabelText('Ghana news');
    expect(screen.getByLabelText('EcoVibes updates')).not.toBeNull();expect(screen.getByLabelText('World news')).not.toBeNull();
    const link=screen.getByRole('link',{name:'Publisher headline for Ghana'});expect(link.getAttribute('href')).toBe('https://gna.org.gh/example/');expect(link.getAttribute('rel')).toContain('noopener');expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.getByText('Updates and sources')).not.toBeNull();
    expect(screen.queryByLabelText('Reply evidence')).toBeNull();
  });

  it('rejects unsafe links, forged releases and stale news in an updates reply',async()=>{
    mockFetch(path=>path.endsWith('/ai/chat')?response({source:'public_updates',text:'No verified current news.',entries:[{kind:'app',source:'EcoVibes release record',title:'Payments are live',url:'https://evil.example/',date:new Date().toISOString()},{kind:'ghana',source:'Ghana News Agency',title:'Unsafe news',url:'javascript:alert(1)',date:new Date().toISOString()},{kind:'world',source:'Reuters',title:'Old news',url:'https://www.reuters.com/old/',date:'2020-01-01T00:00:00.000Z'}]}):response({configured:true}));
    render(<Sidekick {...props}/>);openPanel();ask('Latest world news');
    await screen.findByText('No verified current news.');
    expect(screen.queryByRole('link',{name:'Unsafe news'})).toBeNull();expect(screen.queryByRole('link',{name:'Payments are live'})).toBeNull();expect(screen.queryByRole('link',{name:'Old news'})).toBeNull();
  });

  it('does not attribute an app-only digest to an external news lookup',async()=>{
    mockFetch(path=>path.endsWith('/ai/chat')?response({source:'public_updates',newsStatus:'not_requested',text:'Versioned app release records.',entries:appReleaseUpdates}):response({configured:true}));
    render(<Sidekick {...props}/>);openPanel();ask('Latest EcoVibes app updates');
    await screen.findByText('Versioned app release records.');
    expect(screen.queryByRole('link',{name:'GDELT Project'})).toBeNull();
  });

  it.each(['hi', 'HELLO!', 'Hey Chale', 'Good morning, Chale AI!', 'hello there'])('answers the whole-message greeting %s without spending a question or choosing a task', value => {
    const fetchMock=mockFetch();
    render(<Sidekick {...props}/>);openPanel();ask(value);
    expect(screen.queryByText('Hi! What would you like help with today?')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([url])=>String(url).endsWith('/ai/chat'))).toBe(false);
    expect(props.onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Reply evidence')).toBeNull();
    expect(screen.queryByRole('button',{name:'Open Waste'})).toBeNull();
  });

  it('answers a greeting offline instead of selecting a workflow',()=>{
    const fetchMock=mockFetch();
    render(<Sidekick {...props} online={false}/>);openPanel();ask('Hi');
    expect(screen.queryByText('Hi! What would you like help with today?')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([url])=>String(url).endsWith('/ai/chat'))).toBe(false);
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it.each(['how are you', 'Hi, how are you?', 'How are you doing, Chale AI?'])('answers the whole conversational greeting %s without an unrelated workflow',value=>{
    const fetchMock=mockFetch();
    render(<Sidekick {...props}/>);openPanel();ask(value);
    expect(screen.queryByText("I'm here and ready to help. What would you like to talk about?")).not.toBeNull();
    expect(fetchMock.mock.calls.some(([url])=>String(url).endsWith('/ai/chat'))).toBe(false);
    expect(screen.queryByLabelText('Reply evidence')).toBeNull();
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it('keeps a substantive how-are-you question on the normal answer path',async()=>{
    const fetchMock=mockFetch();
    render(<Sidekick {...props}/>);openPanel();ask('How are you protecting my account?');
    await screen.findByText('Here is a practical next step.');
    expect(fetchMock.mock.calls.some(([url])=>String(url).endsWith('/ai/chat'))).toBe(true);
    expect(screen.queryByText("I'm here and ready to help. What would you like to talk about?")).toBeNull();
  });

  it('keeps a real question after a greeting on the normal answer path',async()=>{
    const fetchMock=mockFetch();
    render(<Sidekick {...props}/>);openPanel();ask('Hi, how do I request a collection?');
    await screen.findByText('Here is a practical next step.');
    expect(fetchMock.mock.calls.some(([url])=>String(url).endsWith('/ai/chat'))).toBe(true);
    expect(screen.queryByText('Hi! What would you like help with today?')).toBeNull();
  });

  it('reads owned work counts explicitly even when model inference is unavailable, keeping them out of chat',async()=>{
    const work={accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]};
    const fetch=mockFetch(path=>path.endsWith('/ai/work-status')?response(work):path.endsWith('/ai/chat')?response({text:'Open your Waste jobs.',source:'model'}):response({configured:false,enabled:false}));
    render(<Sidekick {...props}/>);openPanel();
    expect(fetch.mock.calls.some(([url])=>String(url).endsWith('/ai/work-status'))).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    expect((await screen.findByLabelText('Waste open jobs')).textContent).toContain('2');
    expect(screen.getByText(/Counts stay in your signed-in screen/)).toBeTruthy();
    ask('How can I view my Waste jobs?');await screen.findByText('Open your Waste jobs.');
    const chat=fetch.mock.calls.find(([url])=>String(url).endsWith('/ai/chat'))?.[1];
    expect(String(chat?.body)).not.toMatch(/job_status_counts|account-a|"groups"|"count"/);
    const status=fetch.mock.calls.find(([url])=>String(url).endsWith('/ai/work-status'))?.[1];
    expect(status?.credentials).toBe('include');
  });
  it('clears a work summary immediately when the account changes',async()=>{
    mockFetch(path=>path.endsWith('/ai/work-status')?response({accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]}):response({configured:false}));
    const view=render(<Sidekick {...props}/>);openPanel();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    await screen.findByLabelText('Waste open jobs');
    view.rerender(<Sidekick {...props} userId="account-b"/>);
    expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
  });
  it('does not apply a late work response after an account switch',async()=>{
    let resolveWork!:(response:Response)=>void;
    mockFetch(path=>path.endsWith('/ai/work-status')?new Promise(resolve=>{resolveWork=resolve;}):response({configured:false}));
    const view=render(<Sidekick {...props}/>);openPanel();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    view.rerender(<Sidekick {...props} userId="account-b"/>);
    await act(async()=>{resolveWork(response({accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]}));});
    expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
  });
  it.each([
    {accountId:'account-b',groups:[{workflow:'waste',status:'open',count:2}]},
    {accountId:'account-a',groups:[{workflow:'waste',status:'recycled',count:2}]},
    {accountId:'account-a',groups:[{workflow:'waste',status:'open',count:-1}]},
    {accountId:'account-a',groups:[{workflow:['waste'],status:'open',count:2}]},
    {accountId:'account-a',groups:[{workflow:'waste',status:'open',count:2},{workflow:'waste',status:'open',count:3}]},
  ])('rejects mismatched or malformed work data %#',async(data)=>{
    mockFetch(path=>path.endsWith('/ai/work-status')?response({source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',...data}):response({configured:false}));
    render(<Sidekick {...props}/>);openPanel();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    await screen.findByText(/Could not check your work/);
    expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
  });
  it('removes old counts on a failed refresh',async()=>{
    let fail=false;mockFetch(path=>path.endsWith('/ai/work-status')?response(fail?{error:{message:'unavailable'}}:{accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]},fail?503:200):response({configured:false}));
    render(<Sidekick {...props}/>);openPanel();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    await screen.findByLabelText('Waste open jobs');fail=true;fireEvent.click(screen.getByRole('button',{name:'Refresh my work status'}));
    await screen.findByText(/Could not check your work/);expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
  });
  it('clears work counts and prevents a refresh while offline',async()=>{
    mockFetch(path=>path.endsWith('/ai/work-status')?response({accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]}):response({configured:false}));
    const view=render(<Sidekick {...props}/>);openPanel();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    await screen.findByLabelText('Waste open jobs');view.rerender(<Sidekick {...props} online={false}/>);
    expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
    expect((screen.getByRole('button',{name:'Check my work status'}) as HTMLButtonElement).disabled).toBe(true);
  });
  it('times out an unanswered work read and ignores its late result',async()=>{
    let resolveWork!:(response:Response)=>void;
    mockFetch(path=>path.endsWith('/ai/work-status')?new Promise(resolve=>{resolveWork=resolve;}):response({configured:false}));
    render(<Sidekick {...props}/>);openPanel();vi.useFakeTimers();fireEvent.click(screen.getByRole('button',{name:'Check my work status'}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(10001);});
    expect(screen.getByText(/Could not check your work/)).toBeTruthy();
    await act(async()=>{resolveWork(response({accountId:'account-a',source:'job_status_counts',asOf:'2026-10-23T12:00:00.000Z',groups:[{workflow:'waste',status:'open',count:2}]}));});
    expect(screen.queryByLabelText('Waste open jobs')).toBeNull();
  });

  it('sends page and data mode with cookies and CSRF, without account data', async () => {
    const fetchMock = mockFetch();
    render(<Sidekick {...props}/>); openPanel(); ask('How do I request a collection?');
    await screen.findByText('Here is a practical next step.');
    const chatCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/ai/chat'));
    expect(chatCall).toBeTruthy();
    const init = chatCall?.[1];
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-a');
    expect(JSON.parse(String(init?.body))).toEqual({ messages: [{ role: 'user', content: 'How do I request a collection?' }], context: { currentPage: 'Waste', dataMode: 'saver' } });
    expect(String(init?.body)).not.toContain('account-a');
  });

  it('shows the local model disclosure and member allowance without claiming a live health check', async () => {
    mockFetch(() => response({ configured: true, hosting: 'local', dailyRequests: 20, guestDailyRequests: 5 }));
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Model configured');
    expect(screen.getByText(/model on the EcoVibes server/).textContent).toContain('20 requests per day');
    expect(screen.getByText(/model on the EcoVibes server/).textContent).toContain('Failed or busy attempts count');
  });

  it('explains the free allowance limit while retaining usable app guidance', async () => {
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ error: { code: 'ai_daily_limit' } }, 429) : response({ configured: true }));
    render(<Sidekick {...props}/>); openPanel(); ask('How do I request waste collection?');
    await screen.findByText(/Today’s free Chale allowance has been used/);
    expect(screen.getByText(/It resets at 00:00 UTC/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Open Waste' }).length).toBeGreaterThan(0);
  });

  it('describes its EcoVibes scope and reports configuration without claiming live availability', async () => {
    render(<Sidekick {...props}/>); openPanel();
    expect(screen.getByText(/your EcoVibes assistant/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask about EcoVibes or an app problem')).toBeTruthy();
    await screen.findByText('Model configured');
    expect(screen.queryByText('Ready to help')).toBeNull();
    expect(screen.queryByLabelText('Reply evidence')).toBeNull();
  });

  it('renders bounded requirement checks with canonical steps and an honest diagnostic scope', async () => {
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'Check the requirements below.', diagnostics: [{
      ...diagnostic, steps: ['Invented step: transfer money to unlock collections'],
    }] }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel(); ask('Why is my collection not working?');
    await screen.findByText(diagnostic.title);
    expect(screen.getByText('Requirement met')).toBeTruthy();
    expect(screen.getByText('Not checked')).toBeTruthy();
    expect(screen.getByText('Guide and configuration checks only. Live operation has not been tested.')).toBeTruthy();
    expect(screen.getByText(appGuides.find((guide) => guide.id === 'waste')!.steps[0])).toBeTruthy();
    expect(screen.queryByText('Invented step: transfer money to unlock collections')).toBeNull();
    expect(screen.getByLabelText('Reply evidence').textContent).toContain('1 guide and configuration check');
    fireEvent.click(screen.getByRole('button', { name: 'Open Waste' }));
    expect(props.onNavigate).toHaveBeenCalledWith('Waste');
  });

  it('rejects forged diagnostic destinations, unknown guides, malformed checks and unsafe text', async () => {
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'No safe checks were returned.', diagnostics: [
      { ...diagnostic, destination: 'javascript:alert(1)' },
      { ...diagnostic, id: 'wrong-section', destination: 'Settings' },
      { ...diagnostic, id: 'unknown-guide', guideIds: ['invented'] },
      { ...diagnostic, id: 'bad-status', checks: [{ label: 'Payment', status: 'healthy', detail: 'Everything is healthy.' }] },
      { ...diagnostic, id: 'bad-detail', checks: [{ label: 'Account', status: 'ready', detail: { secret: 'sensitive' } }] },
      { ...diagnostic, id: 'html', summary: '<img src=x onerror=alert(1)>' },
      { ...diagnostic, id: 'link', summary: 'Use https://untrusted.example to fix it.' },
      { ...diagnostic, id: 'email', summary: 'Account address: private@example.com' },
      { ...diagnostic, id: 'phone', summary: 'Account phone: +233 555 123 456' },
      { ...diagnostic, id: 'too-long', summary: 'x'.repeat(501) },
    ], sources: ['Fake health evidence'], confidence: 1 }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel(); ask('Diagnose collection');
    await screen.findByText('No safe checks were returned.');
    expect(screen.queryByText(diagnostic.title)).toBeNull();
    expect(screen.queryByText('Everything is healthy.')).toBeNull();
    expect(screen.queryByText(/private@example/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByLabelText('Reply evidence')).toBeNull();
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it('limits diagnostic cards and reports only returned evidence', async () => {
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'Review these checks.', diagnostics: [
      diagnostic, { ...diagnostic, id: 'two', title: 'Second requirement card' },
      { ...diagnostic, id: 'three', title: 'Third requirement card' },
      { ...diagnostic, id: 'four', title: 'Fourth requirement card' },
    ], guides: [{ id: 'settings', destination: 'Settings' }], items: [product] }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel(); ask('Check my EcoVibes setup');
    await screen.findByText('Third requirement card');
    expect(screen.queryByText('Fourth requirement card')).toBeNull();
    expect(screen.getByLabelText('Reply evidence').textContent).toBe('Evidence returned: 1 verified app guide entry · 1 public catalog listing · 3 guide and configuration checks.');
  });

  it('provides offline app steps and valid navigation without fetching', async () => {
    const fetchMock = mockFetch();
    render(<Sidekick {...props} online={false}/>); openPanel(); ask('How do I request waste collection?');
    expect(await screen.findByText('App guide')).toBeTruthy();
    expect(screen.getByText('Arrange a Waste & Recycling request')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Waste' }));
    expect(props.onNavigate).toHaveBeenCalledWith('Waste');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses canonical guide content and rejects forged guide destinations', async () => {
    const settings = appGuides.find((entry) => entry.id === 'settings');
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'Review these steps.', guides: [
      { id: 'settings', destination: 'Settings', summary: 'Invented provider setup' },
      { id: 'waste', destination: 'javascript:alert(1)' },
      { id: 'unknown', destination: 'Home' },
    ], items: [ { ...product, destination: 'Settings' } ] }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel(); ask('Open settings');
    expect(await screen.findByText(settings!.summary)).toBeTruthy();
    expect(screen.queryByText('Invented provider setup')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Waste' })).toBeNull();
    expect(screen.queryByText(product.title)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(props.onNavigate).toHaveBeenCalledWith('Settings');
  });

  it('falls back to verified guides after provider failure and caps saver catalogue requests', async () => {
    const fetchMock = mockFetch((path) => {
      if (path.endsWith('/ai/chat')) return response({ error: { code: 'ai_unavailable' } }, 503);
      if (path.endsWith('/search')) return response({ items: [product] });
      return response({ configured: true, enabled: true });
    });
    render(<Sidekick {...props}/>); openPanel(); ask('Find a recycling product service near me');
    expect(await screen.findByText(product.title)).toBeTruthy();
    expect(screen.getByText('App guide')).toBeTruthy();
    expect(screen.getByText('Arrange a Waste & Recycling request')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/search?'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/ai/chat'))).toHaveLength(1);
  });

  it('keeps messaging guidance honest when inference is unavailable', async () => {
    mockFetch((path) => path.endsWith('/ai/chat')
      ? response({ error: { code: 'ai_unavailable' } }, 503)
      : response({ configured: false, enabled: false }));
    render(<Sidekick {...props} page="Messages"/>); openPanel(); ask('How do I send a message about my job?');
    const messages = appGuides.find(entry => entry.id === 'messages')!;
    expect(await screen.findByText(messages.summary)).toBeTruthy();
    expect(screen.getByText('App guide')).toBeTruthy();
    expect(screen.getByText(/Choose Open job conversations/)).toBeTruthy();
    expect(screen.queryByText('Message sent')).toBeNull();
  });

  it('records only explicit listing signals with enabled consent, UUID, cookies and CSRF', async () => {
    const fetchMock = mockFetch((path) => path.endsWith('/ai/chat')
      ? response({ text: 'Here is a public listing.', items: [product, { ...product, id: 'sample-product', title: 'Sample item' }] })
      : response({ configured: true, enabled: true }));
    const changed = vi.fn();
    window.addEventListener('ecovibes:recommendations_changed', changed);
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is on. Save or show less to tune it.');
    ask('Find a product');
    fireEvent.click(await screen.findByRole('button', { name: 'Save Recycled plant pot' }));
    await screen.findByText('Saved to your learning profile.');
    expect(screen.queryByRole('button', { name: 'Save Sample item' })).toBeNull();
    let signalCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/recommendations/signals'));
    expect(signalCalls).toHaveLength(1);
    expect(JSON.parse(String(signalCalls[0][1]?.body))).toEqual({ itemType: 'product', itemId: product.id, action: 'saved', active: true });
    expect(new Headers(signalCalls[0][1]?.headers).get('X-CSRF-Token')).toBe('csrf-a');
    expect(signalCalls[0][1]?.credentials).toBe('include');
    fireEvent.click(screen.getByRole('button', { name: 'Unsave Recycled plant pot' }));
    await screen.findByText('Removed that saved signal.');
    fireEvent.click(screen.getByRole('button', { name: 'Show less like Recycled plant pot' }));
    await screen.findByText('EcoVibes will show you less like this.');
    signalCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/recommendations/signals'));
    expect(JSON.parse(String(signalCalls[1][1]?.body))).toMatchObject({ action: 'saved', active: false });
    expect(JSON.parse(String(signalCalls[2][1]?.body))).toMatchObject({ action: 'dismissed', active: true });
    expect(changed).toHaveBeenCalledTimes(3);
    window.removeEventListener('ecovibes:recommendations_changed', changed);
  });

  it('does not expose signal controls or enable learning when consent is paused', async () => {
    const fetchMock = mockFetch((path) => path.endsWith('/ai/chat')
      ? response({ text: 'Here is a listing.', items: [product] }) : response({ configured: true, enabled: false }));
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is paused.'); ask('Find a product');
    await screen.findByText(product.title);
    expect(screen.queryByRole('button', { name: 'Save Recycled plant pot' })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/recommendations/signals'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tune learning on Home' }));
    expect(props.onNavigate).toHaveBeenCalledWith('Home');
  });

  it('respects consent paused on the server after the panel was opened', async () => {
    const fetchMock = mockFetch((path) => {
      if (path.endsWith('/ai/chat')) return response({ text: 'Here is a listing.', items: [product] });
      if (path.endsWith('/recommendations/signals')) return response({ ok: true, active: false, paused: true });
      return response({ configured: true, enabled: true });
    });
    const changed = vi.fn();
    window.addEventListener('ecovibes:recommendations_changed', changed);
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is on. Save or show less to tune it.');
    ask('Find a product');
    fireEvent.click(await screen.findByRole('button', { name: 'Save Recycled plant pot' }));
    await screen.findByText('Learning is paused. No feedback was saved.');
    expect(screen.queryByRole('button', { name: 'Save Recycled plant pot' })).toBeNull();
    expect(screen.queryByText('Saved to your learning profile.')).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/recommendations/signals'))).toHaveLength(1);
    window.removeEventListener('ecovibes:recommendations_changed', changed);
  });

  it('refreshes learning while open and ignores a superseded consent response', async () => {
    let reads = 0;
    let resolveOld: (value: Response) => void = () => {};
    let oldSignal: AbortSignal | null | undefined;
    mockFetch((path, init) => {
      if (path.endsWith('/ai/chat')) return response({ text: 'Here is a listing.', items: [product] });
      if (path.endsWith('/recommendations')) {
        reads += 1;
        if (reads === 2) {
          oldSignal = init?.signal;
          return new Promise<Response>((resolve) => { resolveOld = resolve; });
        }
        return response({ enabled: reads === 1 });
      }
      return response({ configured: true });
    });
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is on. Save or show less to tune it.');
    ask('Find a product'); await screen.findByRole('button', { name: 'Save Recycled plant pot' });
    act(() => window.dispatchEvent(new Event('ecovibes:recommendations_changed')));
    expect(screen.queryByRole('button', { name: 'Save Recycled plant pot' })).toBeNull();
    act(() => window.dispatchEvent(new Event('ecovibes:recommendations_changed')));
    await screen.findByText('Learning is paused.');
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => resolveOld(response({ enabled: true })));
    expect(screen.getByText('Learning is paused.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Recycled plant pot' })).toBeNull();
  });

  it('clears local saved toggles after an explicit profile reset event', async () => {
    mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'Here is a listing.', items: [product] }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is on. Save or show less to tune it.');
    ask('Find a product'); fireEvent.click(await screen.findByRole('button', { name: 'Save Recycled plant pot' }));
    await screen.findByRole('button', { name: 'Unsave Recycled plant pot' });
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:recommendations_changed', { detail: { reset: true } })));
    await screen.findByRole('button', { name: 'Save Recycled plant pot' });
    expect(screen.queryByRole('button', { name: 'Unsave Recycled plant pot' })).toBeNull();
  });

  it('aborts pending feedback and ignores its late result after a profile reset', async () => {
    let resolveSignal: (value: Response) => void = () => {};
    let pendingSignal: AbortSignal | null | undefined;
    mockFetch((path, init) => {
      if (path.endsWith('/ai/chat')) return response({ text: 'Here is a listing.', items: [product] });
      if (path.endsWith('/recommendations/signals')) {
        pendingSignal = init?.signal;
        return new Promise<Response>((resolve) => { resolveSignal = resolve; });
      }
      return response({ configured: true, enabled: true });
    });
    render(<Sidekick {...props}/>); openPanel();
    await screen.findByText('Learning is on. Save or show less to tune it.');
    ask('Find a product'); fireEvent.click(await screen.findByRole('button', { name: 'Save Recycled plant pot' }));
    act(() => window.dispatchEvent(new CustomEvent('ecovibes:recommendations_changed', { detail: { reset: true } })));
    expect(pendingSignal?.aborted).toBe(true);
    await screen.findByRole('button', { name: 'Save Recycled plant pot' });
    await act(async () => resolveSignal(response({ ok: true, active: true, action: 'saved' })));
    expect(screen.queryByRole('button', { name: 'Unsave Recycled plant pot' })).toBeNull();
    expect(screen.queryByText('Saved to your learning profile.')).toBeNull();
  });

  it('keeps long conversation history within the API message and total length limits', async () => {
    const fetchMock = mockFetch((path) => path.endsWith('/ai/chat')
      ? response({ text: 'A'.repeat(6000), source: 'model' }) : response({ configured: true, enabled: true }));
    render(<Sidekick {...props}/>); openPanel();
    for (let index = 0; index < 5; index += 1) {
      ask(`${index}: ${'question '.repeat(140)}`);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop answer' })).toBeNull());
    }
    const chatCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/ai/chat'));
    expect(chatCalls).toHaveLength(5);
    for (const [, init] of chatCalls) {
      const { messages } = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      expect(messages.length).toBeLessThanOrEqual(8);
      expect(messages.reduce((length, message) => length + message.content.length, 0)).toBeLessThanOrEqual(6000);
      expect(messages.every((message) => message.content.length <= 1200)).toBe(true);
      expect(messages.at(-1)?.role).toBe('user');
    }
  });

  it('clears account history and ignores a late response after identity changes', async () => {
    let resolveOld: (value: Response) => void = () => {};
    let chatCount = 0;
    const fetchMock = mockFetch((path) => {
      if (path.endsWith('/ai/chat')) {
        chatCount += 1;
        if (chatCount === 1) return new Promise<Response>((resolve) => { resolveOld = resolve; });
        return response({ text: 'New account reply.' });
      }
      return response({ configured: true, enabled: true });
    });
    const view = render(<Sidekick {...props}/>); openPanel(); ask('Private question from account A');
    await waitFor(() => expect(chatCount).toBe(1));
    const firstCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/ai/chat'));
    view.rerender(<Sidekick {...props} userId="account-b" csrfToken="csrf-b"/>);
    expect(firstCall?.[1]?.signal?.aborted).toBe(true);
    expect(screen.queryByText('Private question from account A')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox',{name:/Allow model processing/}));
    ask('A question from account B');
    await screen.findByText('New account reply.');
    await act(async () => resolveOld(response({ text: 'Old private answer.' })));
    expect(screen.queryByText('Old private answer.')).toBeNull();
    const newCall = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/ai/chat'))[1];
    expect(String(newCall[1]?.body)).not.toContain('account A');
    expect(new Headers(newCall[1]?.headers).get('X-CSRF-Token')).toBe('csrf-b');
  });

  it('lets users stop a pending answer and ask again without retrying it', async () => {
    let chats = 0;
    mockFetch((path, init) => {
      if (!path.endsWith('/ai/chat')) return response({ configured: true, enabled: true });
      chats += 1;
      if (chats > 1) return response({ text: 'A fresh answer.' });
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    });
    render(<Sidekick {...props}/>); openPanel(); ask('Wait for this answer');
    fireEvent.click(screen.getByRole('button', { name: 'Stop answer' }));
    await screen.findByText('Stopped. Your question has not been retried.');
    ask('A fresh question'); await screen.findByText('A fresh answer.');
    expect(chats).toBe(2);
  });

  it('shows reviewable drafts and copies them without publishing or submitting', async () => {
    const fetchMock = mockFetch((path) => path.endsWith('/ai/chat') ? response({ text: 'Review this idea.', drafts: [{
      id: 'idea-1', kind: 'improvement', title: 'Neighbourhood collection pilot', problem: 'Missed pickups', benefit: 'A reliable route', experiment: 'Try one street for a week', risk: 'Keep addresses private',
    }] }) : response({ configured: true, enabled: true }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<Sidekick {...props}/>); openPanel(); ask('Improve collection');
    await screen.findByText('Neighbourhood collection pilot');
    expect(screen.getByText('Draft only. Nothing has been submitted.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy draft' }));
    await screen.findByText('Draft copied. Review it before you share it.');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Try one street for a week'));
    expect(fetchMock.mock.calls.filter(([url, init]) => init?.method === 'POST' && !String(url).endsWith('/ai/chat'))).toHaveLength(0);
  });

  it('closes with Escape and returns focus to its launcher', () => {
    render(<Sidekick {...props} online={false}/>); openPanel();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Ask Chale AI/ }));
  });
});

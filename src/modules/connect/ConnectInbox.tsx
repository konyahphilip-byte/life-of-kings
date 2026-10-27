import { useId, useState } from 'react';
import { ArrowRight, MessageCircle, Send, ShieldCheck } from 'lucide-react';
import './connect-inbox.css';
import DirectMessages from './DirectMessages';

const examples = [
  { name: 'Esi Owusu', initials: 'EO', message: 'That sounds perfect, see you then!' },
  { name: 'Ama Serwaa', initials: 'AS', message: 'Here is an example of a product conversation.' },
  { name: 'Weekend Arena', initials: 'WA', message: 'Here is an example of a group conversation.' },
];

export default function ConnectInbox({ onOpenJobs,userId=null,csrfToken='' }: { onOpenJobs: () => void;userId?:string|null;csrfToken?:string }) {
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState(0);
  const previewId = useId();
  const example = examples[selected];

  return <section className="connect-inbox" aria-labelledby="connect-heading">
    <header className="page-title-row">
      <div><span className="eyebrow">ECOVIBES CONNECT</span><h1 id="connect-heading">Messages</h1><p>Keep conversations connected to the work you share.</p></div>
    </header>
    {userId&&csrfToken?<DirectMessages key={userId} userId={userId} csrfToken={csrfToken}/>:<section className="connect-availability" aria-labelledby="connect-availability-heading">
      <MessageCircle size={26} aria-hidden="true"/>
      <div>
        <span className="connect-label">PRIVATE CONVERSATIONS</span>
        <h2 id="connect-availability-heading">Sign in to message your friends</h2>
        <p>Your private conversations are only available while you are signed in. Accept a friend request before starting a conversation.</p>
      </div>
    </section>}
    <section className="connect-job-conversations" aria-labelledby="connect-jobs-heading">
      <div>
        <span className="eyebrow">FOR YOUR SHARED JOBS</span>
        <h2 id="connect-jobs-heading">Use the conversation attached to your job</h2>
        <p>Open EcoVibes ID → Quick&amp;Handi and find your own or assigned job. Its customer and assigned provider can use that job’s message form.</p>
        <p className="connect-privacy"><ShieldCheck size={16} aria-hidden="true"/> Job access is checked by the server. Signing in does not give access to other people’s conversations.</p>
      </div>
      <button type="button" className="button button-primary" onClick={onOpenJobs}>Open job conversations <ArrowRight size={16} aria-hidden="true"/></button>
    </section>
    <button type="button" className="connect-preview-toggle" aria-expanded={preview} aria-controls={previewId} onClick={() => setPreview(value => !value)}>
      {preview ? 'Hide sample conversations' : 'View sample conversations'}
    </button>
    {preview && <section id={previewId} aria-label="Read-only messaging sample" className="connect-preview">
      <p className="connect-sample-notice"><b>Read-only sample.</b> These are fictional conversations, not your inbox. Sending, attachments, presence and delivery receipts are unavailable.</p>
      <div className="messages-layout">
        <aside className="conversation-list" aria-label="Sample conversations">
          <div className="conversation-tools"><b>Sample inbox</b></div>
          {examples.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} className={`conversation ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)}>
            <span className="avatar avatar-md">{item.initials}</span>
            <span><b>{item.name}</b><small>{item.message}</small></span><small>Sample</small>
          </button>)}
        </aside>
        <section className="chat-panel" aria-label={`Sample conversation with ${example.name}`}>
          <div className="chat-head"><span className="avatar avatar-md">{example.initials}</span><span><b>{example.name}</b><small>Fictional conversation</small></span></div>
          <div className="chat-body"><div className="chat-date">SAMPLE · NOT LIVE</div><div className="chat-message theirs">{example.message}</div><div className="chat-offline-note">No message has been sent or received.</div></div>
          <div className="chat-compose"><input disabled aria-label="Sample message (sending unavailable)" placeholder="Read-only sample — sending unavailable"/><button type="button" disabled className="send-button" aria-label="Send sample message (unavailable)"><Send size={17} aria-hidden="true"/></button></div>
        </section>
      </div>
    </section>}
  </section>;
}

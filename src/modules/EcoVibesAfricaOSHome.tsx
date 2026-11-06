import { ArrowRight, Fingerprint, Gamepad2, Search, ShoppingBag, Sparkles, Users, Wallet, BriefcaseBusiness, type LucideIcon } from 'lucide-react';
import {DepthScene,DepthToggle,useDepthView} from './DepthView';
import './eco-home-depth.css';

type EcoVibesDestination = 'Communities' | 'Reels' | 'Gaming' | 'Marketplace' | 'Opportunities' | 'Wallet' | 'Money & Trust' | 'EcoVibes ID';
type Pillar = { name: string; detail: string; icon: LucideIcon; destination: EcoVibesDestination; position: string; tone: string };

const pillars: Pillar[] = [
  { name: 'Connect', detail: 'People · groups · chat', icon: Users, destination: 'Communities', position: 'connect', tone: 'mint' },
  { name: 'Create', detail: 'Creators · stories · live', icon: Sparkles, destination: 'Reels', position: 'create', tone: 'lime' },
  { name: 'Play', detail: 'Games · tournaments', icon: Gamepad2, destination: 'Gaming', position: 'play', tone: 'lilac' },
  { name: 'Trade', detail: 'Products · services', icon: ShoppingBag, destination: 'Marketplace', position: 'trade', tone: 'peach' },
  { name: 'Grow', detail: 'Jobs · grants · skills', icon: BriefcaseBusiness, destination: 'Opportunities', position: 'grow', tone: 'sky' },
  { name: 'Earn', detail: 'Money & Trust', icon: Wallet, destination: 'Money & Trust', position: 'earn', tone: 'gold' },
];

export function EcoVibesAfricaOSHome({ onNavigate, onAskAI, saver='saver' }: { saver?:'standard'|'saver'|'extreme'; onNavigate?: (destination: EcoVibesDestination) => void; onAskAI?: () => void }) {
  const view=useDepthView(saver);
  const navigate = (destination: EcoVibesDestination) => onNavigate?.(destination);
  return <>
    <section className="ev-os" aria-labelledby="ev-os-title">
      <div className="ev-os-copy">
        <h2 id="ev-os-title">One ID.<br/><em>Room for your whole world.</em></h2>
        <p>Connect with your people, discover what’s next and make more happen—all across one low-data ecosystem.</p>
        <div className="ev-os-actions">
          <button className="ev-os-primary" onClick={() => navigate('EcoVibes ID')}>Explore your ID <ArrowRight size={14}/></button>
          <button className="ev-os-secondary" onClick={onAskAI}><Sparkles size={14}/> Ask Chale AI</button>
        </div>
        <div className="ev-os-proof"><Search size={12}/> One place to discover, connect and grow</div>
      </div>
      <div className="ev-os-visual"><div className="ev-os-view-control"><DepthToggle view={view}/></div><DepthScene kind="home" depth={view.depth}/><button className="ev-os-id-link" onClick={()=>navigate('EcoVibes ID')}><Fingerprint size={18}/> Open your EcoVibes ID <ArrowRight size={15}/></button></div>
      <nav className="ev-os-pillars" aria-label="Explore the six EcoVibes ecosystem pillars">
        {pillars.map(({ name, detail, icon: Icon, destination, position, tone }) => <button key={name} className={`ev-os-node ${position} ${tone}`} onClick={() => navigate(destination)}>
          <span><Icon size={14}/></span><span><b>{name}</b><small>{detail}</small></span>
        </button>)}
      </nav>
    </section>
  </>;
}

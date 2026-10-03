import { ArrowRight, Fingerprint, Gamepad2, Search, ShoppingBag, Sparkles, Users, Wallet, BriefcaseBusiness, type LucideIcon } from 'lucide-react';

type EcoVibesDestination = 'Communities' | 'Reels' | 'Gaming' | 'Marketplace' | 'Opportunities' | 'Wallet' | 'EcoVibes ID';
type Pillar = { name: string; detail: string; icon: LucideIcon; destination: EcoVibesDestination; position: string; tone: string };

const pillars: Pillar[] = [
  { name: 'Connect', detail: 'People · groups · chat', icon: Users, destination: 'Communities', position: 'connect', tone: 'mint' },
  { name: 'Create', detail: 'Creators · stories · live', icon: Sparkles, destination: 'Reels', position: 'create', tone: 'lime' },
  { name: 'Play', detail: 'Games · tournaments', icon: Gamepad2, destination: 'Gaming', position: 'play', tone: 'lilac' },
  { name: 'Trade', detail: 'Products · services', icon: ShoppingBag, destination: 'Marketplace', position: 'trade', tone: 'peach' },
  { name: 'Grow', detail: 'Jobs · grants · skills', icon: BriefcaseBusiness, destination: 'Opportunities', position: 'grow', tone: 'sky' },
  { name: 'Earn', detail: 'Wallet · rewards', icon: Wallet, destination: 'Wallet', position: 'earn', tone: 'gold' },
];

const styles = `
.ev-os{--ev-ink:#f6f8ef;--ev-muted:#bdd0bd;position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(220px,.82fr) minmax(290px,1.18fr);gap:12px;min-height:283px;margin:0 0 17px;padding:22px 23px;border:1px solid #234d3e;border-radius:17px;background:radial-gradient(ellipse at 75% 49%,#286649 0,transparent 45%),linear-gradient(123deg,#0e392d 0%,#124734 52%,#183f32 100%);box-shadow:0 18px 42px #123c2c19;color:var(--ev-ink)}
.ev-os:before,.ev-os:after{content:"";position:absolute;z-index:-1;border:1px solid #b4e28c18;border-radius:50%;pointer-events:none}.ev-os:before{width:390px;height:390px;right:-92px;top:-223px}.ev-os:after{width:270px;height:270px;right:0;bottom:-205px}
.ev-os-copy{position:relative;z-index:1;align-self:center;max-width:370px}.ev-os-kicker{display:flex;align-items:center;gap:7px;margin:0 0 13px;color:#d2e49b;font-size:8px;font-weight:800;letter-spacing:1.35px}.ev-os-kicker i{width:6px;height:6px;border-radius:50%;background:#b8e778;box-shadow:0 0 0 4px #c0e68d1a}.ev-os h2{max-width:370px;margin:0;font:750 clamp(23px,3vw,31px)/1.08 Manrope,system-ui,sans-serif;letter-spacing:-1.2px}.ev-os h2 em{color:#c4e890;font-style:normal}.ev-os-copy>p{max-width:305px;margin:11px 0 16px;color:var(--ev-muted);font-size:10px;line-height:1.65}.ev-os-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ev-os-actions button{height:34px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border-radius:9px;font-size:8px;font-weight:750;transition:transform .2s ease,background .2s ease}.ev-os-actions button:hover{transform:translateY(-2px)}.ev-os-primary{border:1px solid #c1e394;background:#c1e394;color:#173e2e}.ev-os-secondary{border:1px solid #d7e7d433;background:#ffffff0b;color:#eef5e9}.ev-os-proof{display:flex;align-items:center;gap:6px;margin-top:15px;color:#afc4b1;font-size:7px}.ev-os-proof svg{color:#c3e89a}
.ev-os-map{position:relative;min-width:0;min-height:240px;align-self:center;isolation:isolate}.ev-os-lines{position:absolute;inset:6% 6%;width:88%;height:88%;z-index:-1;overflow:visible}.ev-os-lines path{fill:none;stroke:#c8e6aa45;stroke-width:1.2;stroke-dasharray:4 6}.ev-os-lines circle{fill:#c7e98f;filter:drop-shadow(0 0 4px #c7e98f)}
.ev-os-id{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:1px solid #e4f4d65c;border-radius:29px;background:linear-gradient(150deg,#2a7b57,#164c39 72%);box-shadow:0 14px 31px #071f1740,inset 1px 1px 0 #ffffff55,inset -8px -9px 16px #0b392c55;color:#f0f7e8;text-decoration:none;transition:transform .24s ease,box-shadow .24s ease}.ev-os-id:hover{transform:translate(-50%,-50%) translateY(-3px);box-shadow:0 19px 36px #071f1760,inset 1px 1px 0 #ffffff55}.ev-os-id>span{display:grid;place-items:center;width:34px;height:34px;border:1px solid #ffffff30;border-radius:12px;background:#ffffff11;color:#d1f098}.ev-os-id b{font:800 10px Manrope,system-ui,sans-serif;letter-spacing:.1px}.ev-os-id small{font-size:6px;letter-spacing:1.15px;color:#c5dbc5}
.ev-os-node{position:absolute;z-index:1;display:grid;grid-template-columns:27px auto;align-items:center;gap:7px;min-width:129px;padding:7px 9px;border:1px solid #ffffff26;border-radius:11px;background:#164634e8;box-shadow:0 8px 19px #09251c33;color:#eef5e9;text-align:left;backdrop-filter:blur(9px);transition:transform .2s ease,border-color .2s ease,background .2s ease}.ev-os-node:hover{transform:translateY(-2px);border-color:#c3e89091;background:#1b533d}.ev-os-node>span:first-child{width:27px;height:27px;display:grid;place-items:center;border-radius:8px}.ev-os-node>span:last-child{display:grid;gap:2px;min-width:0}.ev-os-node b{font-size:8px;line-height:1.1;text-transform:capitalize}.ev-os-node small{overflow:hidden;color:#bdd0bd;font-size:6px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.ev-os-node.connect{left:0;top:15%}.ev-os-node.create{left:50%;top:0;transform:translateX(-50%)}.ev-os-node.create:hover{transform:translate(-50%,-2px)}.ev-os-node.play{right:0;top:15%}.ev-os-node.trade{left:0;bottom:11%}.ev-os-node.grow{left:50%;bottom:0;transform:translateX(-50%)}.ev-os-node.grow:hover{transform:translate(-50%,-2px)}.ev-os-node.earn{right:0;bottom:11%}
.ev-os-node.mint>span:first-child{background:#b7e4c833;color:#b7e4c8}.ev-os-node.lime>span:first-child{background:#c7e89130;color:#d3f29a}.ev-os-node.lilac>span:first-child{background:#d3c2ff2b;color:#d8c9ff}.ev-os-node.peach>span:first-child{background:#ffc6a329;color:#ffc6a3}.ev-os-node.sky>span:first-child{background:#a9d9ff29;color:#b7ddff}.ev-os-node.gold>span:first-child{background:#f3d2822e;color:#f3d282}
.ev-os-mobile-hint{display:none}.ev-os button:focus-visible,.ev-os a:focus-visible{outline:3px solid #d2f49c;outline-offset:3px}
.theme-dark .ev-os{border-color:#33483b;box-shadow:0 18px 42px #0003}
@media(max-width:850px){.ev-os{grid-template-columns:minmax(190px,.76fr) minmax(275px,1.24fr);gap:4px;padding:19px 17px}.ev-os-node{min-width:112px;padding:6px 7px;grid-template-columns:24px auto;gap:6px}.ev-os-node>span:first-child{width:24px;height:24px}.ev-os-id{width:88px;height:88px;border-radius:25px}}
@media(max-width:680px){.ev-os{grid-template-columns:1fr;gap:0;padding:17px 15px 13px;min-height:0}.ev-os-copy{max-width:none}.ev-os-kicker{margin-bottom:10px}.ev-os h2{max-width:340px;font-size:24px}.ev-os-copy>p{margin:8px 0 11px;font-size:9px}.ev-os-proof{margin-top:10px}.ev-os-map{width:100%;max-width:440px;min-height:239px;margin:8px auto 0}.ev-os-node{min-width:110px}.ev-os-mobile-hint{display:block;position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);padding:3px 7px;border-radius:20px;background:#103c2e;color:#bcd1bc;font-size:6px;white-space:nowrap}}
@media(max-width:390px){.ev-os{padding:15px 12px 12px}.ev-os h2{font-size:22px}.ev-os-map{min-height:226px}.ev-os-node{min-width:98px;grid-template-columns:21px auto;gap:5px;padding:5px 6px}.ev-os-node>span:first-child{width:21px;height:21px}.ev-os-node b{font-size:7px}.ev-os-node small{font-size:5px}.ev-os-id{width:75px;height:75px;border-radius:21px}.ev-os-id>span{width:28px;height:28px}.ev-os-id b{font-size:8px}.ev-os-actions button{height:32px;padding:0 9px;font-size:7px}}
@media(prefers-reduced-motion:reduce){.ev-os-actions button,.ev-os-id,.ev-os-node{transition:none}.ev-os-actions button:hover,.ev-os-node:hover,.ev-os-node.create:hover,.ev-os-node.grow:hover{transform:none}}
`;

export function EcoVibesAfricaOSHome({ onNavigate, onAskAI }: { onNavigate?: (destination: EcoVibesDestination) => void; onAskAI?: () => void }) {
  const navigate = (destination: EcoVibesDestination) => onNavigate?.(destination);
  return <>
    <style>{styles}</style>
    <section className="ev-os" aria-labelledby="ev-os-title">
      <div className="ev-os-copy">
        <span className="ev-os-kicker"><i aria-hidden="true"/> ECOVIBES · AFRICA OS</span>
        <h2 id="ev-os-title">One ID.<br/><em>Room for your whole world.</em></h2>
        <p>Connect with your people, discover what’s next and make more happen—all across one low-data ecosystem.</p>
        <div className="ev-os-actions">
          <button className="ev-os-primary" onClick={() => navigate('EcoVibes ID')}>Explore your ID <ArrowRight size={14}/></button>
          <button className="ev-os-secondary" onClick={onAskAI}><Sparkles size={14}/> Ask Chale AI</button>
        </div>
        <div className="ev-os-proof"><Search size={12}/> One place to discover, connect and grow</div>
      </div>
      <div className="ev-os-map" aria-label="Explore the six EcoVibes ecosystem pillars">
        <svg className="ev-os-lines" viewBox="0 0 400 260" aria-hidden="true">
          <path d="M200 130 46 52M200 130 200 22M200 130 354 52M200 130 46 210M200 130 200 244M200 130 354 210"/>
          <circle cx="200" cy="130" r="3"/><circle cx="46" cy="52" r="2"/><circle cx="200" cy="22" r="2"/><circle cx="354" cy="52" r="2"/><circle cx="46" cy="210" r="2"/><circle cx="200" cy="244" r="2"/><circle cx="354" cy="210" r="2"/>
        </svg>
        <button className="ev-os-id" onClick={() => navigate('EcoVibes ID')} aria-label="Open your EcoVibes ID">
          <span><Fingerprint size={20}/></span><b>EcoVibes ID</b><small>ONE ACCOUNT</small>
        </button>
        {pillars.map(({ name, detail, icon: Icon, destination, position, tone }) => <button key={name} className={`ev-os-node ${position} ${tone}`} onClick={() => navigate(destination)}>
          <span><Icon size={14}/></span><span><b>{name}</b><small>{detail}</small></span>
        </button>)}
        <span className="ev-os-mobile-hint">Tap a pillar to explore</span>
      </div>
    </section>
  </>;
}

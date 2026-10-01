import { useId, type CSSProperties } from 'react';

type ArtProps = { color?: string; intensity?: number; animated?: boolean; className?: string };
type PatternProps = ArtProps & { motif?: 'weave' | 'mudcloth' | 'nde' | 'adinkra' };

const patterns: Record<NonNullable<PatternProps['motif']>, string> = {
  weave: 'M0 0h18v18H0z M0 0l18 18 M18 0L0 18 M9 0v18 M0 9h18',
  mudcloth: 'M0 0h24v24H0z M12 3l5 5-5 5-5-5z M3 17h6v4H3z M15 17h6v4h-6z',
  nde: 'M0 0h28v28H0z M4 4h20v20H4z M4 14h20 M14 4v20 M0 0l4 4 M28 0l-4 4 M0 28l4-4 M28 28l-4-4',
  adinkra: 'M0 0h32v32H0z M16 5v22 M5 16h22 M9 9l14 14 M23 9L9 23 M16 5l3 5-3 3-3-3z M16 27l3-5-3-3-3 3z',
};

export function PatternBackdrop({ motif = 'weave', color = '#b18a4b', intensity = 0.12, animated = true, className = '' }: PatternProps) {
  const id = useId().replaceAll(':', '');
  return <svg className={`pattern-backdrop ${animated ? 'is-animated' : ''} ${className}`} style={{ '--pattern-color': color, '--pattern-opacity': intensity } as CSSProperties} viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs><pattern id={`pattern-${id}`} width="32" height="32" patternUnits="userSpaceOnUse"><path d={patterns[motif]} fill="none" stroke="currentColor" strokeWidth="1"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></pattern><radialGradient id={`sun-${id}`} cx="76%" cy="34%" r="70%"><stop stopColor="#ddb36a" stopOpacity=".3"/><stop offset="1" stopColor="#ddb36a" stopOpacity="0"/></radialGradient></defs>
    <rect width="160" height="120" fill={`url(#sun-${id})`}/><rect width="160" height="120" fill={`url(#pattern-${id})`}/>
  </svg>;
}

export function GlowGrid({ color = '#8fbf76', intensity = 0.14, animated = true, className = '' }: ArtProps) {
  return <span className={`glow-grid ${animated ? 'is-animated' : ''} ${className}`} style={{ '--pattern-color': color, '--pattern-opacity': intensity } as CSSProperties} aria-hidden="true"/>;
}

export function ConnectionField({ color = '#d09a5b', intensity = 0.4, animated = true, className = '' }: ArtProps) {
  return <svg className={`connection-field ${animated ? 'is-animated' : ''} ${className}`} style={{ '--pattern-color': color, '--pattern-opacity': intensity } as CSSProperties} viewBox="0 0 320 250" aria-hidden="true" focusable="false">
    <path className="continent-line" d="M93 19 118 27 133 44 155 48 164 63 183 71 191 93 183 108 190 127 177 147 170 172 157 190 149 220 134 234 124 218 120 194 109 174 107 151 94 132 91 111 79 91 83 69 73 50 78 34z"/>
    <g className="connection-lines"><path d="m99 57 48 20 22 31-52 22-10 37 44 25M147 77l-30 53 62-22M117 130l54 55M99 57l18 73"/></g>
    <g className="connection-points"><circle cx="99" cy="57" r="3"/><circle cx="147" cy="77" r="3.5"/><circle cx="169" cy="108" r="3"/><circle cx="117" cy="130" r="4"/><circle cx="171" cy="185" r="3"/><circle cx="107" cy="167" r="3"/><circle cx="139" cy="188" r="2.5"/></g>
    <g className="connection-particles"><circle cx="99" cy="57" r="2.4"/><circle cx="147" cy="77" r="2"/><circle cx="117" cy="130" r="2.2"/></g>
    <g className="connection-stars"><circle cx="54" cy="52" r="1.4"/><circle cx="220" cy="70" r="1.6"/><circle cx="223" cy="153" r="1.2"/><circle cx="66" cy="185" r="1.4"/><circle cx="195" cy="35" r="1.1"/></g>
  </svg>;
}

export function BaobabDawn({ color = '#8d7650', intensity = 0.23 }: Pick<ArtProps, 'color' | 'intensity'>) {
  return <svg className="baobab-dawn" style={{ '--pattern-color': color, '--pattern-opacity': intensity } as CSSProperties} viewBox="0 0 240 150" aria-hidden="true" focusable="false">
    <circle className="baobab-sun" cx="182" cy="70" r="52"/>
    <path className="baobab-hill" d="M0 139c42-13 65-3 99-10 32-7 57 1 80-9 25-11 41-6 61-15v45H0z"/>
    <path className="baobab-tree" d="M104 139c3-20 2-34-1-48-20 4-29-1-42 7-6-4-6-12 0-17 9-3 15-1 24-6-8-5-17-6-28-5-9-4-8-14 1-18 15 0 27 5 38 13-5-12-9-21-20-30-2-9 6-14 14-9 13 12 20 24 25 39 5-19 13-31 27-43 9-4 17 3 13 12-12 12-18 25-21 39 11-12 24-18 40-19 10 3 10 14 1 19-15 1-24 7-33 17 14-4 27-3 40 4 6 7 2 16-7 16-14-7-27-7-41-2-1 19 1 32 5 46l-12 1c-2-17-3-29-3-39-5 12-7 25-6 41z"/>
    <path className="baobab-roots" d="M78 140c14-1 23 2 31 7 3-8 8-12 12-16 4 6 7 10 9 17 12-6 22-7 34-5"/>
  </svg>;
}

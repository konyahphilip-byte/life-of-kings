import type {VaultProject} from './game-vault.mjs';
export type GodotIssue={code:string;severity:'error'|'warning';file:string|null;line:number;message:string;repair:string;target?:string};
export type GodotEdge={from:string;target:string;kind:string;line:number;status:'present'|'unsupported'|'invalid'|'case-conflict'|'missing-source'|'missing-asset'};
export type GodotPreflight={schema:'ecogames-godot-preflight-v1';root:string|null;engineExecuted:false;coverage:string;status:'static-checked'|'limited'|'needs-repair';nodes:{path:string;kind:'project'|'scene'|'resource'|'script'|'other'}[];edges:GodotEdge[];issues:GodotIssue[]};
export type GodotExplanationSummary={schema:'godot-preflight-summary-v1';engineExecuted:false;files:number;references:number;issueCodes:string[]};
export function inspectGodotProject(project:VaultProject,options?:{signal?:AbortSignal;yieldControl?:()=>Promise<void>}):Promise<GodotPreflight>;
export function summarizeGodotPreflight(report:GodotPreflight):GodotExplanationSummary;

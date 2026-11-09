// Future service contract only. No endpoint, model request or editing executor is enabled.
import type {GodotExplanationSummary} from './game-godot-preflight.mjs';
export type AuthorizedProjectContext={
 /** Derived by server authentication/authorization, never trusted from a model or client. */
 actorId:string;projectId:string;permission:'project:read'|'project:edit';accountRevision:number;
};
export type ProjectToolBase={schema:'ecogames-project-tool-v1';projectId:string;expectedRevision:number;expectedSourceSha256:string};
export type ExplainProjectIssues=ProjectToolBase&{action:'explain_preflight';consent:'sanitized-summary-ai-v1';summary:GodotExplanationSummary};
export type PrepareProjectEdit=ProjectToolBase&{action:'prepare_edit';operationId:string;request:string;consent:'selected-source-ai-v1';selectedPaths:string[]};
export type ApprovedProjectEdit=ProjectToolBase&{action:'apply_approved_edit';operationId:string;proposalId:string;approvedProposalSha256:string;confirmation:'apply-this-exact-diff-v1'};
export type FutureProjectToolRequest=ExplainProjectIssues|PrepareProjectEdit|ApprovedProjectEdit;
export type ProjectEditProposal={schema:'ecogames-project-edit-proposal-v1';proposalId:string;projectId:string;baseRevision:number;baseSourceSha256:string;changes:{path:string;expectedFileSha256:string|null;replacement:string|null}[];proposalSha256:string;status:'prepared-not-applied'};
export interface FutureProjectToolService{
 /** Future implementation must enforce runtime schemas, owner scope, revision/hash binding,
  * selected-file consent, output/byte caps, preview, idempotency and audit metadata without source. */
 explain(context:AuthorizedProjectContext,request:ExplainProjectIssues):Promise<{status:'explained-not-edited';text:string}>;
 prepare(context:AuthorizedProjectContext,request:PrepareProjectEdit):Promise<ProjectEditProposal>;
 apply(context:AuthorizedProjectContext,request:ApprovedProjectEdit):Promise<{status:'server-confirmed';revision:number;sourceSha256:string}>;
}

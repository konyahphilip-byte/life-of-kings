/** Proposed extension of the existing Chale tool dispatcher; no registered tools yet.
 * Actor identity comes from the authenticated server context, never model args.
 * All tools recheck session + current shop membership. Private content requires
 * explicit per-action consent before entering the existing provider adapter.
 */
export type StorefrontToolRequest =
 | {name:'list_storefront_templates';args:{shopId:string}}
 | {name:'read_storefront_draft';args:{shopId:string}}
 | {name:'propose_storefront_draft';args:{shopId:string;expectedRevision:number;instruction:string;consentId:string}}
 | {name:'save_storefront_draft';args:{shopId:string;expectedRevision:number;validatedDraftId:string;idempotencyKey:string}}
 | {name:'request_storefront_publication';args:{shopId:string;draftId:string;expectedRevision:number;approvalReceiptId:string}}
 | {name:'restore_storefront_version';args:{shopId:string;versionId:string;expectedRevision:number}};
export type StorefrontToolResult = {status:'draft'|'approval_required'|'conflict'|'unavailable';shopId:string;revision:number;summary:string;previewId?:string};

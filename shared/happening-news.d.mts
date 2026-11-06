export type HeadlineItem={title:string;url:string;publisher:string;date:string;dateKind:'trend'|'published'};
export type HeadlineSection={id:string;source:string;label:string;sourceUrl:string;status:'available'|'empty'|'unavailable'|'disabled';checkedAt:string;expiresAt:string;updatedAt:string|null;items:HeadlineItem[]};
export function readHeadlines(value:unknown,now?:number):HeadlineSection[]|null;

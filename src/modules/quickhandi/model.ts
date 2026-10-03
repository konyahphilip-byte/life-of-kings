export const serviceCategories = [
 'Delivery & Errands','Cleaning','Laundry','Plumbing','Electrical','Repairs','Moving','Photography','Videography','Graphic Design','Video Editing','Beauty & Barber','Event Services','Food & Catering','Tutoring','Technology Services','Home Services','Business Services','Freelancing','Other'
] as const;
export type ServiceCategory = typeof serviceCategories[number] | 'Waste & Recycling';
export type VerificationLevel = 'unverified'|'basic'|'verified'|'ecovibes-verified';
export type PricingModel = 'fixed'|'from'|'quote';
export type JobStatus = 'requested'|'quoted'|'accepted'|'confirmed'|'in_progress'|'awaiting_customer'|'completed'|'cancelled'|'disputed';
export type JobMessage = {id:string;sender:'customer'|'handi'|'system';text:string;at:string};
export type HandiProfile = {
 id:string;ecoId:string;name:string;businessName?:string;providerType?:ProviderType;teamSize?:number;category:ServiceCategory;services:string[];area:string;serviceRadiusKm:number;bio:string;
 estimateMinor:number;pricing:PricingModel;availability:string;responseTime:string;rating?:number;reviewCount:number;completedJobs:number;verification:VerificationLevel;sample:boolean;
};
export type ServiceRequest = {
 id:string;providerId:string;providerName:string;category:ServiceCategory;title:string;details:string;area:string;timing:'asap'|'scheduled';scheduledAt?:string;
 pricing:PricingModel;estimateMinor:number;quoteMinor?:number;quoteNote?:string;status:JobStatus;createdAt:string;messages:JobMessage[];rating?:number;review?:string;
};
export type QuickHandiState={mode:'customer'|'handi';requests:ServiceRequest[];customJobs:CustomJob[];ownProfile?:HandiProfile;categories:ServiceCategory[]};

export type ProviderType='individual'|'business'|'company'|'team';
export type JobOfferStatus='pending'|'selected'|'declined';
export type CustomJobStatus='open'|'assigned'|'in_progress'|'awaiting_customer'|'completed'|'cancelled'|'disputed';
export type JobOffer={id:string;providerId:string;providerEcoId:string;providerName:string;providerType:ProviderType;amountMinor:number;note:string;eta:string;status:JobOfferStatus;createdAt:string;sample?:boolean};
export type CustomJobEvent={id:string;type:'JOB_POSTED'|'JOB_OFFERED'|'JOB_ASSIGNED'|'JOB_STARTED'|'JOB_FINISHED'|'JOB_COMPLETED'|'JOB_CANCELLED'|'JOB_DISPUTED';actorEcoId:string;at:string;details?:string};
export type CustomJob={id:string;ownerEcoId:string;ownerName:string;category:ServiceCategory;title:string;details:string;area:string;budgetMinor:number;timing:'asap'|'scheduled';scheduledAt?:string;status:CustomJobStatus;offers:JobOffer[];events?:CustomJobEvent[];createdAt:string;sample?:boolean};

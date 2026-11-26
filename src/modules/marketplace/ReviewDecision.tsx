import {useId,useState} from 'react';
export type ReviewSubmission={requestId:string;revision:number;contentHash:string;decision:'approved'|'rejected';reason:string;selfReviewConfirmed:boolean};
export function ReviewDecision({revision,contentHash,selfReview=false,authorized=false,eligible,disabled=false,onSubmit}:{
 revision:number;contentHash:string;selfReview?:boolean;authorized?:boolean;eligible:boolean;disabled?:boolean;onSubmit:(value:ReviewSubmission)=>void;
}){
 const id=useId(),[decision,setDecision]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const ready=authorized&&!disabled&&/^[a-f0-9]{64}$/.test(contentHash)&&['approved','rejected'].includes(decision)&&reason.trim().length>=5&&reason.length<=500&&(!selfReview||confirmed)&&(decision!=='approved'||eligible);
 return <fieldset className="m01-review-decision" disabled={disabled}>
  <legend>{selfReview?'Founder/admin review':'Marketplace moderation'}</legend>
  <p>{selfReview?'Founder self-review is not independent third-party verification.':'Record your decision for the exact saved version.'} Publication remains a separate seller action.</p>
  {!authorized&&<p role="status">Review is unavailable for this account and shop. Authorized scope and current staff access are required.</p>}
  {!eligible&&<p role="status">Additional category or safety controls are required. Approval is unavailable.</p>}
  <label htmlFor={id+'-decision'}>Decision</label><select id={id+'-decision'} value={decision} onChange={e=>setDecision(e.target.value)}><option value="">Choose a decision</option><option value="approved">Approve this exact version</option><option value="rejected">Reject this version</option></select>
  <label htmlFor={id+'-reason'}>Reason for this decision</label><textarea id={id+'-reason'} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} rows={3}/>
  {selfReview&&<label className="m01-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I am explicitly reviewing my own listing in my authorized founder/admin capacity. This is self-review.</label>}
  <button type="button" className="m01-primary" disabled={!ready} onClick={()=>{if(ready)onSubmit({requestId:crypto.randomUUID(),revision,contentHash,decision:decision as 'approved'|'rejected',reason:reason.trim(),selfReviewConfirmed:selfReview&&confirmed});}}>Record review decision</button>
 </fieldset>;
}

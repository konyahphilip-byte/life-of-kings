// Commerce input boundary only. Prices, ownership, stock and persistence stay server-authoritative.
function invalid(code,message){throw Object.assign(new Error(message),{status:400,code});}
const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);

export function normalizeOrderItems(body){
 if(!record(body)||!Array.isArray(body.items)||body.items.length<1||body.items.length>30)
  invalid('invalid_items','Add between one and 30 items.');
 const grouped=new Map();
 for(const item of body.items){
  if(!record(item)||typeof item.productId!=='string'||!item.productId.trim()||item.productId.length>180)
   invalid('invalid_items','Product ID is required.');
  if(!Number.isSafeInteger(item.quantity)||item.quantity<1)invalid('invalid_amount','Quantity is invalid.');
  let variantId=null;
  if(item.variantId!==undefined&&item.variantId!==null&&item.variantId!==''){
   if(typeof item.variantId!=='string'||!item.variantId.trim()||item.variantId.trim().length>180)
    invalid('invalid_input','Variant ID is invalid.');
   variantId=item.variantId.trim();
  }
  const lines=grouped.get(item.productId)||[];
  const existing=lines.find(line=>line.variantId===variantId);
  if(existing)existing.qty+=item.quantity;
  else lines.push({variantId,qty:item.quantity});
  const total=lines.reduce((sum,line)=>sum+line.qty,0);
  if(!Number.isSafeInteger(total))invalid('invalid_quantity','Requested quantity is too large.');
  grouped.set(item.productId,lines);
 }
 // Acquire each product row lock in the same order across requests. Do not sort the caller's input.
 return new Map([...grouped.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0));
}

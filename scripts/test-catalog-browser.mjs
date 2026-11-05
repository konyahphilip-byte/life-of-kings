import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';
const output='artifacts/navigation';await mkdir(output,{recursive:true});
const handler=await createWebHandler(new URL('../dist',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{if(!await handler(req,res)){res.writeHead(503);res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port,ownerId='11111111-1111-4111-8111-111111111111',P='33333333-3333-4333-8333-333333333333',Q='44444444-4444-4444-8444-444444444444';
const listing=(id,name,priceMinor)=>({id,name,description:'Seller-entered catalog description',category:'Native goods',currency:'GHS',priceMinor,stock:5,variants:[],sellerEcoId:'synthetic.seller',sellerName:'Synthetic Seller',sellerIsCurrentUser:false,source_type:'direct',fulfillment_type:'own_inventory',image_url:null,location:'Accra'});
const one=listing(P,'Native catalog item',1200),two=listing(Q,'Next page item',1800),checks=[];let browser,failure;
try{
 browser=await chromium.launch();
 for(const width of[1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});await context.routeWebSocket('**/*',s=>s.close());
  const sellerId='55555555-5555-4555-8555-555555555555';
  let reviewingImport=false,reviewedImport=null;const imported={...listing("77777777-7777-4777-8777-777777777777","Synthetic Shopify tee",22000),seller_id:sellerId,status:"paused",reviewHash:"a".repeat(64),source_type:"shopify",variants:[{id:"gid://shopify/ProductVariant/1",title:"M",priceMinor:22000,stock:4}]};
  let sellerMode=false,published=null,outage=false,writes=0,lookups=0,cart={ownerId,revision:0,items:[],totalMinor:0,quoteId:null,currency:'GHS',canCheckout:false,lastOrderId:null};
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
   const reply=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/api/v1/auth/me')return reply({user:{id:sellerMode?sellerId:ownerId,eco_id:sellerMode?'synthetic.seller':'synthetic.buyer',display_name:'Synthetic Account',roles:sellerMode?['seller']:['customer']},csrfToken:'synthetic-csrf'});
   if(url.pathname==='/api/v1/marketplace/catalog'){
    if(outage)return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"message":"Synthetic catalog outage"}}'});
    let items=[one],nextCursor='fixture-next';if(url.searchParams.get('cursor')){items=[two];nextCursor=null;}if(url.searchParams.get('productId')){assert.equal(url.searchParams.get('productId'),Q);items=[two];nextCursor=null;lookups++;}
    if(published){items=[{...published,sellerIsCurrentUser:sellerMode}];nextCursor=null;if(url.searchParams.has('categoryId'))assert.equal(url.searchParams.get('categoryId'),'electronics.phones');}
    return reply({items,nextCursor,checkedAt:'2026-11-05T10:00:00.000Z',currency:'GHS'});
   }
   if(url.pathname==='/api/v1/marketplace/products/'+imported.id+'/publish'){reviewedImport=request.postDataJSON();assert.equal(reviewedImport.ownerId,sellerId);return reply({ownerId:sellerId,productId:imported.id,publicationId:reviewedImport.clientId,publishedAt:'2026-11-05T18:00:00Z',currentStatus:'active'});}
   if(url.pathname==='/api/v1/marketplace/products'){if(reviewingImport&&request.method()==='GET')return reply([imported]);
    if(request.method()==='POST'){const body=request.postDataJSON();assert(sellerMode);assert.equal(body.categoryId,'electronics.phones');assert.equal(body.categoryVersion,1);assert.deepEqual(body.attributes,{condition:'used',storageGb:128});published={...listing('66666666-6666-4666-8666-666666666666',body.name,body.priceMinor),...body,category:'Phones',seller_id:sellerId};return reply(published);}
    return reply(url.searchParams.has('mine')?(published?[published]:[]):[one]);
   }
   if(url.pathname==='/api/v1/connectors/shopify')return reply([]);
   if(url.pathname==='/api/v1/marketplace/cart'){
    if(request.method()==='PUT'){writes++;const body=request.postDataJSON();assert.equal(body.ownerId,ownerId);assert.equal(body.items[0].productId,Q);cart={...cart,revision:cart.revision+1,items:body.items.map(i=>({...i,name:two.name,variantTitle:null,unitPriceMinor:1800,available:true,reason:null})),totalMinor:1800,quoteId:'b'.repeat(64),canCheckout:true};}return reply(cart);
   }
   assert(!/marketplace\/orders|payments|checkout/.test(url.pathname),'Discovery must not submit an order or payment');
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"message":"Synthetic unavailable service"}}'});
   return route.continue();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/#marketplace');await page.getByRole('heading',{name:'Shop current seller listings'}).waitFor();await page.getByRole('heading',{name:one.name,exact:true}).waitFor();
  assert.equal(await page.locator('.market-design-examples .product-card').first().isVisible(),false);checks.push({width,check:'Real catalog is the default, with device examples closed and native selling available'});
  await page.getByRole('button',{name:'Load more listings'}).click();await page.getByRole('heading',{name:two.name,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:one.name,exact:true}).count(),1);
  await page.locator('.native-product').filter({has:page.getByRole('heading',{name:two.name,exact:true})}).getByRole('button',{name:'Review in account bag'}).click();
  await page.getByRole('heading',{name:'Your account bag'}).waitFor();await page.getByLabel('Current listing').waitFor();assert.equal(await page.getByLabel('Current listing').inputValue(),Q);assert.equal(lookups,1);
  await page.getByRole('button',{name:'Save item to account bag'}).click();await page.getByText('Account bag saved.',{exact:true}).waitFor();assert.equal(writes,1);assert.equal(cart.items[0].productId,Q);await page.getByRole('button',{name:'Close bag',exact:true}).click();
  checks.push({width,check:'Second-page canonical item opens in the account bag and is saved only after server acknowledgment; no checkout/payment request'});
  // A tall element screenshot repositions a sticky header inside its stitched image.
  // Keep that diagnostic, then capture real viewports without hiding app controls.
  await page.locator('.native-catalog').screenshot({path:output+'/native-catalog-'+width+'.png'});
  for(const [target,name] of [['.native-catalog-head','top'],['.native-product','product']]){
   const box=page.locator(target).first();
   await box.evaluate(el=>{const header=document.querySelector('.topbar');window.scrollTo({top:scrollY+el.getBoundingClientRect().top-(header?.getBoundingClientRect().height||0)-16,behavior:'instant'});});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const heading=box.getByRole('heading').first();
   assert(await heading.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&(el.contains(hit)||hit.contains(el));}),'Visible catalog heading must not be covered by app controls');
   await page.screenshot({path:output+'/native-catalog-'+name+'-'+width+'.png'});
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.market-design-examples summary').click();assert(await page.locator('.market-design-examples .product-card').first().isVisible());await page.locator('.market-design-examples summary').click();
  checks.push({width,check:'Explicit examples remain accessible and catalog controls fit without horizontal overflow'});
  outage=true;await page.getByRole('button',{name:'Refresh listings',exact:true}).click();await page.getByText(/Synthetic catalog outage/).waitFor();assert.equal(await page.locator('.native-product').count(),0);assert.equal(await page.locator('.market-design-examples .product-card').first().isVisible(),false);
  assert.deepEqual(errors,[]);checks.push({width,check:'Catalog failure is reported honestly without substituting sample inventory or causing page errors'});
  outage=false;sellerMode=true;await page.reload();await page.getByRole('button',{name:'Start selling',exact:true}).click();await page.getByRole('button',{name:'Add product',exact:true}).click();
  await page.getByLabel('Product name',{exact:true}).fill('Classified phone');await page.getByLabel('Selling price · GHS',{exact:true}).fill('125');await page.getByLabel('Stock quantity',{exact:true}).fill('2');
  await page.getByLabel('Category',{exact:true}).selectOption('electronics.phones');await page.getByLabel('Condition',{exact:true}).selectOption('used');await page.getByLabel('Storage · GB (optional)',{exact:true}).fill('128');
  await page.getByRole('button',{name:'Save listing',exact:true}).click();await page.getByText('Product published to the EcoVibes catalog.',{exact:true}).waitFor();assert(published);checks.push({width,check:'Seller form submits category-specific declarations and waits for product acknowledgment'});
  sellerMode=false;await page.reload();await page.getByRole('heading',{name:'Classified phone',exact:true}).waitFor();await page.getByText('Category, price and seller filters',{exact:true}).click();await page.getByLabel('Category',{exact:true}).selectOption('electronics.phones');await page.getByRole('button',{name:'Search current catalog',exact:true}).click();
  await page.getByText('Seller-entered details',{exact:true}).waitFor();assert.equal(await page.getByText('128',{exact:true}).count(),1);assert.equal(await page.getByText('used',{exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Review in account bag',exact:true}).count(),1);
  await page.locator('.native-product').first().evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-84,behavior:'instant'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:output+'/category-buyer-'+width+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);checks.push({width,check:'Switched buyer filters saved category details without a verification or payment claim'});

  sellerMode=true;reviewingImport=true;await page.reload();await page.getByRole('tab',{name:/My listings/}).click();await page.getByRole('button',{name:'Review and publish Synthetic Shopify tee',exact:true}).click();
  const review=page.getByRole('region',{name:'Review Shopify product'});await review.getByLabel('Category',{exact:true}).selectOption('fashion.clothing');await review.getByLabel('Condition',{exact:true}).selectOption('new');
  assert.equal(await review.getByLabel('EcoVibes quantity M').inputValue(),'0');await review.getByLabel('EcoVibes quantity M').fill('2');await review.getByLabel('Pickup or dispatch area').fill('Accra');await review.getByLabel('Pickup/delivery terms and costs').fill('Free pickup; delivery agreed separately');await review.getByLabel(/I have confirmed supply/).check();
  await review.getByRole('heading').evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-100,behavior:'instant'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:output+'/shopify-review-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push({width,check:'Imported draft review fits viewport with zero initial allocation and separate supply/photo choices'});
  await review.getByRole('button',{name:'Publish reviewed listing',exact:true}).click();await page.getByText('Listing published to EcoVibes. No payment has been taken.',{exact:true}).waitFor();assert.equal(reviewedImport.variantStock[0].stock,2);assert.equal(reviewedImport.copyPhoto,false);assert.equal(reviewedImport.mediaConsent,false);assert.equal(Object.keys(reviewedImport).length,13);assert.deepEqual(errors,[]);checks.push({width,check:'Reviewed publication submits captured owner, immutable key and explicit allocation; acknowledgment alone closes review'});
  await context.close();
 }
}catch(e){failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));const report={passed:!failure,checks,failure,scope:'Actual built Chromium UI with synthetic signed-in seller/catalog/cart HTTP fixtures; no real Auth, hosted, device, image-storage, connector or payment acceptance'};await writeFile(output+'/native-catalog-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

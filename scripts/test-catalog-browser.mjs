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
  let outage=false,writes=0,lookups=0,cart={ownerId,revision:0,items:[],totalMinor:0,quoteId:null,currency:'GHS',canCheckout:false,lastOrderId:null};
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
   const reply=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/api/v1/auth/me')return reply({user:{id:ownerId,eco_id:'synthetic.buyer',display_name:'Synthetic Buyer',roles:['customer']},csrfToken:'synthetic-csrf'});
   if(url.pathname==='/api/v1/marketplace/catalog'){
    if(outage)return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"message":"Synthetic catalog outage"}}'});
    let items=[one],nextCursor='fixture-next';if(url.searchParams.get('cursor')){items=[two];nextCursor=null;}if(url.searchParams.get('productId')){assert.equal(url.searchParams.get('productId'),Q);items=[two];nextCursor=null;lookups++;}
    return reply({items,nextCursor,checkedAt:'2026-11-05T10:00:00.000Z',currency:'GHS'});
   }
   if(url.pathname==='/api/v1/marketplace/products')return reply([one]);
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
  await page.locator('.native-catalog').screenshot({path:output+'/native-catalog-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.market-design-examples summary').click();assert(await page.locator('.market-design-examples .product-card').first().isVisible());await page.locator('.market-design-examples summary').click();
  checks.push({width,check:'Explicit examples remain accessible and catalog controls fit without horizontal overflow'});
  outage=true;await page.getByRole('button',{name:'Refresh listings',exact:true}).click();await page.getByText(/Synthetic catalog outage/).waitFor();assert.equal(await page.locator('.native-product').count(),0);assert.equal(await page.locator('.market-design-examples .product-card').first().isVisible(),false);
  assert.deepEqual(errors,[]);checks.push({width,check:'Catalog failure is reported honestly without substituting sample inventory or causing page errors'});
  await context.close();
 }
}catch(e){failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));const report={passed:!failure,checks,failure,scope:'Actual built Chromium UI with synthetic signed-in seller/catalog/cart HTTP fixtures; no real Auth, hosted, device, image-storage, connector or payment acceptance'};await writeFile(output+'/native-catalog-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

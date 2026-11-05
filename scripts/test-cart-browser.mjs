import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createWebHandler} from '../server/web.mjs';
const output='artifacts/navigation';await mkdir(output,{recursive:true});
const handler=await createWebHandler(new URL('../dist',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{if(!await handler(req,res)){res.writeHead(503);res.end('{}');}}catch{res.writeHead(500);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port,ownerId='11111111-1111-4111-8111-111111111111',productId='33333333-3333-4333-8333-333333333333',orderId='44444444-4444-4444-8444-444444444444';
const checks=[];let browser,failure;
try{
 browser=await chromium.launch();
 for(const width of[1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.routeWebSocket('**/*',s=>s.close());
  let cart={ownerId,revision:0,items:[],totalMinor:0,currency:'GHS',quoteId:null,canCheckout:false,lastOrderId:null},savedCommand=null,orders=0;
  const requests=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin)return route.abort();
   const reply=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/api/v1/auth/me')return reply({user:{id:ownerId,eco_id:'synthetic.cart',display_name:'Synthetic Cart',roles:['customer']},csrfToken:'synthetic-csrf'});
   if(url.pathname==='/api/v1/marketplace/products')return reply([{id:productId,name:'Canonical browser item',priceMinor:1200,stock:10,fulfillment_type:'own_inventory',variants:[],sellerIsCurrentUser:false}]);
   if(url.pathname==='/api/v1/marketplace/cart'){
    if(request.method()==='PUT'){
     const body=request.postDataJSON();assert.equal(body.ownerId,ownerId);assert.equal(body.revision,cart.revision);
     cart={...cart,revision:cart.revision+1,items:body.items.map(i=>({...i,name:'Canonical browser item',variantTitle:null,unitPriceMinor:1200,available:true,reason:null})),totalMinor:body.items.reduce((s,i)=>s+i.quantity*1200,0),quoteId:body.items.length?'a'.repeat(64):null,canCheckout:body.items.length>0};
    }return reply(cart);
   }
   if(url.pathname==='/api/v1/marketplace/cart/checkout'){
    const body=request.postDataJSON();requests.push(body);
    if(!savedCommand){savedCommand=body;orders++;cart={...cart,revision:cart.revision+1,items:[],totalMinor:0,canCheckout:false,lastOrderId:orderId};return route.abort('failed');}
    assert.deepEqual(body,savedCommand);
    return reply({ownerId,cart,replayed:true,order:{id:orderId,buyer_id:ownerId,total_minor:2400,status:'pending',payment_status:'unpaid'}});
   }
   assert(!/marketplace\/orders|payments/.test(url.pathname),'Browser must use the new cart command, not a payment/legacy-order route');
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"synthetic_outage","message":"Synthetic service unavailable"}}'});
   return route.continue();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#home');
  await page.getByRole('button',{name:/^Bag/}).click();await page.getByRole('heading',{name:'Your account bag'}).waitFor();
  await page.getByRole('button',{name:'Choose current listings'}).click();await page.getByLabel('Current listing').selectOption(productId);
  await page.getByLabel('Quantity',{exact:true}).fill('2');await page.getByRole('button',{name:'Save item to account bag'}).click();
  await page.getByText('Account bag saved.',{exact:true}).waitFor();await page.getByText('Reviewed items total: GH₵24.00',{exact:true}).waitFor();
  assert.equal(cart.items[0].quantity,2);checks.push({width,check:'Actual built app saves only canonical catalog IDs and renders server-confirmed quantities/total'});
  await page.getByRole('button',{name:'Place unpaid order',exact:true}).scrollIntoViewIfNeeded();
  await page.locator('.cart-drawer').screenshot({path:output+'/account-cart-ready-'+width+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'Place unpaid order',exact:true}).click();await page.getByRole('button',{name:'Retry same order request',exact:true}).waitFor();
  assert.equal(await page.getByText(/Saved order /).count(),0);assert.equal(orders,1);
  await page.getByRole('button',{name:'Refresh account bag',exact:true}).click();await page.getByText('No items in your account bag yet.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Retry same order request',exact:true}).click();await page.getByText(/Saved order /).waitFor();
  assert.equal(orders,1);assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(await page.getByText(/payment unpaid/).count(),1);
  checks.push({width,check:'Lost-response fixture never announces success early; empty-cart refresh retains the identical retry and resolves one unpaid order'});
  await page.locator('.cart-drawer').screenshot({path:output+'/account-cart-recovered-'+width+'.png'});
  await page.getByRole('button',{name:'Close bag',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Your account bag'}).count(),0);
  assert.deepEqual(errors,[]);checks.push({width,check:'Narrow/desktop controls scroll, close and render without page errors or horizontal overflow'});
  await context.close();
 }
}catch(e){failure={name:e.name,message:e.message};process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));const report={passed:!failure,checks,failure,scope:'Built Linux Chromium app with synthetic signed-in account/catalog/HTTP outcomes; no real Auth, database, hosted, phone or provider acceptance'};await writeFile(output+'/cart-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

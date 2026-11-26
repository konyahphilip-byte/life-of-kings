import sharp from 'sharp';
sharp.cache({memory:8,files:0,items:8});
sharp.concurrency(1);
export async function normalizeNativePhoto(input) {
 const fail=()=>{throw Object.assign(Error('Choose a valid JPG, PNG or WebP photo under 6 MB and 12 megapixels.'),{status:400,code:'invalid_photo'});};
 if(!['image/jpeg','image/png','image/webp'].includes(input.mimeType)||typeof input.data!=='string'||
  input.data.length>8_388_608||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))fail();
 const bytes=Buffer.from(input.data,'base64');if(!bytes.length||bytes.length>6_291_456)fail();
 try{
  const image=sharp(bytes,{limitInputPixels:12_000_000,failOn:'warning',animated:false});
  const metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||metadata.pages>1||
   metadata.format!==({'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'}[input.mimeType]))fail();
  // Sharp removes metadata by default; never call keepMetadata/withMetadata.
  const {data,info}=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).timeout({seconds:5}).toBuffer({resolveWithObject:true});
  return {bytes:data,mimeType:'image/webp',width:info.width,height:info.height};
 }catch{fail();}
}

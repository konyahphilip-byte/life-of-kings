// @vitest-environment node
import { expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { normalizeNativePhoto } from './native-photo.mjs';
it('decodes and strips orientation/EXIF metadata from an authorized photo',async()=>{
 const source=await sharp({create:{width:20,height:12,channels:3,background:'#0d533d'}}).jpeg().withMetadata({orientation:6}).toBuffer();
 const out=await normalizeNativePhoto({mimeType:'image/jpeg',data:source.toString('base64')});
 const meta=await sharp(out.bytes).metadata();
 expect(meta.exif).toBeUndefined();expect(meta.orientation).toBeUndefined();
 expect(out.mimeType).toBe('image/webp');expect(out.width).toBe(12);expect(out.height).toBe(20);
});
it('accepts a realistic large photo without a validation stack overflow',async()=>{
 const source=await sharp(randomBytes(600*600*3),{raw:{width:600,height:600,channels:3}}).png().toBuffer();
 expect(source.length).toBeGreaterThan(1_000_000);
 const out=await normalizeNativePhoto({mimeType:'image/png',data:source.toString('base64')});
 expect(out.width).toBe(600);expect(out.bytes.length).toBeGreaterThan(0);
});
it.each([
 {mimeType:'image/svg+xml',data:Buffer.from('<svg onload="x"/>').toString('base64')},
 {mimeType:'image/png',data:'////invalid===='},
 {mimeType:'image/jpeg',data:Buffer.from('not a real jpeg').toString('base64')},
])('rejects unsupported, malformed or forged image content',async input=>{
 await expect(normalizeNativePhoto(input)).rejects.toMatchObject({status:400,code:'invalid_photo'});
});

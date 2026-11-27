import {MANIFEST,createRegistry,legacyAdvice,type ClassificationInput} from './registry.mjs';
const registry=createRegistry(MANIFEST),category=registry.byKey('smartphones');
if(category){
 const input:ClassificationInput={registryVersion:registry.version,categoryId:category.id,listingType:'physical',listingIntent:'sell',attributes:{condition:'used'}};
 const result=registry.normalize(input);
 result.issues.forEach(issue=>String(issue.message));
 // @ts-expect-error Classifications are immutable data.
 result.categoryId='changed';
 // @ts-expect-error Registry metadata does not grant publication.
 registry.eligibility(category.id).publicationAllowed;
}
registry.search('PS4',{locale:'en-GH',limit:12});
legacyAdvice({category:'fashion'},registry);
// @ts-expect-error No model/provider or automatic publication API exists.
registry.publish();
// @ts-expect-error Unreviewed translations are not an available locale.
registry.search('phone',{locale:'unverified'});

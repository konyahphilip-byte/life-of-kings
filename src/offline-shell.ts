/** Retire only the known pre-checkout-safety public shell, never account storage.
 * The old worker can otherwise restore its install-time HTML after an online upgrade.
 * Await this before rendering. A failed retirement must remain an honest startup failure.
 */
export async function retireUnsafeShell(storage:Pick<CacheStorage,'delete'>|undefined):Promise<void>{
 if(storage)await storage.delete('ecovibes-shell-v2');
}

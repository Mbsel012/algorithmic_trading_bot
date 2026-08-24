/**
 * Local id generator.
 *
 * Ids never leave the device, so a timestamp plus randomness is plenty — and
 * the timestamp prefix keeps ids roughly sortable by creation time.
 */

let counter = 0;

export function createId(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}

/**
 * Shield geography check. The Caribbean rejections are the whole point:
 * +1 is not "US and Canada", and Caribbean NANP is the classic SMS-pumping
 * destination precisely because it passes naive validators.
 *
 *   npx tsx scripts/verify-shield-check.ts
 */
import { isUsOrCanadaNpa, npaOf, NPA_COUNTS } from '../src/lib/api/nanp';

let pass = 0;
let fail = 0;
const ck = (name: string, ok: boolean, detail = '') => {
  if (ok) { console.log(`  ✓ ${name}${detail ? ` - ${detail}` : ''}`); pass += 1; }
  else { console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`); fail += 1; }
};

console.log(`NPA table: ${NPA_COUNTS.us} US + ${NPA_COUNTS.ca} CA\n`);

console.log('== must ALLOW (US) ==');
for (const [n, label] of [['+14155550132','San Francisco'],['+12125550100','New York'],['+18132142204','Tampa'],['+17875550100','Puerto Rico'],['+13405550100','US Virgin Islands']] as const) {
  ck(`${n} ${label}`, isUsOrCanadaNpa(n));
}

console.log('\n== must ALLOW (Canada) ==');
for (const [n, label] of [['+14165550100','Toronto'],['+16045550100','Vancouver'],['+15145550100','Montreal'],['+19025550100','Halifax']] as const) {
  ck(`${n} ${label}`, isUsOrCanadaNpa(n));
}

console.log('\n== must BLOCK (Caribbean NANP - pumping targets) ==');
for (const [n, label] of [['+18765550100','Jamaica'],['+18095550100','Dominican Republic'],['+18295550100','Dominican Republic'],['+12425550100','Bahamas'],['+18685550100','Trinidad'],['+12465550100','Barbados'],['+14415550100','Bermuda'],['+16645550100','Montserrat'],['+17585550100','St Lucia']] as const) {
  ck(`${n} ${label}`, !isUsOrCanadaNpa(n));
}

console.log('\n== malformed ==');
ck('non-NANP returns null npa', npaOf('+447700900123') === null || !isUsOrCanadaNpa('+447700900123'));
ck('garbage blocked', !isUsOrCanadaNpa('nope'));

console.log(`\nPASS ${pass}  FAIL ${fail}`);
process.exit(fail ? 1 : 0);

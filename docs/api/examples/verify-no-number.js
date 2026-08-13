require('dotenv').config({ path: '/home/alek/ghost-checkout/.claude/worktrees/ghost-api-landing-page-739936/.env.local' });
const admin=require('/home/alek/ghost-checkout/node_modules/firebase-admin');
admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n')}),databaseURL:process.env.FIREBASE_DATABASE_URL});
const db=admin.database();
const BASE='http://localhost:3457';
const ADMIN=require('fs').readFileSync('/home/alek/ghost-checkout/.claude/worktrees/ghost-api-landing-page-739936/.env.local','utf8').split('\n').find(l=>l.startsWith('CRON_SECRET=')).split('=').slice(1).join('=').replace(/"/g,'');
let pass=0,fail=0;
const ck=(n,a,b)=>{ if(String(a)===String(b)){console.log(`  ✓ ${n}`);pass++;} else {console.log(`  ✗ ${n} (got ${a} want ${b})`);fail++;} };
(async()=>{
  const email=`nonum-${Date.now()}@ghostforge-e2e.test`;
  const TN=(await fetch(`${BASE}/api/admin/api-tenants`,{method:'POST',headers:{'x-api-secret':ADMIN,'Content-Type':'application/json'},body:JSON.stringify({email})}).then(r=>r.json())).tenant.id;
  const KEY=(await fetch(`${BASE}/api/admin/api-tenants/${TN}/keys`,{method:'POST',headers:{'x-api-secret':ADMIN,'Content-Type':'application/json'},body:JSON.stringify({mode:'test'})}).then(r=>r.json())).key;

  // strip EVERY number from this tenant - the exact situation a brand-new dev is in
  await db.ref(`apiTenants/${TN}/numbers`).remove();
  const numbers = await fetch(`${BASE}/api/v1/numbers`,{headers:{Authorization:`Bearer ${KEY}`}}).then(r=>r.json());
  ck('tenant owns zero numbers', numbers.data.length, 0);

  console.log('== verify with NO numbers at all ==');
  const s = await fetch(`${BASE}/api/v1/verify`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({phone:'+15005556060'})});
  const sj = await s.json();
  ck('send succeeds (201)', s.status, 201);
  ck('returns a verification', String(sj.id||'').slice(0,4), 'ver_');
  const c = await fetch(`${BASE}/api/v1/verify/check`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({phone:'+15005556060',code:'111111'})}).then(r=>r.json());
  ck('check verifies', c.verified, true);

  console.log('== branded override still validated ==');
  const bad = await fetch(`${BASE}/api/v1/verify`,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({phone:'+15005556161',from:'garbage'})});
  ck('invalid from -> 400', bad.status, 400);

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail?1:0);
})();

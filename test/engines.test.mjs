// AIDNode engine regression tests (v2.5). Offline: every network call uses an injected fetchFn.
// Ported from PR #2 (improvements/v2-2-safety-and-evidence) and adapted to the deployed 2.3.0 lineage.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {ENGINE_VERSION,aidRepair,aidVerify,aidWitness,aidValidateReceipt,aidMonitor,aidRecovery,executeEnhancedTool,enhancedToolSpecs,sha256,executeTool,WITNESS_KEY_ID,LEGACY_WITNESS_KEY_ID,LEGACY_RECEIPT_ACCEPT_UNTIL} from '../src/worker.js';

const url='https://developers.cloudflare.com/workers/';
const respond=(status,body,headers={})=>async()=>new Response(body,{status,headers});
const KEY='unit-test-signing-key-not-a-secret';

test('engine version is 2.5.0',()=>{assert.equal(ENGINE_VERSION,'2.5.0')});
test('all five tools are published',()=>{assert.deepEqual(enhancedToolSpecs.map(t=>t.name),['repair','verify','witness','monitor','recovery'])});

// Repair
test('Repair rejects unrecognized transport error (schema layer)',async()=>{await assert.rejects(()=>executeEnhancedTool('repair',{network_error:'NETWORK_MYSTERY'}),/not an allowed value/)});
test('Repair honors explicit throttling',async()=>{const r=await aidRepair({status:429,method:'GET',retry_after_seconds:4});assert.equal(r.automatic_retry_permitted,true);assert.ok(r.retry_policy.minimum_delay_ms>=4000)});
test('Repair blocks blind replay of uncertain POST',async()=>{const r=await aidRepair({status:502,method:'POST'});assert.equal(r.automatic_retry_permitted,false);assert.equal(r.requires_outcome_check,true);assert.deepEqual(r.actions_performed,[])});

// Verify
test('Verify: matching digest on a 404 page is NOT a successful check',async()=>{const r=await aidVerify({mode:'public_http',url,expected_sha256:await sha256('not found')},{fetchFn:respond(404,'not found')});assert.equal(r.digest_matches,true);assert.equal(r.http_success,false);assert.equal(r.independent_check_succeeded,false);assert.equal(r.verdict,'not_verified_http_status')});
test('Verify: matching digest on a 500 page is NOT a successful check',async()=>{const r=await aidVerify({mode:'public_http',url,expected_sha256:await sha256('oops')},{fetchFn:respond(500,'oops')});assert.equal(r.independent_check_succeeded,false)});
test('Verify: redirect is not success',async()=>{const r=await aidVerify({mode:'public_http',url},{fetchFn:respond(301,'',{location:'https://example.com/'})});assert.equal(r.independent_check_succeeded,false)});
test('Verify accepts healthy content match',async()=>{const r=await aidVerify({mode:'public_http',url,expected_sha256:await sha256('good')},{fetchFn:respond(200,'good')});assert.equal(r.independent_check_succeeded,true);assert.equal(r.verdict,'match')});
test('Verify reports mismatch on 200',async()=>{const r=await aidVerify({mode:'public_http',url,expected_sha256:await sha256('good')},{fetchFn:respond(200,'changed')});assert.equal(r.independent_check_succeeded,false);assert.equal(r.verdict,'mismatch')});
test('Verify: unreachable source is not verified',async()=>{const r=await aidVerify({mode:'public_http',url},{fetchFn:async()=>{throw new TypeError('boom')}});assert.equal(r.independent_check_succeeded,false);assert.equal(r.verdict,'not_verified_unreachable')});
test('Verify refuses non-allowlisted host (SSRF guard)',async()=>{await assert.rejects(()=>aidVerify({mode:'public_http',url:'https://example.com/'},{fetchFn:respond(200,'x')}),/unapproved_public_https_destination/)});
test('Verify compare_text labels evidence as caller-supplied',async()=>{const r=await aidVerify({mode:'compare_text',previous:'a',current:'b'});assert.equal(r.changed,true);assert.equal(r.evidence_basis,'caller_supplied_text')});

// Witness
test('Witness refuses no-op receipt',async()=>{await assert.rejects(()=>aidWitness({document:{a:1},required_fields:[]},{signingKey:KEY}),/at least one validation assertion/)});
test('Witness allows a digest-only assertion',async()=>{const doc={a:1};const r=await aidWitness({document:doc,required_fields:[],expected_sha256:await sha256(JSON.stringify(doc))},{signingKey:KEY,now:()=>Date.parse('2026-11-18T12:00:00Z')});assert.equal(r.checks.assertion_count,1);assert.ok(r.signature)});
test('Witness declines external evidence on 404',async()=>{const r=await aidWitness({document:{a:1},required_fields:['a'],external_evidence:{url,expected_sha256:await sha256('oops')}},{fetchFn:respond(404,'oops')});assert.equal(r.passed,false);assert.equal(r.external_evidence.http_success,false)});
test('Witness signed receipt verifies; tampered receipt fails',async()=>{const r=await aidWitness({document:{run:{status:'complete'}},required_fields:['run.status']},{signingKey:KEY,now:()=>Date.parse('2026-11-18T12:00:00Z')});assert.equal(r.passed,true);assert.equal(r.external_task_completion_verified,false);assert.equal((await aidValidateReceipt(r,{legacyKey:KEY,now:()=>Date.parse('2026-11-18T12:00:00Z')})).valid,true);assert.equal((await aidValidateReceipt({...r,passed:false},{legacyKey:KEY,now:()=>Date.parse('2026-11-18T12:00:00Z')})).valid,false)});

// Monitor
test('Monitor supports latency budget (pass)',async()=>{const r=await aidMonitor({url,max_duration_ms:1000},{fetchFn:respond(200,'ok')});assert.equal(r.healthy,true);assert.equal(r.checks.within_latency_budget,true)});
test('Monitor latency budget exceeded => unhealthy',async()=>{const slow=async()=>{await new Promise(r=>setTimeout(r,30));return new Response('ok',{status:200})};const r=await aidMonitor({url,max_duration_ms:5},{fetchFn:slow});assert.equal(r.checks.within_latency_budget,false);assert.equal(r.healthy,false)});
test('Monitor rejects invalid latency threshold',async()=>{await assert.rejects(()=>aidMonitor({url,max_duration_ms:0}),/max_duration_ms/)});
test('Monitor schema exposes max_duration_ms',async()=>{await assert.rejects(()=>executeEnhancedTool('monitor',{url,max_duration_ms:999999}),/outside allowed range/)});
test('Monitor without budget is unchanged',async()=>{const r=await aidMonitor({url},{fetchFn:respond(200,'')});assert.equal(r.healthy,true);assert.equal(r.checks.within_latency_budget,null)});

// Recovery
test('Recovery blocks unverified completed side effects and dependents',()=>{const r=aidRecovery({steps:[{id:'charge',status:'succeeded',side_effects:true},{id:'email',status:'pending',depends_on:['charge'],side_effects:true}]});assert.equal(r.plan.automatic_execution_permitted,false);assert.ok(r.plan.blocked.some(b=>b.step==='charge'));assert.ok(r.plan.blocked.some(b=>b.step==='email'))});
test('Recovery resumes idempotent failed step in order',()=>{const r=aidRecovery({steps:[{id:'fetch',status:'succeeded'},{id:'transform',status:'failed',depends_on:['fetch'],idempotent:true},{id:'publish',status:'pending',depends_on:['transform'],side_effects:true}]});assert.deepEqual(r.plan.resume_in_topological_order,['transform','publish'])});

// HTTP surface (no DB needed)
test('GET /health reports engine 2.5.0 and disabled billing',async()=>{const res=await worker.fetch(new Request('https://x.test/health'),{BETA_MODE:'open'});const j=await res.json();assert.equal(j.engine_version,'2.5.0');assert.equal(j.billing_mode,'disabled');assert.equal(j.live_payments,false)});
test('MCP tools/list is public and lists monitor max_duration_ms',async()=>{const res=await worker.fetch(new Request('https://x.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),{DB:{}});const j=await res.json();const m=j.result.tools.find(t=>t.name==='monitor');assert.ok(m.inputSchema.properties.max_duration_ms)});

// Witness signing-key split (2.5.0). Throwaway test keys only; production keys live in Cloudflare secrets.
const WKEY='unit-test-witness-key-0123456789abcdef-not-a-secret';
const PEPPER='unit-test-legacy-pepper-not-a-secret';
const BEFORE=()=>Date.parse('2026-11-18T12:00:00Z'), AFTER=()=>Date.parse('2026-12-19T06:00:00Z');
const doc={document:{run:{status:'complete'}},required_fields:['run.status']};
const keys={witnessKey:WKEY,legacyKey:PEPPER,now:BEFORE};
test('Key split: new receipts sign with WITNESS_SIGNING_KEY and carry key_id',async()=>{const r=await aidWitness(doc,{witnessKey:WKEY,signingKey:PEPPER});assert.equal(r.signature.key_id,WITNESS_KEY_ID);const v=await aidValidateReceipt(r,keys);assert.equal(v.valid,true);assert.equal(v.key_id,WITNESS_KEY_ID);assert.equal(v.legacy_key,false)});
test('Key split: executeTool signs with env.WITNESS_SIGNING_KEY, not REGISTRATION_PEPPER',async()=>{const r=await executeTool('witness',doc,{WITNESS_SIGNING_KEY:WKEY,REGISTRATION_PEPPER:PEPPER});assert.equal(r.signature.key_id,WITNESS_KEY_ID);assert.equal((await aidValidateReceipt(r,{witnessKey:WKEY,now:BEFORE})).valid,true);assert.equal((await aidValidateReceipt({...r,signature:{...r.signature,key_id:LEGACY_WITNESS_KEY_ID}},{legacyKey:PEPPER,now:BEFORE})).valid,false)});
test('Key split: legacy receipt (key_id aidnode-worker-v2, pepper-signed) verifies during transition',async()=>{const r=await aidWitness(doc,{signingKey:PEPPER,now:BEFORE});assert.equal(r.signature.key_id,LEGACY_WITNESS_KEY_ID);const v=await aidValidateReceipt(r,keys);assert.equal(v.valid,true);assert.equal(v.legacy_key,true);assert.equal(v.legacy_accepted_until,LEGACY_RECEIPT_ACCEPT_UNTIL)});
test('Key split: legacy receipt with no key_id verifies during transition',async()=>{const r=await aidWitness(doc,{signingKey:PEPPER,now:BEFORE});const sig={...r.signature};delete sig.key_id;const v=await aidValidateReceipt({...r,signature:sig},keys);assert.equal(v.valid,true);assert.equal(v.legacy_key,true)});
test('Key split: legacy receipts are rejected after the 2026-12-18 CST cutoff',async()=>{assert.equal(LEGACY_RECEIPT_ACCEPT_UNTIL,'2026-12-19T05:59:59Z');const r=await aidWitness(doc,{signingKey:PEPPER,now:BEFORE});const v=await aidValidateReceipt(r,{...keys,now:AFTER});assert.equal(v.valid,false);assert.equal(v.reason,'legacy_key_retired');const n=await aidWitness(doc,{witnessKey:WKEY});assert.equal((await aidValidateReceipt(n,{...keys,now:AFTER})).valid,true)});
test('Key split: no pepper fallback signing after the cutoff',async()=>{const r=await aidWitness(doc,{signingKey:PEPPER,now:AFTER});assert.equal(r.signature,undefined)});
test('Key split: forged and tampered new-key receipts are rejected',async()=>{const r=await aidWitness(doc,{witnessKey:WKEY});assert.equal((await aidValidateReceipt({...r,passed:false},keys)).valid,false);const forged=await aidWitness(doc,{witnessKey:'attacker-guess-key-0123456789abcdef-xyz'});assert.equal(forged.signature.key_id,WITNESS_KEY_ID);const v=await aidValidateReceipt(forged,keys);assert.equal(v.valid,false);assert.equal(v.reason,'signature_mismatch');assert.equal((await aidValidateReceipt({...r,signature:{...r.signature,value:'0'.repeat(64)}},keys)).valid,false)});
test('Key split: receipt signed with REGISTRATION_PEPPER under the new key_id is rejected',async()=>{const forged=await aidWitness(doc,{witnessKey:PEPPER.padEnd(40,'x')});const legacy=await aidWitness(doc,{signingKey:PEPPER,now:BEFORE});assert.equal((await aidValidateReceipt({...legacy,signature:{...legacy.signature,key_id:WITNESS_KEY_ID}},keys)).valid,false);assert.equal((await aidValidateReceipt(forged,keys)).valid,false)});
test('Key split: wrong or unknown key_id is rejected',async()=>{const r=await aidWitness(doc,{witnessKey:WKEY});for(const id of ['aidnode-witness-k2','',' aidnode-witness-k1',LEGACY_WITNESS_KEY_ID]){const v=await aidValidateReceipt({...r,signature:{...r.signature,key_id:id}},keys);assert.equal(v.valid,false,`key_id ${JSON.stringify(id)}`)}assert.equal((await aidValidateReceipt({...r,signature:{...r.signature,key_id:42}},keys)).reason,'unknown_key_id');assert.equal((await aidValidateReceipt({...r,signature:{...r.signature,key_id:'aidnode-witness-k2'}},keys)).reason,'unknown_key_id')});
test('Key split: key_id alone does not grant validity',async()=>{const bare={receipt_version:2,engine:'aidnode-witness',passed:true,receipt_id:'x',signature:{algorithm:'HMAC-SHA256',key_id:WITNESS_KEY_ID}};assert.equal((await aidValidateReceipt(bare,keys)).valid,false);assert.equal((await aidValidateReceipt({...bare,signature:{...bare.signature,value:'f'.repeat(64)}},keys)).valid,false);assert.equal((await aidValidateReceipt({...bare,signature:{...bare.signature,key_id:LEGACY_WITNESS_KEY_ID,value:'a'.repeat(64)}},keys)).valid,false)});
test('Key split: new key_id cannot verify when WITNESS_SIGNING_KEY is not configured',async()=>{const r=await aidWitness(doc,{witnessKey:WKEY});const v=await aidValidateReceipt(r,{legacyKey:PEPPER,now:BEFORE});assert.equal(v.valid,false);assert.equal(v.reason,'signing_not_configured')});
test('Key split: short WITNESS_SIGNING_KEY (<32 chars) is not used for signing',async()=>{const r=await aidWitness(doc,{witnessKey:'too-short-key',signingKey:PEPPER,now:BEFORE});assert.equal(r.signature.key_id,LEGACY_WITNESS_KEY_ID)});
test('Key split: POST /receipts/verify accepts new and legacy receipts, rejects forgery',async()=>{const env={BETA_MODE:'open',WITNESS_SIGNING_KEY:WKEY,REGISTRATION_PEPPER:PEPPER};const post=async receipt=>(await worker.fetch(new Request('https://x.test/receipts/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({receipt})}),env)).json();const n=await aidWitness(doc,{witnessKey:WKEY});const l=await aidWitness(doc,{signingKey:PEPPER,now:BEFORE});const nv=await post(n);assert.equal(nv.valid,true);assert.equal(nv.key_id,WITNESS_KEY_ID);const lv=await post(l);if(Date.now()<=Date.parse(LEGACY_RECEIPT_ACCEPT_UNTIL)){assert.equal(lv.valid,true);assert.equal(lv.legacy_key,true)}else{assert.equal(lv.valid,false);assert.equal(lv.reason,'legacy_key_retired')}assert.equal((await post({...n,passed:false})).valid,false)});

// Discovery metadata (growth/first-users): public, truthful, SEP-2127 server card + AI catalog.
test('GET /mcp/server-card returns a SEP-2127 server card matching server.json identity',async()=>{
 const res=await worker.fetch(new Request('https://x.test/mcp/server-card'),{BETA_MODE:'open'});
 assert.equal(res.status,200);
 assert.equal(res.headers.get('content-type'),'application/mcp-server-card+json');
 assert.equal(res.headers.get('access-control-allow-origin'),'*');
 const c=await res.json();
 assert.equal(c.name,'io.github.AIDNodeOfficial/aidnode');
 assert.ok(c.$schema.includes('server-card'));
 assert.equal(c.remotes[0].type,'streamable-http');
 assert.equal(c.remotes[0].url,'https://x.test/mcp');
 assert.equal(c.remotes[0].headers[0].isSecret,true);
 assert.ok(!JSON.stringify(c).match(/glama_claim|sk_|Bearer [A-Za-z0-9]{16,}/));
});
test('GET /.well-known/ai-catalog.json points at the server card',async()=>{
 const res=await worker.fetch(new Request('https://x.test/.well-known/ai-catalog.json'),{BETA_MODE:'open'});
 assert.equal(res.status,200);
 const c=await res.json();
 assert.equal(c.entries[0].type,'application/mcp-server-card+json');
 assert.equal(c.entries[0].url,'https://x.test/mcp/server-card');
});
test('llms.txt follows llmstxt.org shape and no longer claims Verify never fetches',async()=>{
 const res=await worker.fetch(new Request('https://x.test/llms.txt'),{BETA_MODE:'open'});
 const t=await res.text();
 assert.ok(t.startsWith('# AIDNode\n\n> '));
 assert.ok(!t.includes('no website fetched'));
 assert.match(t,/allowlist of public HTTPS hosts/);
 for(const tool of ['repair','verify','witness','monitor','recovery'])assert.match(t,new RegExp('- '+tool+':'));
});
test('tool descriptions say when to use each tool; names unchanged',()=>{
 assert.deepEqual(enhancedToolSpecs.map(t=>t.name),['repair','verify','witness','monitor','recovery']);
 for(const t of enhancedToolSpecs){assert.match(t.description,/Use (after|to|when)/);assert.ok(t.description.length<=400,t.name)}
});
test('/docs no longer says registry publication is pending',async()=>{
 const res=await worker.fetch(new Request('https://x.test/docs'),{BETA_MODE:'open'});
 const h=await res.text();
 assert.ok(!h.includes('pending namespace verification'));
 assert.ok(h.includes('Monitor'));
});

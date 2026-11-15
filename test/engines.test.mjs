// AIDNode engine regression tests (v2.4). Offline: every network call uses an injected fetchFn.
// Ported from PR #2 (improvements/v2-2-safety-and-evidence) and adapted to the deployed 2.3.0 lineage.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {ENGINE_VERSION,aidRepair,aidVerify,aidWitness,aidValidateReceipt,aidMonitor,aidRecovery,executeEnhancedTool,enhancedToolSpecs,sha256} from '../src/worker.js';

const url='https://developers.cloudflare.com/workers/';
const respond=(status,body,headers={})=>async()=>new Response(body,{status,headers});
const KEY='unit-test-signing-key-not-a-secret';

test('engine version is 2.4.0',()=>{assert.equal(ENGINE_VERSION,'2.4.0')});
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
test('Witness allows a digest-only assertion',async()=>{const doc={a:1};const r=await aidWitness({document:doc,required_fields:[],expected_sha256:await sha256(JSON.stringify(doc))},{signingKey:KEY});assert.equal(r.checks.assertion_count,1);assert.ok(r.signature)});
test('Witness declines external evidence on 404',async()=>{const r=await aidWitness({document:{a:1},required_fields:['a'],external_evidence:{url,expected_sha256:await sha256('oops')}},{fetchFn:respond(404,'oops')});assert.equal(r.passed,false);assert.equal(r.external_evidence.http_success,false)});
test('Witness signed receipt verifies; tampered receipt fails',async()=>{const r=await aidWitness({document:{run:{status:'complete'}},required_fields:['run.status']},{signingKey:KEY});assert.equal(r.passed,true);assert.equal(r.external_task_completion_verified,false);assert.equal((await aidValidateReceipt(r,KEY)).valid,true);assert.equal((await aidValidateReceipt({...r,passed:false},KEY)).valid,false)});

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
test('GET /health reports engine 2.4.0 and disabled billing',async()=>{const res=await worker.fetch(new Request('https://x.test/health'),{BETA_MODE:'open'});const j=await res.json();assert.equal(j.engine_version,'2.4.0');assert.equal(j.billing_mode,'disabled');assert.equal(j.live_payments,false)});
test('MCP tools/list is public and lists monitor max_duration_ms',async()=>{const res=await worker.fetch(new Request('https://x.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),{DB:{}});const j=await res.json();const m=j.result.tools.find(t=>t.name==='monitor');assert.ok(m.inputSchema.properties.max_duration_ms)});

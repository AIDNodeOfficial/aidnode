// AIDNode Engines v2.2 - deterministic, auditable AI-agent utilities. No external AI model is claimed.
// Execute in Cloudflare Workers or Node >=20. All network probes are GET/HEAD to strict approved HTTPS hosts.
export const ENGINE_VERSION = '2.2.0';
const ENGINE_MAX_TEXT=100000, MAX_JSON=100000, MAX_DIFFS=32;
const TRUSTED_HOSTS=new Set([
 'developers.cloudflare.com','docs.github.com','developer.mozilla.org',
 'www.rfc-editor.org','www.w3.org','www.ietf.org','www.nist.gov',
 'raw.githubusercontent.com','registry.modelcontextprotocol.io',
 'botstop-dev.botstop-dev-lab-2026.workers.dev'
]);
const now=()=>new Date().toISOString();
const fail=(s)=>{throw Error(s)};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const cap=(v,limit)=>{if(typeof v!=='string'||v.length>limit)fail('text exceeds allowed length or is not a string');return v;};
const hex=bytes=>Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function sha256(text){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
const safeType=(v)=>Array.isArray(v)?'array':v===null?'null':typeof v;
function canonical(value,depth=0){
 if(depth>24)fail('JSON depth limit exceeded');
 if(Array.isArray(value))return `[${value.map(v=>canonical(v,depth+1)).join(',')}]`;
 if(obj(value)){const keys=Object.keys(value).sort();if(keys.length>1000)fail('too many JSON fields');return `{${keys.map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')}}`;}
 if(typeof value==='number'&&!Number.isFinite(value))fail('non-finite JSON number');
 const s=JSON.stringify(value); if(s===undefined)fail('unsupported JSON value');return s;
}
function guardJson(v){const s=canonical(v);if(s.length>MAX_JSON)fail('JSON exceeds 100,000 characters');return s;}
function pathValue(doc,path){if(!/^(?!.*(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$))[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*){0,9}$/.test(path)||path.length>180)fail('invalid field path');let x=doc;for(const part of path.split('.')){if(!obj(x)||!Object.hasOwn(x,part))return {found:false};x=x[part];}return{found:true,value:x};}
const orderIds=(steps)=>{
 const map=new Map(steps.map(s=>[s.id,s])),visited=new Map(),ordered=[];
 function visit(id){if(visited.get(id)===1)fail('dependency_cycle');if(visited.get(id)===2)return;visited.set(id,1);const s=map.get(id);for(const dep of s.depends_on||[]){if(!map.has(dep))fail('unknown dependency: '+dep);visit(dep)}visited.set(id,2);ordered.push(s)}
 for(const s of steps)visit(s.id);return ordered;
};
const sampleRetry=(base,attempt,capMs)=>Math.min(capMs,base*Math.pow(2,Math.min(8,Math.max(0,attempt-1))));
const header=(h,key)=>{if(!obj(h))return null;const found=Object.entries(h).find(([k])=>k.toLowerCase()===key.toLowerCase());return found?String(found[1]).slice(0,500):null;};
const classifyError=(status,code)=>{
 if(code&&/^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|DNS_ERROR|NETWORK_ERROR|TLS_ERROR)$/.test(code))return {category:code.toLowerCase(),transient:code!=='TLS_ERROR',cause:'network_or_transport_failure'};
 if(status===429)return {category:'rate_limited',transient:true,cause:'quota_or_rate_limit'};
 if([408,425,500,502,503,504].includes(status))return {category:'upstream_transient',transient:true,cause:'upstream_or_timeout'};
 if(status===401)return {category:'authentication',transient:false,cause:'credentials_missing_or_expired'};
 if(status===403)return {category:'authorization',transient:false,cause:'access_denied'};
 if(status===409)return {category:'conflict',transient:false,cause:'concurrent_or_version_conflict'};
 if(status===422||status===400)return {category:'request_validation',transient:false,cause:'invalid_or_semantic_payload'};
 if(status===404)return {category:'missing_resource',transient:false,cause:'resource_or_route_absent'};
 if(status>=500)return {category:'server_error',transient:true,cause:'unknown_server_error'};
 if(status>=400)return {category:'client_error',transient:false,cause:'request_error'};
 return {category:'not_failure',transient:false,cause:'status_not_an_error'};
};
function retryAfterSeconds(inp){
 const value=inp.retry_after_seconds; if(value!==undefined){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>86400)fail('invalid retry_after_seconds');return value;}
 const raw=header(inp.response_headers,'retry-after');if(!raw)return null;
 if(/^\d+$/.test(raw))return Math.min(86400,Number(raw));
 const parsed=Date.parse(raw);return Number.isFinite(parsed)?Math.max(0,Math.min(86400,Math.ceil((parsed-Date.now())/1000))):null;
}
export async function aidRepair(input){
 if(!obj(input))fail('repair input must be an object');
 const status=input.status,code=input.network_error;
 if(status!==undefined&&(!Number.isInteger(status)||status<100||status>599))fail('status must be an HTTP integer 100..599');
 if(status===undefined&&!code)fail('status or network_error is required');
 if(code!==undefined&&!/^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|DNS_ERROR|NETWORK_ERROR|TLS_ERROR)$/.test(code))fail('network_error must be a supported transport code');
 const method=String(input.method||'UNKNOWN').toUpperCase();if(!['GET','HEAD','OPTIONS','PUT','DELETE','POST','PATCH','UNKNOWN'].includes(method))fail('unsupported HTTP method');
 const attempt=input.attempt??1;if(!Number.isInteger(attempt)||attempt<1||attempt>100)fail('attempt must be 1..100');
 const maxAttempts=input.max_attempts??3;if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)fail('max_attempts must be 1..10');
 const idempotent=['GET','HEAD','OPTIONS','PUT','DELETE'].includes(method)||input.idempotency_key_present===true;
 const classification=classifyError(status,code);
 const unknownOutcome=Boolean(input.request_may_have_committed)||[408,502,504].includes(status)||['ECONNRESET','ETIMEDOUT'].includes(code);
 const requireOutcomeCheck=unknownOutcome&&method!=='GET'&&method!=='HEAD'&&method!=='OPTIONS';
 const allowed=classification.transient&&idempotent&&!requireOutcomeCheck&&attempt<maxAttempts;
 const seconds=retryAfterSeconds(input);
 const retryDelay=allowed?Math.max(seconds===null?0:seconds*1000,sampleRetry(800,attempt,30000)):null;
 const explanation=(classification.category==='rate_limited')?'Honor Retry-After and enforce concurrency limits.'
  :(classification.category==='authentication')?'Refresh only through an authorized credential provider; do not repeat invalid credentials.'
  :(classification.category==='authorization')?'Stop and request operator permission; never bypass access controls.'
  :(classification.category==='conflict')?'Read current version/state, reconcile changes, then use a conditional write.'
  :(classification.category==='request_validation')?'Fix input against the API schema before retrying.'
  :(classification.category==='missing_resource')?'Confirm target ID, version and endpoint before retrying.'
  :(classification.transient?'Retry only after verifying idempotency and outcome; use backoff and jitter.':'Inspect the error; an automatic retry is not justified.');
 return {engine:'aidnode-repair',version:ENGINE_VERSION,category:classification.category,probable_cause:classification.cause,status:status??null,method,transient:classification.transient,automatic_retry_permitted:allowed,requires_outcome_check:requireOutcomeCheck,action:allowed?'retry_with_jitter':requireOutcomeCheck?'check_outcome_before_retry':classification.category==='not_failure'?'no_action':'diagnose_or_escalate',retry_policy:{max_attempts:maxAttempts,attempt,retry_after_seconds:seconds,minimum_delay_ms:retryDelay,maximum_jitter_ms:allowed?Math.ceil(retryDelay*.25):null},steps:[explanation,...(requireOutcomeCheck?['Check status using a safe GET or idempotency-key lookup before reissuing any state-changing request.']:[]),...(allowed?['Retry the identical request at most '+(maxAttempts-attempt)+' additional time(s); stop if the condition persists.']:[])],evidence_basis:'submitted_status_headers_and_metadata',actions_performed:[],checked_at:now()};
}
function diffJson(a,b,path='$',changes=[]){if(changes.length>=MAX_DIFFS)return changes;if(canonical(a)===canonical(b))return changes;if(obj(a)&&obj(b)){
 for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
 if(changes.length>=MAX_DIFFS)break;const p=path+'.'+key;if(!Object.hasOwn(a,key))changes.push({path:p,kind:'added'});else if(!Object.hasOwn(b,key))changes.push({path:p,kind:'removed'});else diffJson(a[key],b[key],p,changes);
 }return changes;}
 if(Array.isArray(a)&&Array.isArray(b)){if(a.length!==b.length)changes.push({path,kind:'array_length_changed',before:a.length,after:b.length});for(let i=0;i<Math.min(a.length,b.length)&&changes.length<MAX_DIFFS;i++)diffJson(a[i],b[i],path+'['+i+']',changes);return changes;}
 changes.push({path,kind:'value_changed',old_type:safeType(a),new_type:safeType(b)});return changes;
}
// SSRF protection: fixed, reviewed host allowlist. Not a general-purpose HTTP proxy.
export function approvedUrl(raw){
 if(typeof raw!=='string'||raw.length>1200)fail('URL must be a string <=1200 chars');
 let u;try{u=new URL(raw)}catch{fail('invalid URL')}
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||!TRUSTED_HOSTS.has(u.hostname.toLowerCase()))fail('unapproved_public_https_destination');
 return u.toString();
}
async function publicObservation(url,{method='GET',maxBytes=16384,fetchFn=fetch}={}){
 const target=approvedUrl(url);const start=Date.now();let response;
 try{response=await fetchFn(target,{method,redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'Accept':'text/plain, application/json, text/html;q=0.8, */*;q=0.1','User-Agent':'AIDNode-Verification/2.1'}})}
 catch(e){return {reachable:false,kind:'network_error',error:String(e?.name||'network_error').slice(0,80),url:target,observed_at:now(),duration_ms:Date.now()-start}};
 const r={reachable:true,url:target,http_status:response.status,kind:'http_observation',duration_ms:Date.now()-start,observed_at:now(),content_type:(response.headers.get('content-type')||'').slice(0,90),etag:(response.headers.get('etag')||'').slice(0,180),redirected:response.status>=300&&response.status<400};
 if(method==='HEAD')return r;
 if(Number(response.headers.get('content-length')||0)>maxBytes){r.body_unavailable='declared_content_too_large';return r;}
 const reader=response.body?.getReader();if(!reader){r.body_unavailable='no_stream';return r;}
 let total=0;const parts=[];try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes){r.body_unavailable='body_size_limit';await reader.cancel();return r;}parts.push(value);}}catch(e){r.body_unavailable='stream_error';return r;}
 const bytes=new Uint8Array(total);let pos=0;for(const p of parts){bytes.set(p,pos);pos+=p.length}
 r.body_sha256=hex(await crypto.subtle.digest('SHA-256',bytes));r.body_bytes=total;return r;
}
export async function aidVerify(input,{fetchFn=fetch}={}){
 if(!obj(input))fail('verify input must be an object');const mode=input.mode||'compare_text';
 if(mode==='compare_text'){
  const previous=cap(input.previous,ENGINE_MAX_TEXT),current=cap(input.current,ENGINE_MAX_TEXT);const [a,b]=await Promise.all([sha256(previous),sha256(current)]);
  let firstChangedAt=null;for(let i=0;i<Math.min(previous.length,current.length);i++)if(previous[i]!==current[i]){firstChangedAt=i;break}
  if(firstChangedAt===null&&previous.length!==current.length)firstChangedAt=Math.min(previous.length,current.length);
  return {engine:'aidnode-verify',version:ENGINE_VERSION,mode,changed:a!==b,previous_sha256:a,current_sha256:b,previous_chars:previous.length,current_chars:current.length,first_changed_index:firstChangedAt,evidence_basis:'caller_supplied_text',independent_public_fetch:false,checked_at:now()};
 }
 if(mode==='compare_json'){
  if(input.previous===undefined||input.current===undefined)fail('previous and current JSON required');const [a,b]=[guardJson(input.previous),guardJson(input.current)];const changes=diffJson(input.previous,input.current);
  return {engine:'aidnode-verify',version:ENGINE_VERSION,mode,changed:a!==b,previous_sha256:await sha256(a),current_sha256:await sha256(b),changes,truncated:changes.length>=MAX_DIFFS,evidence_basis:'canonical_caller_supplied_json',checked_at:now()};
 }
 if(mode==='public_http'){
  const observation=await publicObservation(input.url,{maxBytes:32768,fetchFn});
  const expected=input.expected_sha256;if(expected!==undefined&&!/^[a-f0-9]{64}$/.test(expected))fail('expected_sha256 must be lowercase 64-character hex');
  const digestMatches=expected===undefined?null:(observation.body_sha256?expected===observation.body_sha256:null);
  const validResponse=observation.reachable===true&&!observation.redirected&&observation.http_status>=200&&observation.http_status<300&&Boolean(observation.body_sha256);
  return {engine:'aidnode-verify',version:ENGINE_VERSION,mode,observation,digest_matches:digestMatches,independent_check_succeeded:validResponse&&(expected===undefined||digestMatches===true),evidence_basis:'independent_public_https_fetch_from_fixed_allowlist',does_not_prove:'semantic_truth_or_authorship',checked_at:now()};
 }
 fail('unsupported verify mode');
}
export async function aidWitness(input,{signingKey,fetchFn=fetch}={}){
 if(!obj(input)||!obj(input.document)||!Array.isArray(input.required_fields))fail('document object and required_fields array are required');
 const canonicalDocument=guardJson(input.document);
 if(input.required_fields.length>100)fail('too many required_fields');
 if(input.required_fields.length===0&&Object.keys(input.expected_values||{}).length===0&&Object.keys(input.expected_types||{}).length===0&&input.expected_sha256===undefined&&input.external_evidence===undefined)fail('at least one validation assertion is required');
 const failures=[];for(const field of input.required_fields){if(typeof field!=='string')fail('invalid field path');const got=pathValue(input.document,field);if(!got.found)failures.push({path:field,reason:'missing'});}
 if(input.expected_values!==undefined){if(!obj(input.expected_values))fail('expected_values must be object');for(const [field,expected] of Object.entries(input.expected_values)){const got=pathValue(input.document,field);if(!got.found||canonical(got.value)!==canonical(expected))failures.push({path:field,reason:'unexpected_value'});}}
 if(input.expected_types!==undefined){if(!obj(input.expected_types))fail('expected_types must be object');for(const [field,expected] of Object.entries(input.expected_types)){if(!['string','number','boolean','object','array','null'].includes(expected))fail('unsupported expected_type');const got=pathValue(input.document,field);if(!got.found||safeType(got.value)!==expected)failures.push({path:field,reason:'unexpected_type',expected});}}
 const digest=await sha256(canonicalDocument);if(input.expected_sha256!==undefined){if(!/^[a-f0-9]{64}$/.test(input.expected_sha256))fail('expected_sha256 must be lowercase hex');if(input.expected_sha256!==digest)failures.push({path:'$',reason:'document_digest_mismatch'});}
 let externalEvidence=null;
 if(input.external_evidence!==undefined){
   if(!obj(input.external_evidence)||typeof input.external_evidence.url!=='string'||!/^[a-f0-9]{64}$/.test(input.external_evidence.expected_sha256||''))fail('external_evidence requires url and expected_sha256');
   const probe=await publicObservation(input.external_evidence.url,{maxBytes:32768,fetchFn});
   const digestMatched=probe.body_sha256?probe.body_sha256===input.external_evidence.expected_sha256:false;
   const validStatus=probe.reachable===true&&!probe.redirected&&probe.http_status>=200&&probe.http_status<300;
   externalEvidence={url:probe.url,observed_at:probe.observed_at,http_status:probe.http_status??null,observed_sha256:probe.body_sha256??null,digest_matches:digestMatched,http_status_accepted:validStatus};
   if(!digestMatched||!validStatus)failures.push({path:'external_evidence',reason:'independent_artifact_evidence_unverified'});
 }
 const issued=now();const result={receipt_version:2,engine:'aidnode-witness',version:ENGINE_VERSION,receipt_id:crypto.randomUUID(),issued_at:issued,checked_at:issued,document_sha256:digest,passed:failures.length===0,failures,checks:{required_field_count:input.required_fields.length,expected_value_count:Object.keys(input.expected_values||{}).length,expected_type_count:Object.keys(input.expected_types||{}).length},evidence_basis:externalEvidence?'supplied_document_plus_independent_public_artifact':'caller_supplied_document',external_evidence:externalEvidence,external_task_completion_verified:false};
 // A keyed signature proves AIDNode produced this receipt. It does not prove real-world task execution.
 if(typeof signingKey==='string'&&signingKey.length>=16){const signPayload=canonical(result);const keyBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('aidnode-witness-receipt-v2|'+signingKey));const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);result.signature={algorithm:'HMAC-SHA256',key_id:'aidnode-worker-v2',value:hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signPayload)))};}
 return result;
}
// Third parties can verify the signature of a receipt without the original private document.
export async function aidValidateReceipt(receipt,signingKey){
 if(!obj(receipt)||!obj(receipt.signature)||receipt.signature.algorithm!=='HMAC-SHA256')return {valid:false,reason:'malformed_receipt'};
 if(typeof signingKey!=='string'||signingKey.length<16)return {valid:false,reason:'signing_not_configured'};
 const value=receipt.signature.value;if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))return {valid:false,reason:'invalid_signature_format'};
 const clean={...receipt};delete clean.signature;
 try{
  const keyBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('aidnode-witness-receipt-v2|'+signingKey));
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(value.match(/../g).map(x=>parseInt(x,16)));
  const valid=await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(canonical(clean)));
  return {valid,receipt_id:receipt.receipt_id||null,scope:'authenticates_receipt_issuer_not_real_world_completion'};
 }catch{return {valid:false,reason:'invalid_receipt'}}
}
export async function aidMonitor(input,{fetchFn=fetch}={}){
 if(!obj(input))fail('monitor input must be an object');const method=input.method||'HEAD';if(!['HEAD','GET'].includes(method))fail('method must be HEAD or GET');
 const expected=input.expected_status??[200,399];if(!Array.isArray(expected)||expected.length!==2||expected.some(x=>!Number.isInteger(x)||x<100||x>599)||expected[0]>expected[1])fail('expected_status must be a pair of valid HTTP bounds');
 const maxDuration=input.max_duration_ms;
 if(maxDuration!==undefined&&(!Number.isInteger(maxDuration)||maxDuration<1||maxDuration>30000))fail('max_duration_ms must be 1..30000');
 const obs=await publicObservation(input.url,{method,fetchFn,maxBytes:16384});
 const statusOk=obs.reachable&&obs.http_status>=expected[0]&&obs.http_status<=expected[1]&&!obs.redirected;
 let contentOk=null;if(input.expected_sha256!==undefined){if(!/^[a-f0-9]{64}$/.test(input.expected_sha256))fail('expected_sha256 invalid');contentOk=obs.body_sha256?obs.body_sha256===input.expected_sha256:null;}
 const durationOk=maxDuration===undefined?null:obs.duration_ms<=maxDuration;
 const healthy=statusOk&&(input.expected_sha256===undefined||contentOk===true)&&(maxDuration===undefined||durationOk===true);
 return {engine:'aidnode-monitor',version:ENGINE_VERSION,healthy,observed:obs,checks:{http_status_in_range:statusOk,body_digest_matches:contentOk,within_latency_budget:durationOk,max_duration_ms:maxDuration??null,expected_http_status:expected},mode:'on_demand_public_endpoint_probe',continuous_scheduling_enabled:false,probe_constraints:'approved_HTTPS_hosts_only_no_redirects',checked_at:now()};
}
export function aidRecovery(input){
 if(!obj(input)||!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>40)fail('steps array of 1..40 required');
 const validStatus=new Set(['pending','running','succeeded','failed','skipped']);const ids=new Set();
 const steps=input.steps.map(s=>{
 if(!obj(s)||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(s.id)||ids.has(s.id))fail('invalid or duplicated step id');ids.add(s.id);
 if(!validStatus.has(s.status))fail('invalid step status');
 if(s.depends_on!==undefined&&(!Array.isArray(s.depends_on)||s.depends_on.length>40||s.depends_on.some(d=>typeof d!=='string')))fail('invalid step dependencies');
 return {id:s.id,status:s.status,depends_on:s.depends_on||[],idempotent:s.idempotent===true,has_verified_outcome:s.has_verified_outcome===true,has_compensation:s.has_compensation===true,side_effects:s.side_effects===true};
 });
 const ordered=orderIds(steps);const byId=new Map(ordered.map(s=>[s.id,s]));const resume=[],blocked=[],preserve=[];
 for(const step of ordered){
  if(step.status==='succeeded'){
   if(step.side_effects&&!step.has_verified_outcome){blocked.push({step:step.id,reason:'completed_side_effect_without_verified_outcome'});continue;}
   preserve.push(step.id);continue;}
  if(step.status==='skipped'){blocked.push({step:step.id,reason:'skipped_step_requires_operator_decision'});continue;}
  const unmet=step.depends_on.filter(id=>!preserve.includes(id)&&!resume.includes(id));
  if(unmet.length){blocked.push({step:step.id,reason:'unsatisfied_dependencies',dependencies:unmet});continue;}
  if(step.status==='running'){blocked.push({step:step.id,reason:'in_flight_requires_reconciliation'});continue;}
  if(step.status==='failed'&&step.side_effects&&!step.idempotent){blocked.push({step:step.id,reason:'non_idempotent_side_effect_requires_manual_reconciliation'});continue;}
  if(step.status==='failed'&&!step.idempotent){blocked.push({step:step.id,reason:'unsafe_to_replay_without_operator_review'});continue;}
  if(step.status==='pending'||step.status==='failed'||step.status==='running')resume.push(step.id);
 }
 const permitted=Boolean(resume.length)&&!blocked.length;
 return {engine:'aidnode-recovery',version:ENGINE_VERSION,plan:{resume_in_topological_order:resume,preserve_completed:preserve,blocked,compensation_candidates:ordered.filter(s=>s.status==='succeeded'&&s.has_compensation).map(s=>s.id).reverse(),automatic_execution_permitted:false,operator_review_recommended:!permitted||ordered.some(s=>s.side_effects)},evidence_basis:'caller_supplied_workflow_state',actions_performed:[],note:'A recovery plan, not replay or proof of an external state. Never blindly repeat state-changing operations.',checked_at:now()};
}
const opid={type:'string',description:'Unique call id 8-100 characters; counted once by beta ledger'};
export const enhancedToolSpecs=[
 {name:'repair',description:'AIDNode Repair v2: classify HTTP/transport failures, retry safety, idempotency, Retry-After, bounded backoff. Advisory only.',inputSchema:{type:'object',properties:{operation_id:opid,status:{type:'integer',minimum:100,maximum:599},network_error:{type:'string'},method:{type:'string',enum:['GET','HEAD','OPTIONS','PUT','DELETE','POST','PATCH']},attempt:{type:'integer'},max_attempts:{type:'integer'},idempotency_key_present:{type:'boolean'},request_may_have_committed:{type:'boolean'},response_headers:{type:'object'},retry_after_seconds:{type:'number'}},required:['operation_id'],additionalProperties:false}},
 {name:'verify',description:'AIDNode Verify v2: text diff/hash, canonical JSON change paths, or independent digest of retrieved public HTTPS source from strict host allowlist.',inputSchema:{type:'object',properties:{operation_id:opid,mode:{type:'string',enum:['compare_text','compare_json','public_http']},previous:{},current:{},url:{type:'string'},expected_sha256:{type:'string'}},required:['operation_id'],additionalProperties:false}},
 {name:'witness',description:'AIDNode Witness v2: validate supplied structured evidence and issue HMAC-signed, hash-based validation receipt; not real-world action attestation.',inputSchema:{type:'object',properties:{operation_id:opid,document:{type:'object'},required_fields:{type:'array',items:{type:'string'}},expected_values:{type:'object'},expected_types:{type:'object'},expected_sha256:{type:'string'},external_evidence:{type:'object',properties:{url:{type:'string'},expected_sha256:{type:'string'}},required:['url','expected_sha256']}},required:['operation_id','document','required_fields'],additionalProperties:false}},
 {name:'monitor',description:'AIDNode Monitor v2: live independent HTTP HEAD/GET health and optional content digest check of approved public HTTPS hosts. On-demand only.',inputSchema:{type:'object',properties:{operation_id:opid,url:{type:'string'},method:{type:'string',enum:['HEAD','GET']},expected_status:{type:'array',items:{type:'integer'},minItems:2,maxItems --- TRUNCATED --- 24,859 chars
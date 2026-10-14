import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const root='website';
const source=name=>fs.readFileSync(`${root}/js/${name}.js`,'utf8');
let passed=0;
const stored=new Map();
const storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
let handler,requests=[];
const context={window:{STP_CONFIG:{supabaseUrl:'https://example.supabase.co',supabasePublicKey:'sb_publishable_example'}},sessionStorage:storage,crypto:webcrypto,Uint8Array,AbortSignal,fetch:async(url,options)=>{requests.push({url,options});return handler(url,options);},console};
vm.createContext(context);vm.runInContext(source('api'),context);
const api=context.window.STP_API;
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
for(const input of ['078123456','78 123456','+232 78 123456','00232 78 123456'])assert.equal(api.phone(input),'+23278123456');
for(const input of ['07812345699','+23378123456','abc78123456','071123456','781234','000000000'])assert.equal(api.phone(input),null);passed++;
const token=api.randomToken();assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,api.randomToken());passed++;
handler=async()=>response('registration-id');
await api.rpc('stp_register',{r_token:token});assert.equal(requests.at(-1).options.headers.Authorization,undefined);passed++;
handler=async(url)=>url.includes('/token?')?response({access_token:'admin-token',refresh_token:'refresh',expires_in:3600}):url.includes('stp_is_admin')?response(false):response({});
await assert.rejects(()=>api.login('ordinary@example.com','password'),/does not have admin/);assert.equal(api.session(),null);passed++;
handler=async(url)=>url.includes('/token?')?response({access_token:'admin-token',refresh_token:'refresh',expires_in:3600}):response(true);
await api.login('admin@example.com','password');assert.equal(api.session().access_token,'admin-token');passed++;
stored.set('stp-admin-session',JSON.stringify({access_token:'expired',refresh_token:'refresh',expires_at:0}));
handler=async(url)=>url.includes('refresh_token')?response({access_token:'fresh-token',refresh_token:'new-refresh',expires_in:3600}):response(true);
await api.rpc('stp_is_admin',{},true);assert.equal(requests.at(-1).options.headers.Authorization,'Bearer fresh-token');passed++;
handler=async(url)=>response(Array.from({length:url.includes('offset=1000')?1:500},(_,i)=>({id:i})));
assert.equal((await api.list('stp_registrations')).length,1001);passed++;
handler=async()=>response({message:'Registration is closed'},400);
await assert.rejects(()=>api.rpc('stp_register',{}),/Registration is closed/);passed++;
context.window.STP_CONFIG.supabaseUrl='';await assert.rejects(()=>api.rpc('stp_register',{}),/not connected/);passed++;
context.window.STP_CONFIG.supabaseUrl='https://example.supabase.co';

// Survey completion must depend on the database response, not just local answers.
const answers={age:20,current_situation:'Graduate',skill_interest:'Tech & websites',skill_income:'Sometimes',biggest_obstacle:'I need to improve my skill',goal:'Get a first client',future_investment:'Free only',next_expert:'A developer'};
async function surveyScenario(fail){
  let submit,destination,rpcArgs;
  const field={value:'',setCustomValidity(){}},button={disabled:false};
  const status={textContent:'',classList:{add(){},remove(){}}};
  const form={dataset:{key:'next_expert'},elements:{namedItem:()=>field},querySelector:s=>s.startsWith('button')?button:null,querySelectorAll:()=>[],addEventListener:(event,callback)=>{if(event==='submit')submit=callback;},reportValidity:()=>true};
  const s=new Map([['stp-survey',JSON.stringify(answers)],['stp-registration',JSON.stringify({id:'private-id',token})]]);
  const c={document:{body:{dataset:{question:'8'}},getElementById:id=>id==='survey-form'?form:status},sessionStorage:{getItem:k=>s.get(k)||null,setItem:(k,v)=>s.set(k,v)},window:{location:{assign:p=>destination=p,replace:p=>destination=p}},STP_API:{rpc:async(name,args)=>{rpcArgs={name,args};if(fail)throw new Error('Network unavailable');return true;}},FormData:class{get(){return field.value;}}};
  vm.runInNewContext(source('survey'),c);await submit({preventDefault(){}});
  assert.equal(rpcArgs.name,'stp_submit_survey');assert.equal(rpcArgs.args.r_token,token);
  if(fail){assert.equal(destination,undefined);assert.equal(button.disabled,false);assert.equal(JSON.parse(s.get('stp-survey')).submitted,false);assert.equal(status.textContent,'Network unavailable');}
  else{assert.equal(destination,'Skills_That_Pay_Survey_Complete.html');assert.equal(JSON.parse(s.get('stp-survey')).submitted,true);}
}
await surveyScenario(false);passed++;await surveyScenario(true);passed++;

// Registration retries reuse the same secret token after a lost response.
let submit,destination,attempts=[];
const fields={full_name:{value:'Test Person'},email:{value:'test@example.com'}};
const phone={value:'078123456',setCustomValidity(){},setAttribute(){},addEventListener(){}},status={textContent:''},error={textContent:''},button={disabled:false};
const form={elements:fields,querySelector:()=>button,reportValidity:()=>true,addEventListener:(event,callback)=>{if(event==='submit')submit=callback;}};
const state=new Map();let fail=true;
const regContext={document:{getElementById:id=>({'registration-form':form,phone,'phone-error':error,'form-status':status}[id])},sessionStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)},STP_API:{phone:api.phone,randomToken:api.randomToken,rpc:async(name,args)=>{attempts.push(args);if(fail)throw new Error('Lost response');return 'created-id';}},window:{location:{assign:p=>destination=p}}};
vm.runInNewContext(source('register'),regContext);await submit({preventDefault(){}});assert.equal(destination,undefined);
fail=false;await submit({preventDefault(){}});assert.equal(attempts[0].r_token,attempts[1].r_token);assert.equal(destination,'Skills_That_Pay_Survey_Page_1.html');passed++;
console.log(`${passed} frontend scenarios passed: phone formats, token randomness, authenticated access, session refresh, pagination, failure handling, database-gated survey success, registration retry.`);

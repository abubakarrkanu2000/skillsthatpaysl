'use strict';
window.AcademyAPI=(()=>{
 const cfg=window.STP_CONFIG;
 let operational=true;
 const ready=()=>Boolean(operational&&cfg.supabaseUrl&&cfg.supabaseAnonKey);
 async function request(path,body,accessToken){
  if(!ready())throw new Error('Registration is not open yet. Please check back soon.');
  const response=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+path,{method:'POST',headers:{apikey:cfg.supabaseAnonKey,'Content-Type':'application/json',...(accessToken?{Authorization:'Bearer '+accessToken}:{})},signal:AbortSignal.timeout(20000),body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.message||data.error_description||'Unable to connect. Please try again.');error.status=response.status;throw error;}
  return data;
 }
 async function uploadReceipt(path,file){
  if(!ready())throw new Error('Website uploads are not available yet.');
  const response=await fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/storage/v1/object/academy-receipts/'+path,{method:'POST',headers:{apikey:cfg.supabaseAnonKey,'Content-Type':file.type,'x-upsert':'false'},signal:AbortSignal.timeout(60000),body:file});
  if(!response.ok)throw new Error('Could not store your receipt. Please try again.');
 }
 async function receiptUrl(path,token){
  const result=await request('/storage/v1/object/sign/academy-receipts/'+path,{expiresIn:120},token);
  const signed=result.signedURL||result.signedUrl;
  if(!signed)throw new Error('Receipt is unavailable.');
  return new URL(signed.startsWith('/object/')?'/storage/v1'+signed:signed,cfg.supabaseUrl).href;
 }
 return {ready,setOperational:value=>{operational=value;},uploadReceipt,receiptUrl,rpc:(name,args={},token)=>request('/rest/v1/rpc/'+name,args,token),login:(email,password)=>request('/auth/v1/token?grant_type=password',{email,password}),logout:token=>request('/auth/v1/logout',{},token)};
})();

/* Anonymous browser/session counts. Never send names, contact details or survey text. */
window.STP_ANALYTICS=(()=>{
 let visitor,session,page,question,source;
 try{
  visitor=localStorage.getItem('stp-visitor-id')||crypto.randomUUID();localStorage.setItem('stp-visitor-id',visitor);
  let state=JSON.parse(sessionStorage.getItem('stp-visit')||'null');
  if(!state||Date.now()-state.last>30*60*1000){
   const campaign=(new URLSearchParams(location.search).get('utm_source')||'').toLowerCase();
   let host='';try{host=new URL(document.referrer).hostname;}catch{}
   source=['instagram','whatsapp','facebook','google'].includes(campaign)?campaign:campaign?'other':host.includes('instagram')?'instagram':host==='wa.me'||host.includes('whatsapp')?'whatsapp':host.includes('facebook')?'facebook':host.includes('google')?'google':host&&host!==location.hostname?'other':'direct';
   state={id:crypto.randomUUID(),source,last:Date.now()};
  }
  state.last=Date.now();sessionStorage.setItem('stp-visit',JSON.stringify(state));session=state.id;source=state.source;
  question=Number(document.body.dataset.question)||0;
  const file=location.pathname.split('/').pop();page=question===9?'complete':question?'survey':file==='register.html'||file==='register'?'registration':'home';
 }catch{return {track(){}};}
 function track(event){
  const cfg=window.STP_CONFIG;if(!cfg?.supabaseUrl||!cfg.supabasePublicKey)return;
  const key=`stp-event:${session}:${event}:${page}:${question}`;
  try{if(sessionStorage.getItem(key))return;}catch{}
  fetch(cfg.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/stp_track',{
   method:'POST',headers:{apikey:cfg.supabasePublicKey,'Content-Type':'application/json'},keepalive:true,
   body:JSON.stringify({r_visitor:visitor,r_session:session,r_event:event,r_page:page,r_question:question===9?0:question,r_source:source})
  }).then(r=>{if(r.ok)try{sessionStorage.setItem(key,'1');}catch{}}).catch(()=>{});
 }
 track('page_view');if(page==='registration')track('registration_start');if(page==='survey')track('question_view');
 document.addEventListener('click',event=>{const a=event.target.closest('a[href]');if(a&&/register(?:\.html)?(?:$|[?#])/.test(a.getAttribute('href')))track('registration_start');});
 return {track};
})();

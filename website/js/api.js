/* Supabase REST client. Private records require an authenticated allowlisted admin. */
window.STP_API = (() => {
  const authKey='stp-admin-session';
  let refreshing=null;
  function config() {
    const c=window.STP_CONFIG;
    if(!c?.supabaseUrl||!c.supabasePublicKey) throw new Error('The registration system is not connected yet. Please try again later.');
    if(c.supabasePublicKey.startsWith('sb_secret_')) throw new Error('Use a public Supabase key in the website settings.');
    return {...c,supabaseUrl:c.supabaseUrl.replace(/\/$/,'')};
  }
  function session() { try{return JSON.parse(sessionStorage.getItem(authKey)||'null');}catch{return null;} }
  function saveSession(s) { sessionStorage.setItem(authKey,JSON.stringify({...s,expires_at:Math.floor(Date.now()/1000)+(s.expires_in||3600)})); }
  async function request(path,body,token,method='POST') {
    const c=config(),headers={apikey:c.supabasePublicKey,'Content-Type':'application/json'};
    if(token)headers.Authorization=`Bearer ${token}`;
    const response=await fetch(c.supabaseUrl+path,{method,headers,body:method==='GET'?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      const e=new Error(data?.message||data?.msg||data?.error_description||'Could not complete this request. Please try again.');e.status=response.status;e.code=data?.code;throw e;
    }
    return data;
  }
  async function adminToken() {
    let s=session();if(!s)throw new Error('Please sign in to the admin dashboard.');
    if(s.expires_at<Math.floor(Date.now()/1000)+60){
      if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token}).then(data=>{saveSession(data);return data;}).catch(e=>{sessionStorage.removeItem(authKey);throw e;}).finally(()=>{refreshing=null;});
      s=await refreshing;
    }
    return s.access_token;
  }
  async function rpc(name,args={},admin=false) { return request('/rest/v1/rpc/'+name,args,admin?await adminToken():null); }
  async function login(email,password) {
    const s=await request('/auth/v1/token?grant_type=password',{email,password});saveSession(s);
    try{if(!await rpc('stp_is_admin',{},true))throw new Error('This account does not have admin access.');}catch(e){await logout();throw e;}
  }
  async function logout() {
    const s=session();try{if(s)await request('/auth/v1/logout',{},s.access_token);}finally{sessionStorage.removeItem(authKey);}
  }
  async function list(table) {
    const token=await adminToken(),all=[];
    // Pagination prevents the default API row limit from hiding registrations.
    for(let offset=0;;offset+=500){
      const batch=await request(`/rest/v1/${table}?select=*&order=${table==='stp_settings'?'id':'created_at'}.desc&limit=500&offset=${offset}`,null,token,'GET');
      all.push(...batch);if(batch.length<500)return all;
    }
  }
  function phone(raw) {
    const compact=raw.trim().replace(/[\s()-]/g,'');
    const match=compact.match(/^(?:\+232|00232|232)?0?((?:25|30|31|32|33|34|35|70|72|73|74|75|76|77|78|79|88)[0-9]{6})$/);
    return match?'+232'+match[1]:null;
  }
  function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  return {rpc,login,logout,list,session,phone,randomToken};
})();


    // Live admin view. Database policies and functions enforce access and seat rules.
    let attendees=[];
    let settings=null;
    const statuses=['Ready for review','Survey incomplete','Offered','Confirmed','Waitlisted','Not selected','Declined','Offer expired','Cancelled','Attended'];
    const search=document.getElementById('search'), statusFilter=document.getElementById('status-filter'), skillFilter=document.getElementById('skill-filter');
    const dialog=document.getElementById('profile');
    let activeId=null;
    const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function filtered() { const query=search.value.trim().toLowerCase(); return attendees.filter(a=>(!query||[a.name,a.email,a.phone,a.number].some(v=>v.toLowerCase().includes(query)))&&(!statusFilter.value||a.status===statusFilter.value)&&(!skillFilter.value||a.skill===skillFilter.value)); }
    function render() {
      document.getElementById('total').textContent=attendees.length;
      document.getElementById('complete').textContent=attendees.filter(a=>a.complete).length;
      document.getElementById('confirmed').textContent=attendees.filter(a=>['Confirmed','Attended'].includes(a.status)).length;
      if(settings){const occupied=type=>attendees.filter(a=>a.type===type&&['Confirmed','Attended'].includes(a.status)).length;document.getElementById('seat-summary').textContent=`Public ${occupied('Public')}/${settings.public_capacity} · Reserved ${occupied('Reserved')}/${settings.reserved_capacity}`;}
      document.getElementById('waitlisted').textContent=attendees.filter(a=>a.status==='Waitlisted').length;
      const list=filtered();
      document.getElementById('count').textContent=`${list.length} of ${attendees.length} shown`;
      document.getElementById('empty').hidden=Boolean(list.length);
      document.getElementById('rows').innerHTML=list.map(a=>`<tr><td class="person">${escape(a.name)}<span class="secondary">${escape(a.email||'No email provided')} · ${escape(a.type)}${a.manual?' · Added by admin':''}</span></td><td>${escape(a.skill||'Not answered')}</td><td><span class="badge ${a.complete||a.manual?'':'incomplete'}">${a.manual?'Not required':a.complete?'Complete':'Incomplete'}</span></td><td><span class="badge ${a.status==='Confirmed'?'confirmed':a.status==='Waitlisted'?'waitlisted':a.status==='Offered'?'offered':''}">${escape(a.status)}</span></td><td>${escape(a.number||'—')}</td><td><button class="view" data-id="${a.id}" aria-label="View ${escape(a.name)}">View →</button>${a.status==='Confirmed'?` <button class="view" data-checkin="${a.id}">Check in</button>`:''}</td></tr>`).join('');
    }
    function openProfile(id) {
      const a=attendees.find(a=>a.id===id); activeId=id;
      document.getElementById('profile-name').textContent=a.name;
      const fields=[['Email',a.email],['WhatsApp number',a.phone],['Guest type',a.type],['Registration source',a.manual?'Added by admin':'Website registration'],['Survey',a.manual?'Not required — directly invited guest':a.complete?'Complete':'Incomplete'],['Attendance number',a.number||'No active number'],['Notes',a.notes],['Other current situation',a.other.current_situation_other],['Other skill interest',a.other.skill_interest_other],['Other obstacle',a.other.biggest_obstacle_other],['Age',a.age],['Current situation',a.situation],['Skill interest',a.skill],['Income from a skill',a.income],['Biggest obstacle',a.obstacle],['Goal for the next 3–6 months',a.goal],['Future training investment · research only',a.investment],['Expert requested for the next event',a.expert]];
      document.getElementById('details').innerHTML=fields.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value||'Not provided')}</dd>`).join('');
      document.getElementById('profile-status').innerHTML=statuses.map(s=>`<option ${s===a.status?'selected':''}>${escape(s)}</option>`).join('');
      document.getElementById('profile-notice').textContent='Cancelled removes the number from active use and frees the seat. The original number remains internally and is restored if this same guest is confirmed again.';
      populateSurveyEditor(a);
      if (!dialog.open) dialog.showModal();
    }
    [search,statusFilter,skillFilter].forEach(el=>el.addEventListener('input',render));
    document.getElementById('rows').addEventListener('click',async event=>{
      const button=event.target.closest('button[data-id]');if(button)openProfile(button.dataset.id);
      const checkin=event.target.closest('button[data-checkin]');if(!checkin)return;
      checkin.disabled=true;
      try{await STP_API.rpc('stp_admin_status',{r_id:checkin.dataset.checkin,r_status:'Attended'},true);await load();document.getElementById('notice').textContent='Attendance recorded.';}
      catch(error){document.getElementById('notice').textContent=error.message;checkin.disabled=false;}
    });
    document.getElementById('close').addEventListener('click',()=>dialog.close());
    document.getElementById('save').addEventListener('click',async()=>{
      const button=document.getElementById('save');button.disabled=true;
      try{
        await STP_API.rpc('stp_admin_status',{r_id:activeId,r_status:document.getElementById('profile-status').value},true);
        await load();dialog.close();document.getElementById('notice').textContent='Attendance status saved.';
      }catch(error){document.getElementById('profile-notice').textContent=error.message;}
      finally{button.disabled=false;}
    });
    document.getElementById('export').addEventListener('click',()=>{
      // Prefix formula-like cells to keep CSV exports safe in spreadsheet apps.
      const cell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
      const rows=[['Name','Email','Phone','Skill','Survey','Status','Attendance number','Guest type','Source','Notes','Age','Current situation','Skill income','Biggest obstacle','Goal','Future training investment','Requested expert','Other situation','Other skill','Other obstacle'],...filtered().map(a=>[a.name,a.email,a.phone,a.skill,a.manual?'Not required':a.complete?'Complete':'Incomplete',a.status,a.number,a.type,a.manual?'Added by admin':'Website registration',a.notes||'',a.age||'',a.situation||'',a.income||'',a.obstacle||'',a.goal||'',a.investment||'',a.expert||'',a.other.current_situation_other||'',a.other.skill_interest_other||'',a.other.biggest_obstacle_other||''])];
      const csv='\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='STP_attendees.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      document.getElementById('notice').textContent=`Exported ${filtered().length} records.`;
    });
    const guestDialog=document.getElementById('guest-dialog'), guestForm=document.getElementById('guest-form');
    let guestRequestId=null;
    const guestPhone=document.getElementById('guest-phone');
    function normaliseGuestPhone(value) {
      const compact=value.trim().replace(/[\s()-]/g,'');
      const match=compact.match(/^(?:\+232|00232|232)?0?((?:25|30|31|32|33|34|35|70|72|73|74|75|76|77|78|79|88)[0-9]{6})$/);
      return match?'+232'+match[1]:null;
    }
    function validateGuestPhone() {
      const error=guestPhone.value.trim()&&!normaliseGuestPhone(guestPhone.value)?'Enter a Sierra Leone mobile number, such as 078 123456. Check the prefix and number of digits.':'';
      guestPhone.setCustomValidity(error);document.getElementById('guest-phone-error').textContent=error;
      return !error;
    }
    guestPhone.addEventListener('input',validateGuestPhone);
    document.getElementById('add-guest').addEventListener('click',()=>{guestRequestId=crypto.randomUUID();guestForm.reset();guestPhone.setCustomValidity('');document.getElementById('guest-phone-error').textContent='';document.getElementById('guest-error').textContent='';guestDialog.showModal();});
    document.getElementById('close-guest').addEventListener('click',()=>guestDialog.close());
    guestForm.addEventListener('submit',async event=>{
      event.preventDefault();if(!validateGuestPhone()||!guestForm.reportValidity())return;
      const fields=new FormData(guestForm),name=fields.get('name').trim(),email=fields.get('email').trim(),phone=guestPhone.value.trim()?normaliseGuestPhone(guestPhone.value):'';
      if(name.length<2){document.getElementById('guest-error').textContent='Please enter the guest’s full name.';return;}
      const button=guestForm.querySelector('button[type="submit"]');button.disabled=true;
      try{
        await STP_API.rpc('stp_admin_add_guest',{r_full_name:name,r_email:email,r_phone:phone,r_guest_type:fields.get('type'),r_status:fields.get('status'),r_notes:fields.get('notes').trim(),r_request_id:guestRequestId},true);
        search.value='';statusFilter.value='';skillFilter.value='';await load();guestDialog.close();document.getElementById('notice').textContent=`${name} added. Website registration and survey are not required.`;
      }catch(error){document.getElementById('guest-error').textContent=error.message;}
      finally{button.disabled=false;}
    });

    function normalise(record){const a=record.answers||{};return {id:record.id,name:record.full_name,email:record.email||'',phone:record.phone||'',type:record.guest_type,status:record.status,notes:record.notes,manual:record.source==='Admin',complete:record.survey_complete,number:['Confirmed','Attended'].includes(record.status)?record.attendance_number||'':'',historicalNumber:record.attendance_number||'',age:a.age,situation:a.current_situation,skill:a.skill_interest||'',income:a.skill_income,obstacle:a.biggest_obstacle,goal:a.goal,investment:a.future_investment,expert:a.next_expert,other:a,rawAnswers:record.answers};}
    async function load(){
      const [records,configuration]=await Promise.all([STP_API.list('stp_registrations'),STP_API.list('stp_settings')]);
      attendees=records.map(normalise);settings=configuration[0];render();
      document.getElementById('registration-state').textContent=settings.registration_open?'Registration is open':'Registration is closed';
      document.getElementById('toggle-registration').textContent=settings.registration_open?'Close registration':'Open registration';
await loadAnalytics();
    }
    const loginPanel=document.getElementById('login-panel'),app=document.getElementById('admin-app'),loginForm=document.getElementById('login-form');
    async function openAdmin(){
      if(!await STP_API.rpc('stp_is_admin',{},true))throw new Error('This account does not have admin access.');
      await load();loginPanel.hidden=true;app.hidden=false;document.getElementById('logout').hidden=false;
    }
    loginForm.addEventListener('submit',async event=>{
      event.preventDefault();const button=loginForm.querySelector('button');button.disabled=true;document.getElementById('login-status').textContent='Signing in…';
      try{await STP_API.login(loginForm.elements.email.value.trim(),loginForm.elements.password.value);await openAdmin();loginForm.elements.password.value='';document.getElementById('login-status').textContent='';}
      catch(error){document.getElementById('login-status').textContent=error.message;}
      finally{button.disabled=false;}
    });
    document.getElementById('logout').addEventListener('click',async()=>{
      try{await STP_API.logout();}catch{}finally{attendees=[];render();app.hidden=true;loginPanel.hidden=false;document.getElementById('logout').hidden=true;dialog.close();guestDialog.close();document.getElementById('notice').textContent='';}
    });
    document.getElementById('refresh').addEventListener('click',async()=>{try{await load();document.getElementById('notice').textContent='Records refreshed.';}catch(error){document.getElementById('notice').textContent=error.message;}});
    document.getElementById('toggle-registration').addEventListener('click',async()=>{
      const button=document.getElementById('toggle-registration');button.disabled=true;
      try{await STP_API.rpc('stp_admin_registration_open',{r_open:!settings.registration_open},true);await load();}
      catch(error){document.getElementById('notice').textContent=error.message;}
      finally{button.disabled=false;}
    });
    if(STP_API.session())openAdmin().catch(error=>{document.getElementById('login-status').textContent=error.message;});

async function loadAnalytics(){
 const status=document.getElementById('analytics-status');
 try{
  const a=await STP_API.rpc('stp_analytics_report',{r_days:Number(document.getElementById('analytics-range').value)},true);
  document.getElementById('analytics-counts').innerHTML=[['Estimated visitors',a.visitors],['Visits',a.visits],['Registration starts',a.started],['Details saved',a.saved],['Surveys submitted',a.completed],['Visits with errors',a.errors]].map(([label,value])=>`<div class="stat"><p>${label}</p><strong>${value}</strong></div>`).join('');
  document.getElementById('analytics-steps').innerHTML=a.questions.map(q=>`<tr><td>Question ${q.question}</td><td>${q.viewed}</td><td>${q.continued}</td><td>${q.pending}</td></tr>`).join('');
  document.getElementById('analytics-sources').textContent=a.sources.length?a.sources.map(s=>`${s.source}: ${s.visits} visits`).join(' · '):'No traffic recorded yet.';
  status.textContent='Tracking starts after installation. Visitors are estimated browsers. No next step yet includes people still completing the survey.';
 }catch(e){status.textContent='Analytics unavailable. Run backend/analytics-update.sql in Supabase and refresh. Registration management still works.';}
}
document.getElementById('analytics-range').addEventListener('change',loadAnalytics);

// Admin-assisted survey entry. Status changes remain a separate action.
const surveyEditForm = document.getElementById('survey-edit-form');
const surveyAnswerKeys = ['age', 'current_situation', 'skill_interest', 'skill_income', 'biggest_obstacle', 'goal', 'future_investment', 'next_expert'];
let surveyOriginalAnswers = null;
function updateSurveyOtherFields() {
  for (const box of surveyEditForm.querySelectorAll('[data-other-for]')) {
    const selected = surveyEditForm.elements.namedItem(box.dataset.otherFor).value === 'Other';
    box.hidden = !selected;
    box.querySelector('input').disabled = !selected;
  }
}
function populateSurveyEditor(attendee) {
  surveyEditForm.reset();
  surveyOriginalAnswers = attendee.rawAnswers;
  const answers = attendee.rawAnswers || {};
  for (const field of surveyEditForm.elements) {
    if (field.name) field.value = answers[field.name] ?? '';
  }
  updateSurveyOtherFields();
  document.getElementById('survey-editor').open = false;
  document.getElementById('survey-edit-notice').textContent = '';
}
surveyEditForm.addEventListener('change', updateSurveyOtherFields);
surveyEditForm.addEventListener('submit', async event => {
  event.preventDefault();
  const complete = event.submitter?.value === 'complete';
  const values = new FormData(surveyEditForm);
  const answers = {};
  for (const key of surveyAnswerKeys) {
    const value = String(values.get(key) ?? '').trim();
    if (value) answers[key] = key === 'age' ? Number(value) : value;
    if (value === 'Other') answers[key + '_other'] = String(values.get(key + '_other') ?? '').trim();
  }
  if (complete && surveyAnswerKeys.some(key => !String(answers[key] ?? '').trim() ||
      (answers[key] === 'Other' && !answers[key + '_other']))) {
    document.getElementById('survey-edit-notice').textContent = 'Answer all eight questions, including any Other descriptions, before marking complete.';
    return;
  }
  const buttons = [...surveyEditForm.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  document.getElementById('save').disabled = true;
  document.getElementById('close').disabled = true;
  const id = activeId;
  let saved = false;
  try {
    const record = await STP_API.rpc('stp_admin_save_survey', {
      r_id: id, r_answers: answers, r_complete: complete,
      r_expected_answers: surveyOriginalAnswers
    }, true);
    saved = true;
    const updated = normalise(record);
    attendees = attendees.map(attendee => attendee.id === id ? updated : attendee);
    render();
    openProfile(id);
    document.getElementById('survey-editor').open = true;
    document.getElementById('survey-edit-notice').textContent = complete ? 'Survey saved and marked complete. Attendance status was preserved unless it was Survey incomplete.' : 'Draft answers saved. The survey remains incomplete; attendance status is preserved.';
  } catch (error) {
    document.getElementById('survey-edit-notice').textContent = saved ? 'Answers were saved. Refresh the dashboard to see the updated record.' : error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    document.getElementById('save').disabled = false;
    document.getElementById('close').disabled = false;
  }
});

(() => {
  const form=document.getElementById('registration-form'),phone=document.getElementById('phone'),error=document.getElementById('phone-error'),status=document.getElementById('form-status'),button=form.querySelector('button');
  function validate(){const message=STP_API.phone(phone.value)?'':'Enter a Sierra Leone mobile number, such as 078 123456. Use 9 digits with the first 0, or 8 without it.';phone.setCustomValidity(message);phone.setAttribute('aria-invalid',String(Boolean(message)));error.textContent=message;return !message;}
  phone.addEventListener('input',()=>{validate();status.textContent='';});
  phone.addEventListener('invalid',validate);
  try{const details=JSON.parse(sessionStorage.getItem('stp-registration')||'null');if(details){form.elements.full_name.value=details.full_name;form.elements.email.value=details.email;phone.value=details.phone;}}catch{}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!validate()||!form.reportValidity())return;
    const details={full_name:form.elements.full_name.value.trim(),email:form.elements.email.value.trim(),phone:STP_API.phone(phone.value)};
    if(details.full_name.length<2){status.textContent='Please enter your full name.';return;}
    button.disabled=true;status.textContent='Saving your registration…';
    try{
      const saved=JSON.parse(sessionStorage.getItem('stp-registration')||'null');
      let draft=JSON.parse(sessionStorage.getItem('stp-registration-draft')||'null');
      if(saved?.id){
        if(['full_name','email','phone'].some(k=>saved[k]!==details[k]))throw new Error('Your registration has already been saved. Contact the team to change your contact details.');
        window.location.assign('Skills_That_Pay_Survey_Page_1.html');return;
      }
      if(!draft||['full_name','email','phone'].some(k=>draft[k]!==details[k]))draft={...details,token:STP_API.randomToken()};
      sessionStorage.setItem('stp-registration-draft',JSON.stringify(draft));
      const id=await STP_API.rpc('stp_register',{r_full_name:details.full_name,r_email:details.email,r_phone:details.phone,r_token:draft.token});
      sessionStorage.setItem('stp-registration',JSON.stringify({...draft,id}));
      sessionStorage.removeItem('stp-registration-draft');
window.STP_ANALYTICS?.track('registration_saved');
      window.location.assign('Skills_That_Pay_Survey_Page_1.html');
    }catch(e){window.STP_ANALYTICS?.track('registration_error');status.textContent=e.message||'We couldn’t save your registration. Please try again.';button.disabled=false;}
  });
})();

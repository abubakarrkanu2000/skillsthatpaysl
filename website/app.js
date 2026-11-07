'use strict';
const config={...window.STP_CONFIG};
let databaseConnection=null;let publicProducts=[];
const campuses=[
 {name:'Design',image:'design',intro:'Build your creative foundations with graphic design tools and practical projects.',topics:['Adobe Photoshop','Adobe Illustrator','Canva']},
 {name:'Marketing',image:'marketing',intro:'Learn how to communicate value and reach the right customers.',topics:['Branding foundations','Organic marketing','Paid marketing']},
 {name:'Technology',image:'technology',intro:'Explore the tools and thinking behind useful digital experiences.',topics:['Introduction to web design','Website planning','Technology and IT foundations']},
 {name:'Creative Media',image:'creative-media',intro:'Tell stories through images, video and thoughtful editing.',topics:['Photography','Videography','Editing and visual storytelling']},
 {name:'Business',image:'business',intro:'Explore how to turn a useful idea into an offer people understand.',topics:['Starting a business','Customer needs','Sales and business growth']},
 {name:'Financial Markets',image:'financial-markets',intro:'Understand market fundamentals and develop a responsible approach to learning.',topics:['Introduction to financial markets','Market terminology','Risk awareness']}
];
const modal=document.getElementById('modal');
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const campusCards=()=>campuses.map((c,i)=>`<button class="course campus-card" style="--i:${i}" data-campus="${i}" aria-label="Explore ${c.name} Campus"><img src="assets/images/${c.image}.png" alt="${c.name} Campus" loading="lazy" width="950" height="1656"></button>`).join('');
for(const id of ['homeCourses','allCourses'])document.getElementById(id).innerHTML=campusCards();
document.addEventListener('click',e=>{const card=e.target.closest('[data-campus]');if(card)coursePreview(Number(card.dataset.campus));});
const pages=['home','courses','live'];
function go(page,update=true){
 if(!pages.includes(page))page='home';
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden',p.id!==page));
 if(update&&location.hash!=='#'+page)history.pushState(null,'','#'+page);
 document.querySelectorAll('header nav a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=({home:'Skills That Pay Academy',courses:'Our Campuses',live:'Live Graphic Design Classes'})[page]+' | STP';
 window.scrollTo(0,0);
}
function homeAnchor(id,update=true){go('home',false);if(update&&location.hash!=='#'+id)history.pushState(null,'','#'+id);document.getElementById(id)?.scrollIntoView();}
function route(){const id=location.hash.slice(1);if(id==='payment'||id.startsWith('payment=')){go('home',false);showSavedPayment();return;}if(['learn','story'].includes(id))homeAnchor(id,false);else go(id||'home',false);}
window.addEventListener('popstate',route);
window.addEventListener('hashchange',route);
// Inline navigation is intercepted once so native hash changes cannot undo section scrolling.
document.querySelectorAll('a[href^="#"]').forEach(a=>{a.removeAttribute('onclick');a.addEventListener('click',e=>{e.preventDefault();const id=a.hash.slice(1);if(id==='payment'){showSavedPayment();return;}if(['learn','story'].includes(id))homeAnchor(id);else go(id);});});
function showModal(html){document.getElementById('modalBody').innerHTML=html;if(!modal.open)modal.showModal();modal.scrollTop=0;}
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function coursePreview(i){const c=campuses[i];showModal(`<div class="campus-modal"><img src="assets/images/${c.image}.png" alt="${c.name} Campus"><div><p class="eyebrow">EXPLORE YOUR DIRECTION</p><h2>${c.name} Campus</h2><p>${c.intro}</p></div></div><ul>${c.topics.map(t=>`<li>${t}</li>`).join('')}</ul><p class="micro">Campus learning areas · Detailed course availability will be confirmed before launch.</p><div class="review-total"><span>Online Academy · 7 January 2027</span><b>NLe ${config.onlineMonthlyPrice} / month</b></div><button class="button gold" onclick="checkout('online')">Explore membership ↗</button>`);}
const draftKey='stp-academy-enrolment-v1';
let purchase={type:'online',time:'',name:'',phone:'',email:''};
try{const saved=JSON.parse(localStorage.getItem(draftKey));if(saved&&typeof saved==='object')for(const key of ['name','phone','email'])if(typeof saved[key]==='string')purchase[key]=saved[key].slice(0,254);}catch{}
function saveDraft(){for(const key of ['name','phone','email']){const input=document.getElementById('learner'+key[0].toUpperCase()+key.slice(1));if(input)purchase[key]=input.value;}try{localStorage.setItem(draftKey,JSON.stringify({name:purchase.name,phone:purchase.phone,email:purchase.email}));}catch{}}
function checkout(type,time=''){
 if(databaseConnection){showModal('<h2>Loading registration details…</h2>');databaseConnection.then(()=>checkout(type,time));return;}
 saveDraft();purchase.type=type==='live'?'live':'online';purchase.time=time;
 const live=purchase.type==='live';
 showModal(`<p class="eyebrow">${live?'LIVE DESIGN CLASSES':'ONLINE ACADEMY'}</p><h2>Your next step starts here.</h2><p>${live?'Four weeks · 12 sessions · '+escapeHtml(time)+' · Five places per group':'All online courses · Intake capacity: '+config.onlineCapacity}</p><p>Courses launch 7 January 2027.</p><div class="review-total"><span>${live?'Full programme':'Monthly membership'}</span><b>NLe ${live?config.liveProgrammePrice:config.onlineMonthlyPrice+' / month'}</b></div><form id="enrolmentForm"><label for="learnerName">Full name</label><input id="learnerName" name="name" autocomplete="name" required maxlength="100" value="${escapeHtml(purchase.name)}"><label for="learnerPhone">WhatsApp number</label><input id="learnerPhone" name="phone" autocomplete="tel" type="tel" required maxlength="24" placeholder="076 123456 or +232 76 123456" value="${escapeHtml(purchase.phone)}"><label for="learnerEmail">Email address</label><input id="learnerEmail" name="email" autocomplete="email" type="email" required maxlength="254" value="${escapeHtml(purchase.email)}"><p id="formError" role="alert"></p><button class="button gold" type="submit">Review my selection ↗</button><p class="micro">Your details are saved in this browser so you can continue later. <button class="textbutton" type="button" onclick="clearDraft()">Clear saved details</button></p></form><p class="notice">Payment is by Orange Money. Your place is confirmed after we verify your transfer. Reviewing your selection does not charge you.</p>`);
 const form=document.getElementById('enrolmentForm');form.addEventListener('input',e=>{e.target.setCustomValidity('');saveDraft();});form.addEventListener('submit',reviewPurchase);
}
function clearDraft(){purchase.name=purchase.phone=purchase.email='';try{localStorage.removeItem(draftKey);}catch{}for(const input of document.querySelectorAll('#enrolmentForm input'))input.value='';}
function normalizePhone(value){const raw=value.trim();if(!/^[+\d\s()-]+$/.test(raw))return null;let digits=raw.replace(/\D/g,'');if(digits.startsWith('00232'))digits=digits.slice(2);if(digits.startsWith('232'))digits=digits.slice(3);if(digits.startsWith('0'))digits=digits.slice(1);return /^[1-9]\d{7}$/.test(digits)?'+232'+digits:null;}
function reviewPurchase(e){e.preventDefault();saveDraft();const name=document.getElementById('learnerName');const phone=document.getElementById('learnerPhone');const email=document.getElementById('learnerEmail');name.value=name.value.trim();email.value=email.value.trim();if(!name.value){name.setCustomValidity('Please enter your name.');name.reportValidity();return;}const normalized=normalizePhone(phone.value);if(!normalized){phone.setCustomValidity('Enter a valid Sierra Leone number, such as 076 123456 or +232 76 123456.');phone.reportValidity();return;}if(!e.target.reportValidity())return;purchase.name=name.value;purchase.email=email.value;purchase.normalizedPhone=normalized;saveDraft();renderReview();}
function renderReview(){const live=purchase.type==='live';showModal(`<p class="eyebrow">REVIEW YOUR SELECTION</p><h2>${live?'Live Design Programme':'Online Academy Membership'}</h2><p>${escapeHtml(purchase.name)}<br>${escapeHtml(purchase.normalizedPhone)}<br>${escapeHtml(purchase.email)}</p><p>Starts 7 January 2027${live?'<br>Class time: '+escapeHtml(purchase.time):'<br>All online courses included'}</p><div class="review-total"><span>${live?'Programme price':'Monthly price'}</span><b>NLe ${live?config.liveProgrammePrice:config.onlineMonthlyPrice}</b></div><p>Pay by Orange Money, then send your receipt on WhatsApp. We will verify your payment within 24 hours of receiving it.</p>${!AcademyAPI.ready()?'<p class="notice">Send your receipt on WhatsApp for manual confirmation.</p>':''}<p id="checkoutError" role="alert"></p><button id="payButton" class="button gold" onclick="startPayment()" >Continue to Orange Money ↗</button> <button class="button outline" onclick="checkout(purchase.type,purchase.time)">← Edit details</button>`);}
let submitting=false;
const paymentStore='stp-academy-payment-v1';
let currentPayment=null;
function readPayment(){try{return JSON.parse(localStorage.getItem(paymentStore));}catch{return null;}}
function savePayment(record){currentPayment=record;try{localStorage.setItem(paymentStore,JSON.stringify(record));}catch{}}
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
async function startPayment(){
 if(submitting)return;
 if(databaseConnection)await databaseConnection;
 if(!AcademyAPI.ready()){startWhatsAppPayment();return;}
 submitting=true;const button=document.getElementById('payButton');button.disabled=true;button.textContent='Saving your registration…';
 try{
  const product=purchase.type==='live'?'live-design':'online-monthly';
  const fingerprint=JSON.stringify([product,purchase.time,purchase.name,purchase.normalizedPhone,purchase.email]);
  let saved=readPayment();
  if(saved&&saved.fingerprint!==fingerprint){throw new Error('You already have a saved registration. Open Payment status to check it before creating another.');}
  if(!saved){saved={token:newToken(),fingerprint};savePayment(saved);}
  const order=await AcademyAPI.rpc('academy_create_order',{p_token:saved.token,p_product:product,p_group:purchase.time||null,p_name:purchase.name,p_phone:purchase.normalizedPhone,p_email:purchase.email});
  savePayment({...saved,order});showPayment(order,saved.token);
 }catch(error){const target=document.getElementById('checkoutError');if(target)target.textContent=error.message;button.disabled=false;button.textContent='Continue to Orange Money ↗';}finally{submitting=false;}
}
function statusLink(token){return location.href.split('#')[0]+'#payment='+token;}
function showPayment(order,token){
 const confirmed=order.status==='confirmed',pending=order.status==='pending';
 const names={unpaid:'Ready for payment',pending:'Awaiting payment verification',confirmed:'Payment confirmed',needs_review:'Payment needs attention',cancelled:'Registration cancelled'};
 const link=statusLink(token);
 const message=`Hello Skills That Pay, my name is ${order.name}. Order: ${order.reference}. Amount: NLe ${order.amount}. I have attached my Orange Money receipt. Please confirm my payment. My private status link: ${link}`;
 const whatsapp='https://wa.me/'+config.whatsappNumber+'?text='+encodeURIComponent(message);
 showModal(`<p class="eyebrow">${escapeHtml(order.reference)}</p><h2>${names[order.status]||'Payment status'}</h2><div class="payment-state ${confirmed?'verified':''}" role="status">${confirmed?'✓ Payment verified by our team':pending?'◷ Your payment is awaiting verification':'Orange Money · Manual verification'}</div><p>${escapeHtml(order.name)} · ${escapeHtml(order.product==='live-design'?'Live Design Programme':'Online Academy Membership')}</p><div class="review-total"><span>${confirmed?'Amount confirmed':'Amount to send'}</span><b>NLe ${order.amount}</b></div>${confirmed?`<p>Thank you. Your payment has been confirmed${order.confirmed_at?' on '+escapeHtml(new Date(order.confirmed_at).toLocaleDateString()):''}.</p><p>Keep this page to check your registration. Courses launch 7 January 2027.</p>`:order.status==='cancelled'?'<p>Please contact us before making a payment.</p>':`<ol class="payment-steps"><li>Send <b>NLe ${order.amount}</b> by Orange Money to <b>${config.orangeMoneyNumber}</b>.</li><li>Tap the WhatsApp button. Your name, order reference and amount are filled in. <b>Attach your Orange Money receipt</b> and send the message.</li><li>Return here and tap “I have sent my receipt”.</li></ol><p class="micro">If you paid from another number, include that number in your WhatsApp message. Check the recipient details in Orange Money before confirming your transfer.</p>${order.public_note?'<p class="notice">'+escapeHtml(order.public_note)+'</p>':''}<a class="button gold" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Send receipt on WhatsApp ↗</a>${order.status!=='pending'?'<button class="button outline" onclick="markReceiptSent()">I have sent my receipt</button>':''}<p class="notice">${pending?'Please wait. Your payment will be confirmed within the next 24 hours after we receive and verify your receipt.':'Sending a message or marking a receipt as sent does not confirm payment. We check the Orange Money transaction before confirming.'}</p>`}<div class="status-tools"><button class="textbutton" onclick="showSavedPayment()">Refresh payment status ↻</button><button class="textbutton" onclick="copyStatusLink()">Copy my private status link</button></div><p class="micro">This browser remembers your registration. Save your private link to check from another device. Anyone with this link can view this registration, so keep it private.</p><p id="paymentFeedback" role="status"></p>`);
 savePayment({...readPayment(),token,order});
 attachReceiptPanel(order);
}
async function showSavedPayment(){
 const fromHash=location.hash.startsWith('#payment=')?location.hash.slice(9):null;
 const saved=readPayment();if(saved?.mode==='whatsapp'&&!fromHash){showWhatsAppPayment(saved);return;}const token=fromHash||saved?.token;
 if(!token||!/^[a-f0-9]{64}$/.test(token)){showModal('<h2>Check your payment</h2><p>Use the private status link saved when you registered, or return using the same browser. If you lost it, contact us on WhatsApp with your name and order reference.</p><a class="button gold" href="https://wa.me/'+config.whatsappNumber+'" target="_blank" rel="noopener noreferrer">Contact us on WhatsApp ↗</a>');return;}
 showModal('<h2>Checking payment status…</h2>');
 try{const order=await AcademyAPI.rpc('academy_payment_status',{p_token:token});if(!order)throw new Error('Registration not found. Check your private link or contact us.');showPayment(order,token);}catch(e){showModal('<h2>Unable to check right now</h2><p>'+escapeHtml(e.message)+'</p><button class="button outline" onclick="showSavedPayment()">Try again</button>');}
}
async function markReceiptSent(){const record=readPayment();if(!record)return;if(record.mode==='whatsapp'){record.receiptMarked=true;savePayment(record);showWhatsAppPayment(record);return;}try{const order=await AcademyAPI.rpc('academy_receipt_sent',{p_token:record.token});showPayment(order,record.token);}catch(e){document.getElementById('paymentFeedback').textContent=e.message;}}
async function copyStatusLink(){const record=readPayment();if(!record)return;const link=statusLink(record.token);try{await navigator.clipboard.writeText(link);document.getElementById('paymentFeedback').textContent='Private status link copied.';}catch{document.getElementById('paymentFeedback').textContent='Save this private link: '+link;}}
route();
// Returning learners see their saved status; refresh an open status screen without interrupting forms.
if(!location.hash&&readPayment()?.order)showSavedPayment();
setInterval(async()=>{
 if(document.visibilityState!=='visible'||!modal.open||!document.querySelector('.payment-state')||!AcademyAPI.ready())return;
 const saved=readPayment();if(!saved?.token||saved.mode==='whatsapp')return;
 try{const fresh=await AcademyAPI.rpc('academy_payment_status',{p_token:saved.token});if(fresh&&(fresh.status!==saved.order?.status||fresh.public_note!==saved.order?.public_note))showPayment(fresh,saved.token);}catch{}
},30000);

function startWhatsAppPayment(){
 let record=readPayment();
 if(record&&record.mode!=='whatsapp'){showSavedPayment();return;}
 if(!record){record={mode:'whatsapp',order:{reference:'STP-WA-'+newToken().slice(0,10).toUpperCase(),name:purchase.name,phone:purchase.normalizedPhone,email:purchase.email,product:purchase.type==='live'?'live-design':'online-monthly',group:purchase.time,amount:purchase.type==='live'?config.liveProgrammePrice:config.onlineMonthlyPrice}};savePayment(record);}
 showWhatsAppPayment(record);
}
function showWhatsAppPayment(record){
 const o=record.order;
 const message=`Hello Skills That Pay, my name is ${o.name}. Reference: ${o.reference}. Programme: ${o.product==='live-design'?'Live Design '+o.group:'Online Academy'}. Amount: NLe ${o.amount}. Phone: ${o.phone}. Email: ${o.email}. I have attached my Orange Money receipt. Please verify my payment.`;
 showModal(`<p class="eyebrow">${escapeHtml(o.reference)}</p><h2>${record.receiptMarked?'Awaiting WhatsApp verification':'Pay by Orange Money.'}</h2><div class="review-total"><span>Amount to send</span><b>NLe ${o.amount}</b></div><ol class="payment-steps"><li>Send <b>NLe ${o.amount}</b> to Orange Money <b>${config.orangeMoneyNumber}</b>.</li><li>Tap the WhatsApp button below. Your details are filled in. <b>Attach your payment receipt</b>, then send.</li></ol><a class="button gold" href="https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Send receipt on WhatsApp ↗</a><button class="button outline" onclick="markReceiptSent()">I have sent my receipt</button><p class="notice">Please allow up to 24 hours after sending your receipt. Our team will check the actual transfer and confirm on WhatsApp. This page does not verify payment automatically.</p><p class="micro">If someone else paid, include their Orange Money number in the message. Check the recipient details before sending money.</p><details><summary>Prefer to upload a receipt here?</summary><p>Website uploads are not available yet. Please use WhatsApp to complete your payment submission now.</p></details><p class="micro">Your reference is saved in this browser. Keep your WhatsApp conversation as your confirmation record.</p>`);
}
function attachReceiptPanel(order){
 if(['confirmed','cancelled'].includes(order.status))return;
 const body=document.getElementById('modalBody');
 const section=document.createElement('section');section.className='receipt-panel';
 section.innerHTML=`<h3>Or send your receipt here.</h3><p>Choose a screenshot or paste an image copied to your clipboard. You only need to use one receipt channel.</p>${order.receipt_uploaded?'<p class="notice">Receipt uploaded. Please allow up to 24 hours for verification.</p>':''}<label for="receiptFile">Payment receipt · JPG, PNG, WebP or PDF · Maximum 5 MB</label><input id="receiptFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><div id="receiptPaste" class="paste-zone" tabindex="0" role="region" aria-label="Paste receipt image">Tap here and paste your screenshot (Ctrl+V), or choose a file above.</div><p id="receiptFilename" aria-live="polite"></p><button class="button outline" id="uploadReceipt">Upload receipt for verification</button><p id="uploadFeedback" role="status"></p>`;
 body.appendChild(section);
 let file=null;
 function choose(f){file=f;document.getElementById('receiptFilename').textContent=f?f.name:'No file selected.';}
 document.getElementById('receiptFile').addEventListener('change',e=>choose(e.target.files[0]));
 document.getElementById('receiptPaste').addEventListener('paste',e=>{const image=Array.from(e.clipboardData.items).find(i=>i.kind==='file'&&i.type.startsWith('image/'));if(image){e.preventDefault();choose(image.getAsFile());}});
 document.getElementById('uploadReceipt').addEventListener('click',async e=>{
  const feedback=document.getElementById('uploadFeedback');if(!file){feedback.textContent='Choose a receipt file or paste a screenshot first.';return;}
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5*1024*1024||file.size===0){feedback.textContent='Use a JPG, PNG, WebP or PDF up to 5 MB.';return;}
  const button=e.currentTarget;button.disabled=true;feedback.textContent='Uploading receipt…';
  try{
   const saved=readPayment();const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[file.type];
   const path=saved.token+'/'+crypto.randomUUID()+'.'+extension;
   await AcademyAPI.uploadReceipt(path,file);
   const updated=await AcademyAPI.rpc('academy_attach_receipt',{p_token:saved.token,p_path:path});
   showPayment(updated,saved.token);
  }catch(error){feedback.textContent='Upload was not completed: '+error.message+' You can send the receipt on WhatsApp instead.';button.disabled=false;}
 });
}

async function refreshPublicSettings(){
 const data=await AcademyAPI.rpc('academy_public_config');publicProducts=data.products||[];
 const online=publicProducts.find(p=>p.id==='online-monthly'),live=publicProducts.find(p=>p.id==='live-afternoon');
 if(online){config.onlineMonthlyPrice=online.amount;config.onlineCapacity=online.capacity;document.querySelectorAll('[data-online-price]').forEach(e=>e.textContent=online.amount.toLocaleString());document.querySelectorAll('[data-online-capacity]').forEach(e=>e.textContent=online.capacity);}
 if(live){config.liveProgrammePrice=live.amount;document.querySelectorAll('[data-live-price]').forEach(e=>e.textContent=live.amount.toLocaleString());}
 const notice=document.getElementById('intakeNotice');if(notice)notice.textContent=online?.enabled?`Online Academy: ${online.remaining} of ${online.capacity} places remaining · Payment verified within 24 hours.`:'Online registration is currently closed. Contact us before sending payment.';
}
async function connectExistingDatabase(){
 try{await refreshPublicSettings();}
 catch(error){
  // An uninstalled migration uses WhatsApp-only launch mode. Do not hide network failures as successful database orders.
  if(error.status===404){AcademyAPI.setOperational(false);const notice=document.getElementById('intakeNotice');if(notice)notice.textContent='Pay by Orange Money and send your receipt on WhatsApp for confirmation.';}
  else {const notice=document.getElementById('intakeNotice');if(notice)notice.textContent='Unable to check availability right now. Please retry before sending payment.';}
 }finally{databaseConnection=null;}
}
if(AcademyAPI.ready())databaseConnection=connectExistingDatabase();

/* Restore draft answers between pages and submit through the validated database RPC. */
(() => {
    'use strict';
    const storageKey = 'stp-survey';
    const question = Number(document.body.dataset.question);
    const keys = ['age', 'current_situation', 'skill_interest', 'skill_income', 'biggest_obstacle', 'goal', 'future_investment', 'next_expert'];
    const page = number => `Skills_That_Pay_Survey_Page_${number}.html`;
    const read = key => JSON.parse(sessionStorage.getItem(key) || '{}');
    const form = document.getElementById('survey-form');
    const status = document.getElementById('survey-status');
    let answers;
    try { answers = read(storageKey); } catch {
        if (status) { status.textContent = 'Allow browser storage to keep your answers as you continue.'; status.classList.add('error'); }
        return;
    }
    if (question === 9) {
        const missing = keys.findIndex(key => !String(answers[key] ?? '').trim());
        if (missing !== -1) { window.location.replace(page(missing + 1)); return; }
        if(!answers.submitted){window.location.replace(page(8));return;}
        document.getElementById('completion-message').textContent = 'Your registration and survey have been submitted. Thank you for sharing your goals with us.';
        return;
    }
    if (!form) return;
    try {
        const registration=read('stp-registration');
        if(!registration.id||!registration.token){ window.location.replace('register.html'); return; }
    } catch { window.location.replace('register.html'); return; }
    const key = form.dataset.key;
    const otherBox = form.querySelector('.other-field');
    const otherInput = otherBox?.querySelector('input');
    const radios = [...form.querySelectorAll('input[type="radio"]')];
    const field = radios.length ? null : form.elements.namedItem(key);
    if (field) field.value = answers[key] ?? '';
    radios.forEach(radio => { radio.checked = radio.value === answers[key]; });
    if (otherInput) otherInput.value = answers[`${key}_other`] ?? '';
    function updateOther() {
        if (!otherBox) return;
        const selected = radios.some(radio => radio.checked && radio.value === 'Other');
        otherBox.hidden = !selected;
        otherInput.disabled = !selected;
        otherInput.required = selected;
    }
    updateOther();
    form.addEventListener('input', () => {
        if (field) field.setCustomValidity('');
        if (otherInput) otherInput.setCustomValidity('');
        status.textContent = '';
        status.classList.remove('error');
        updateOther();
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (field) field.setCustomValidity(field.value.trim() ? '' : 'Please enter your answer.');
        if (otherInput && otherInput.required) otherInput.setCustomValidity(otherInput.value.trim() ? '' : 'Please tell us more.');
        if (!form.reportValidity()) return;
        const value = new FormData(form).get(key);
        answers[key] = key === 'age' ? Number(value) : String(value).trim();
        if (otherInput && !otherInput.disabled) answers[`${key}_other`] = otherInput.value.trim();
        else delete answers[`${key}_other`];
        answers.submitted = false;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(answers));
            if (question < 8) { window.location.assign(page(question + 1)); return; }
            const missing = keys.findIndex(answerKey => !String(answers[answerKey] ?? '').trim());
            if (missing !== -1) { window.location.assign(page(missing + 1)); return; }
            const registration = read('stp-registration');
            if(!registration.id || !registration.token){window.location.assign('register.html');return;}
            status.textContent='Submitting your survey…';
            const { submitted, ...surveyAnswers } = answers;
            await STP_API.rpc('stp_submit_survey',{r_id:registration.id,r_token:registration.token,r_answers:surveyAnswers});
            window.STP_ANALYTICS?.track('survey_complete');
            answers.submitted=true;
            sessionStorage.setItem(storageKey,JSON.stringify(answers));
            window.location.assign('Skills_That_Pay_Survey_Complete.html');
        } catch (error) {
            window.STP_ANALYTICS?.track('survey_error');
            status.textContent = error.message || 'We couldn’t submit your survey. Please try again.';
            status.classList.add('error');
            button.disabled = false;
        }
    });
})();

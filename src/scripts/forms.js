// Front-end-only forms (newsletter, contact): validate, show a notice, send nothing.
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-mock-form]');
  if (!form) return;
  e.preventDefault();
  if (!form.reportValidity()) return;
  form.reset();
  const notice = form.querySelector('.concept-notice');
  if (notice) notice.hidden = false;
});

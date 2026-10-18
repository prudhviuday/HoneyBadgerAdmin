export function mountToast() {
  if (document.getElementById('hbToast')) return;
  const el = document.createElement('div'); el.id='hbToast'; el.className='toast'; document.body.appendChild(el);
  window.addEventListener('hb-toast', e => { el.textContent=e.detail.message; el.dataset.type=e.detail.type||'success'; el.classList.add('show'); clearTimeout(window.__hbToast); window.__hbToast=setTimeout(()=>el.classList.remove('show'),3000); });
}

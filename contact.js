(() => {
  const form = document.getElementById('contactForm');
  const button = document.getElementById('sendContact');
  const status = document.getElementById('contactStatus');
  let pending = '', timer, receiptTimer, receiptCleanup;
  let receiptSequence = 0;
  const setStatus = (text, state) => { status.textContent = text; status.dataset.state = state; };
  const finish = () => { clearTimeout(timer); clearTimeout(receiptTimer); if (receiptCleanup) receiptCleanup(); pending = ''; button.disabled = false; button.textContent = 'Санал илгээх 🚀'; };
  const acceptReply = data => {
    if (!pending || !data || data.type !== 'sitealive-contact' || data.requestId !== pending || typeof data.ok !== 'boolean' || data.pending) return;
    finish();
    if (data.ok) {
      form.reset(); delete form.dataset.fingerprint;
      setStatus('Санал хүсэлтийг тань хүлээн авлаа. Баярлалаа! 😊 Хариу шаардлагатай бол таны бичсэн имэйлээр холбогдоно.', 'success');
    } else setStatus(typeof data.message === 'string' ? data.message : 'Илгээхэд алдаа гарлаа. Дахин оролдоорой.', 'error');
  };
  const checkReceipt = endpoint => {
    if (!pending) return;
    const id = pending;
    const callback = 'sitealiveReceipt_' + id.replace(/-/g, '_') + '_' + (++receiptSequence);
    const script = document.createElement('script');
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout); script.remove(); delete window[callback];
      if (receiptCleanup === cleanup) receiptCleanup = null;
    };
    const retry = () => { cleanup(); if (pending === id) receiptTimer = setTimeout(() => checkReceipt(endpoint), 5000); };
    receiptCleanup = cleanup;
    window[callback] = data => {
      cleanup();
      if (pending !== id) return;
      if (data && data.ok === true && data.requestId === id && data.type === 'sitealive-contact') acceptReply(data);
      else retry();
    };
    const url = new URL(endpoint);
    url.searchParams.set('action', 'receipt');
    url.searchParams.set('requestId', id);
    url.searchParams.set('callback', callback);
    url.searchParams.set('_', Date.now());
    script.src = url.href;
    script.onerror = retry;
    timeout = setTimeout(retry, 10000);
    document.head.appendChild(script);
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    let endpoint;
    try {
      endpoint = new URL(window.SITE_CONTACT_API);
      if (endpoint.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)) throw Error();
    } catch {
      setStatus('Илгээх үйлчилгээ хараахан холбогдоогүй байна. Доорх Google Forms холбоосоор саналаа илгээгээрэй.', 'error');
      return;
    }
    if (location.protocol === 'file:') { setStatus('Энэ хуудсыг localhost эсвэл сайтын хаягаар нээгээрэй.', 'error'); return; }
    const values = new FormData(form);
    const fingerprint = JSON.stringify(['email','phone','purpose','message'].map(key => values.get(key)));
    // Reuse the ID for an uncertain retry of the same submission; server deduplicates it.
    if (form.dataset.fingerprint !== fingerprint) {
      form.dataset.fingerprint = fingerprint;
      document.getElementById('requestId').value = crypto.randomUUID();
    }
    pending = document.getElementById('requestId').value;
    document.getElementById('returnOrigin').value = location.origin;
    form.action = endpoint.href;
    button.disabled = true; button.textContent = 'Илгээж байна…';
    setStatus('Саналыг хүлээн авсан баталгааг хүлээж байна…', 'waiting');
    timer = setTimeout(() => {
      finish();
      setStatus('Хүлээн авсан эсэхийг баталгаажуулж чадсангүй. Дахин оролдох эсвэл Google Forms ашиглаж болно.', 'error');
    }, 45000);
    HTMLFormElement.prototype.submit.call(form);
    receiptTimer = setTimeout(() => checkReceipt(endpoint.href), 5000);
  });
  window.addEventListener('message', event => {
    let host;
    try { const origin = new URL(event.origin); if (origin.protocol !== 'https:') return; host = origin.hostname; } catch { return; }
    if (host !== 'script.google.com' && host !== 'script.googleusercontent.com' && !host.endsWith('.script.googleusercontent.com') && !host.endsWith('-script.googleusercontent.com')) return;
    acceptReply(event.data);
  });
})();

// Google Sheets → Extensions → Apps Script дотор байрлуулна.
// Хүснэгтийн URL дахь /d/ болон /edit-ийн хоорондох ID-г оруулна.
const SPREADSHEET_ID = '11dGf2R8A9cErguY8aDHA99uIR323pwkc0cuK5xP7bhg';
const ALLOWED_ORIGINS = ['https://bataa21.github.io', 'http://localhost', 'http://127.0.0.1'];
const PURPOSES = ['Санал хүсэлт', 'Алдаа мэдэгдэх', 'Хамтран ажиллах', 'Зар байрлуулах'];

// Read-only receipt: returns no email, message, phone or spreadsheet data.
function doGet(e) {
  const p = e && e.parameter || {};
  if (p.action !== 'receipt') return HtmlService.createHtmlOutput('SiteAlive contact v5 — үйлчилгээ бэлэн байна.');
  const id = String(p.requestId || '');
  const callback = String(p.callback || '');
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^sitealiveReceipt_[a-f0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput('Invalid receipt request');
  }
  let result = {type: 'sitealive-contact', requestId: id, ok: false, pending: true};
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('SiteAlive');
    if (sheet && sheet.getLastRow() > 1) {
      const found = sheet.getRange(2, 6, sheet.getLastRow() - 1, 1)
        .createTextFinder(id).matchEntireCell(true).findNext();
      if (found) result = {type: 'sitealive-contact', requestId: id, ok: true};
    }
  } catch (error) { console.error(error); }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const p = e && e.parameter || {};
  const origin = String(p.returnOrigin || '');
  const id = String(p.requestId || '');
  if (!ALLOWED_ORIGINS.includes(origin)) return HtmlService.createHtmlOutput('Хандалт зөвшөөрөгдөөгүй.');
  let result = {type: 'sitealive-contact', requestId: id, ok: false};
  let lock;
  try {
    const email = String(p.email || '').trim();
    const phone = String(p.phone || '').trim();
    const message = String(p.message || '').trim();
    const purpose = String(p.purpose || '');
    if (!/^[a-f0-9-]{36}$/i.test(id) || p.website || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length > 40 || !message || message.length > 4000 || !PURPOSES.includes(purpose)) {
      throw new Error('Талбаруудаа зөв бөглөөд дахин илгээгээрэй.');
    }
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Үйлчилгээ завгүй байна. Түр хүлээгээд дахин оролдоорой.');
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = book.getSheetByName('SiteAlive') || book.insertSheet('SiteAlive');
    if (!sheet.getLastRow()) { sheet.appendRow(['Хэзээ','Төрөл','Имэйл','Утас','Санал','Хүсэлтийн ID']); sheet.setFrozenRows(1); }
    const found = sheet.getRange(1, 6, sheet.getLastRow(), 1).createTextFinder(id).matchEntireCell(true).findNext();
    if (!found) {
      // Prevent spreadsheet formulas from user-supplied text.
      const safe = text => /^[=+\-@]/.test(text) ? "'" + text : text;
      sheet.appendRow([new Date(), safe(purpose), safe(email), safe(phone), safe(message), id]);
    }
    SpreadsheetApp.flush();
    result.ok = true;
  } catch (error) {
    console.error(error);
    result.message = error.message && /^(Талбаруудаа|Үйлчилгээ завгүй)/.test(error.message) ? error.message : 'Санал хадгалахад алдаа гарлаа. Дахин оролдох эсвэл Google Forms ашиглаарай.';
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
   return contactReply(result, origin);
}

function contactReply(result, origin) {
  const json = JSON.stringify(result).replace(/</g, '\\u003c');
  const target = JSON.stringify(origin);

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p id="status"></p>
<script>
const result = ${json};
const target = ${target};

document.getElementById('status').textContent = result.ok
  ? 'Санал амжилттай хадгалагдлаа.'
  : (result.message || 'Санал хадгалахад алдаа гарлаа.');

function sendReply() {
  let receiver = window;
  for (let i = 0; i < 10; i++) {
    receiver.postMessage(result, target);
    if (receiver === receiver.parent) break;
    receiver = receiver.parent;
  }
}

sendReply();
setTimeout(sendReply, 300);
setTimeout(sendReply, 1000);
</script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
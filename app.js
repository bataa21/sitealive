        async function fetchCurrentWeather(lat, lon) {
            const params = new URLSearchParams({ latitude: lat, longitude: lon,
                current: 'temperature_2m,apparent_temperature,weather_code,is_day',
                temperature_unit: 'celsius', timezone: 'Asia/Ulaanbaatar' });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params,
                    { signal: controller.signal });
                if (!response.ok) throw new Error('Weather request failed');
                const data = await response.json();
                const current = data.current;
                if (!current || !Number.isFinite(current.temperature_2m) ||
                    !Number.isFinite(current.apparent_temperature) || typeof current.time !== 'string') {
                    throw new Error('Invalid weather data');
                }
                return current;
            } finally { clearTimeout(timeout); }
        }
        function formatTemperature(value) {
            const rounded = Math.round(value);
            return (rounded > 0 ? '+' : '') + rounded + '°';
        }
        function weatherIcon(current) {
            const code = current.weather_code;
            if (code === 0) return current.is_day ? '☀️' : '🌙';
            if (code <= 3) return '☁️';
            if (code === 45 || code === 48) return '🌫️';
            if ([71,73,75,77,85,86].includes(code)) return '❄️';
            if (code >= 95) return '⛈️';
            return '🌧️';
        }
        async function updateTopWeatherChip() {
            const chipText = document.getElementById('chipTempText');
            const chip = document.getElementById('liveWeatherChip');
            try {
                const current = await fetchCurrentWeather(47.923, 106.920);
                chipText.innerText = formatTemperature(current.temperature_2m) + ' мэдрэгдэх ' +
                    formatTemperature(current.apparent_temperature) + ' УБ';
                document.querySelector('.chip-sun').textContent = weatherIcon(current);
                chip.title = 'Улаанбаатар · ' + current.time.replace('T', ' ') +
                    ' · Open-Meteo цаг агаарын загварын мэдээлэл';
            } catch (err) {
                chipText.innerText = 'Цаг агаар авах боломжгүй';
                document.querySelector('.chip-sun').textContent = '🌡️';
                chip.title = 'Интернэт холболтоо шалгана уу. Дарж дахин оролдоно.';
            }
        }
        document.getElementById('liveWeatherChip').addEventListener('click', updateTopWeatherChip);
        updateTopWeatherChip();
        setInterval(updateTopWeatherChip, 10 * 60 * 1000);


const STORAGE_KEY='site-alive-history-v1';
let history=[];let api='';
try { history=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); if(!Array.isArray(history))history=[]; history=history.filter(x=>x&&typeof x.url==='string'&&Number.isFinite(x.checkedAt)&&['up','down','unknown'].includes(x.status)).slice(0,20);api=localStorage.getItem('site-alive-api')||''; }catch{history=[];}
api=window.SITE_CHECK_API||api;
const titles={up:'🟢 Ажиллаж байна!',down:'🔴 Серверийн алдаа',unknown:'🟡 Шалгалт тодорхойгүй'};
const input=document.getElementById('urlInput'), result=document.getElementById('result'),checkBtn=document.getElementById('checkBtn');
function normalizeUrl(value){const u=new URL(/^https?:\/\//i.test(value.trim())?value.trim():'https://'+value.trim());if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||u.port)throw Error('Зөв вэбсайтын хаяг оруулна уу.');u.hash='';return u.href;}
function addText(parent,tag,text){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
function showResult(status,url,message,httpStatus,elapsed,reason){
result.hidden=false;result.className='result-card '+({up:'good',down:'bad',unknown:'uncertain'}[status]);result.replaceChildren();
let title=titles[status];
if(status==='unknown'){
 if(reason==='timeout')title='⏳ Хугацаа хэтэрсэн';
 else if(reason==='dns')title='🟡 Домэйны хаяг олдсонгүй';
 else if(httpStatus===401)title='🔒 Нэвтрэх шаардлагатай';
 else if(httpStatus===403)title='🛡️ Шалгалтыг хориглосон';
 else if(httpStatus===429)title='🟡 Сервер хариу өгч байна';
 else if(httpStatus===404)title='🔎 Хуудас олдсонгүй';
}
addText(result,'h2',title);addText(result,'p',url);addText(result,'p',message);
if(httpStatus||Number.isFinite(elapsed))addText(result,'p',(httpStatus?'HTTP '+httpStatus+' · ':'')+(Number.isFinite(elapsed)?elapsed+' мс':''));
let safeUrl;try{safeUrl=normalizeUrl(url);}catch{return;}
const actions=document.createElement('div');actions.className='result-actions';
const link=addText(actions,'a','Сайт руу очих ↗');link.href=safeUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='result-action';
const retry=addText(actions,'button','Дахин шалгах ↻');retry.type='button';retry.className='result-action';retry.addEventListener('click',()=>{if(checkBtn.disabled)return;input.value=safeUrl;document.getElementById('checkForm').requestSubmit();});result.append(actions);
}
function renderHistory(){const list=document.getElementById('historyList');list.replaceChildren();if(!history.length){const e=addText(list,'p','Эхний сайтаа шалгаад үзээрэй 🙂');e.className='empty';}for(const item of history){const row=document.createElement('div');row.className='history-row';const body=document.createElement('div');let host;try{host=new URL(item.url).host;}catch{continue;}addText(body,'strong',host);addText(body,'small',titles[item.status]);addText(body,'small',new Date(item.checkedAt).toLocaleString('mn-MN'));row.append(body);const btn=addText(row,'button','Дахин ↻');btn.className='text-button';btn.type='button';btn.addEventListener('click',()=>{input.value=item.url;document.getElementById('checkForm').requestSubmit();});list.append(row);}document.getElementById('clearHistory').disabled=!history.length;}
async function requestSiteCheck(endpoint,url,onWaking){
 const deadline=Date.now()+100000;
 let lastError;
 while(Date.now()<deadline){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),deadline-Date.now());
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:controller.signal});
   if([502,503,504].includes(response.status))throw Error('Service starting');
   if(!response.ok)throw Object.assign(Error('Service error'),{terminal:true});
   const data=await response.json();
   if(!['up','down','unknown'].includes(data.status)||typeof data.message!=='string')throw Object.assign(Error('Invalid response'),{terminal:true});
   return data;
  }catch(err){lastError=err;if(err.terminal)throw err;onWaking();}
  finally{clearTimeout(timer);}
  if(Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,Math.min(2000,deadline-Date.now())));
 }
 throw lastError||Error('Service unavailable');
}
document.getElementById('checkForm').addEventListener('submit',async e=>{
 e.preventDefault();if(checkBtn.disabled)return;
 let url;try{url=normalizeUrl(input.value);}catch(err){showResult('unknown',input.value,err.message);return;}
 if(!api){showResult('unknown',url,'Шалгах үйлчилгээ хараахан холбогдоогүй байна.');return;}
 checkBtn.disabled=true;checkBtn.textContent='Шалгаж байна…';result.hidden=false;result.className='result-card';result.replaceChildren();
 const progress=addText(result,'p','🔎 '+url+' руу холбогдож байна…');
 const onWaking=()=>{progress.textContent='⏳ Шалгах үйлчилгээ асаж байна эсвэл холболт удааширч байна… Түр хүлээнэ үү. Бэлэн болмогц автоматаар шалгана.';checkBtn.textContent='Түр хүлээнэ үү…';};
 const noticeTimer=setTimeout(onWaking,5000);
 try{
  const endpoint=new URL(api);endpoint.pathname='/check';endpoint.search='';endpoint.hash='';
  const data=await requestSiteCheck(endpoint,url,onWaking);
  clearTimeout(noticeTimer);
  showResult(data.status,url,data.message,data.httpStatus,data.elapsed,data.reason);
  history.unshift({url,status:data.status,checkedAt:Date.now()});history=history.slice(0,20);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(history));}catch{}renderHistory();
 }catch{showResult('unknown',url,'Шалгах үйлчилгээтэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу. Энэ нь оруулсан сайт унтарсан гэсэн үг биш.');}
 finally{clearTimeout(noticeTimer);checkBtn.disabled=false;checkBtn.textContent='Шалгах 🔍';}
});
document.querySelectorAll('[data-url]').forEach(btn=>btn.addEventListener('click',()=>{input.value=btn.dataset.url;input.focus();}));
document.getElementById('clearHistory').addEventListener('click',()=>{history=[];try{localStorage.removeItem(STORAGE_KEY);}catch{}renderHistory();});
document.getElementById('apiInput').value=api;
document.getElementById('saveApi').addEventListener('click',()=>{const notice=document.getElementById('apiNotice');try{const u=new URL(document.getElementById('apiInput').value);if(u.protocol!=='https:'||u.username||u.password)throw Error();api=u.origin;try{localStorage.setItem('site-alive-api',api);}catch{}notice.textContent='Холболтын хаяг хадгалагдлаа.';}catch{notice.textContent='Зөв HTTPS хаяг оруулна уу.'}});
document.getElementById('liveWeatherChip').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();updateTopWeatherChip();}});
renderHistory();

if(window.SITE_CHECK_API) document.querySelector(".connection").hidden=true;

// Cloudflare Worker. Optional env.ALLOWED_ORIGIN restricts browser access.
export function validateTarget(raw) {
 const u=new URL(raw);
 const h=u.hostname.toLowerCase();
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||h.length>253||!h.includes('.')||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]+$/.test(h)||/\.(local|localhost|internal|test|invalid|example)$/.test(h))throw Error('Invalid public website');
 u.hash='';return u;
}
function publicIPv4(ip){const n=ip.split('.').map(Number);if(n.length!==4||n.some(x=>!Number.isInteger(x)||x<0||x>255))return false;const[a,b]=n;return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));}
async function verifyPublicHost(host,signal){const r=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type=A',{headers:{accept:'application/dns-json'},signal});if(!r.ok)throw Error('DNS check failed');const d=await r.json();if(d.Status===3)throw Object.assign(Error('Domain not found'),{reason:'dns'});const ips=(d.Answer||[]).filter(x=>x.type===1).map(x=>x.data);if(!ips.length||ips.some(ip=>!publicIPv4(ip)))throw Error('No verified public address');}
export default {async fetch(request,env={}) {
 const origin=request.headers.get('Origin')||'';
 const allowed=env.ALLOWED_ORIGIN||'*';
 const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(allowed!=='*'&&origin!==allowed)return reply({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(new URL(request.url).pathname!=='/check')return reply({error:'Not found'},404);
 if(request.method!=='POST')return reply({error:'POST required'},405);
 let target;
 try{const text=await request.text();if(text.length>4096)throw Error();target=validateTarget(JSON.parse(text).url);}catch{return reply({error:'Invalid website URL'},400);}
 const start=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try {
  let response;
  let method=env.CHECK_METHOD==='GET'?'GET':'HEAD';
  for(let i=0;i<5;i++) {
   await verifyPublicHost(target.hostname,controller.signal);
   response=await fetch(target.href,{method,redirect:'manual',signal:controller.signal,headers:{'User-Agent':'SiteAliveChecker/1.0','Accept':'text/html,*/*;q=0.8'},cf:{cacheTtl:0}});
   if(method==='HEAD'&&[405,501].includes(response.status)) {
    if(response.body)await response.body.cancel();method='GET';
    response=await fetch(target.href,{method,redirect:'manual',signal:controller.signal,headers:{'User-Agent':'SiteAliveChecker/1.0','Accept':'text/html,*/*;q=0.8'},cf:{cacheTtl:0}});
   }
   if([301,302,303,307,308].includes(response.status)&&response.headers.get('Location')) {
    const location=response.headers.get('Location');if(response.body)await response.body.cancel();
    target=validateTarget(new URL(location,target).href);
    if(i===4)return reply({status:'unknown',message:'Хэт олон дамжуулалттай тул шалгаж чадсангүй.',elapsed:Date.now()-start});
   }else break;
  }
  const code=response.status;if(response.body)await response.body.cancel();
  let status='unknown',message='Сервер хариу өгсөн боловч энэ хуудас хэвийн нээгдсэнгүй.';
  if(code>=200&&code<400){status='up';message='Шалгах серверээс энэ хаяг руу амжилттай холбогдлоо.';}
  else if(code===429){message='Сайт манай автомат шалгалтыг хязгаарлалаа. Энэ нь таны шалгалтын тоо хэтэрсэн эсвэл сайт унтарсан гэсэн үг биш. «Сайт руу очих» товчоор браузерт нээж үзээрэй.';}
  else if([401,403].includes(code)){message='Сервер ажиллаж байна. Нэвтрэлт, хамгаалалт эсвэл хүсэлтийн хязгаарлалтаас болж хуудсыг шалгаж чадсангүй.';}
  else if(code===404){message='Сервер хариу өгсөн боловч оруулсан хуудас олдсонгүй. Сайт бүхэлдээ унтарсан гэсэн үг биш.';}
  else if(code>=500){status='down';message='Энэ хаяг серверийн алдаа буцаалаа. Түр хугацааны асуудал байж болно.';}
  return reply({status,message,httpStatus:code,method,finalUrl:target.href,retryAfter:response.headers.get('Retry-After'),elapsed:Date.now()-start});
 }catch(error){const reason=controller.signal.aborted?'timeout':error.reason==='dns'?'dns':'connection';const messages={timeout:'Сайт 12 секундийн дотор хариу өгсөнгүй. Удаашрал эсвэл холболтын асуудал байж болно. Сайт унтарсан гэж батлах боломжгүй.',dns:'Домэйны DNS хаяг олдсонгүй. Бичсэн хаягаа шалгаад дахин оролдоно уу.',connection:'Холболт, DNS эсвэл хамгаалалтаас болж шалгаж чадсангүй. Сайт унтарсан гэж батлах боломжгүй.'};return reply({status:'unknown',reason,message:messages[reason],elapsed:Date.now()-start});}
 finally{clearTimeout(timer);}
}};

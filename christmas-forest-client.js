(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const API=(document.querySelector('meta[name="christmas-forest-api"]')?.content||'').trim().replace(/\/$/,'');
  const VISITOR_KEY='bologna_christmas_forest_visitor_v1';
  const OWNER_KEY='bologna_christmas_forest_owned_v1';
  const QUEUE_KEY='bologna_christmas_forest_submit_queue_v1';
  const PRIVACY_KEY='bologna_christmas_forest_privacy_refs_v1';
  const IDEM_PREFIX='bologna_christmas_forest_action_';
  const ORNAMENT_ICONS={bauble:'●',star:'✦',bow:'🎀',bell:'♢',candy:'⌁',snow:'❄',ginger:'♙',gift:'▣',heart:'♡',orange:'✿',sock:'♧',flower:'✿'};
  let csrf='',visitor='',siteKey='',submissionsOpen=false,turnstilePromise=null,sort='latest',offset=0,total=0,action=null,widgetIds=new Map();

  function readStorage(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}}
  function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  function removeStorage(key){try{localStorage.removeItem(key);}catch{}}
  function token(bytes=24){const data=crypto.getRandomValues(new Uint8Array(bytes));return Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');}
  function setStatus(message){const el=$('forest-status');if(el)el.textContent=message;}
  function setMessage(id,message){const el=$(id);if(el)el.textContent=message;}
  function headers(extra={}){const h=new Headers(extra);if(visitor)h.set('X-Forest-Visitor',visitor);if(csrf)h.set('X-CSRF-Token',csrf);return h;}
  async function refreshCsrf(){if(!API)return;const response=await fetch(API+'/api/v1/config',{headers:visitor?{'X-Forest-Visitor':visitor}:{},cache:'no-store',mode:'cors'});if(!response.ok)throw new Error('config_unavailable');const config=await response.json();visitor=config.visitorToken||visitor;csrf=config.csrfToken||'';if(visitor)writeStorage(VISITOR_KEY,visitor);}
  async function api(path,options={},retryCsrf=true){
    if(!API)throw new Error('forest_not_connected');
    const response=await fetch(API+path,{method:options.method||'GET',headers:headers(options.headers||{}),body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',mode:'cors'});
    let data;try{data=await response.json();}catch{throw new Error('invalid_response');}
    if(!response.ok&&retryCsrf&&response.status===403&&data?.error?.code==='csrf_rejected'){await refreshCsrf();return api(path,options,false);}
    if(!response.ok){const e=new Error(data?.error?.code||'request_failed');e.status=response.status;throw e;}
    return data;
  }
  function idempotency(name){const key=IDEM_PREFIX+name;let value='';try{value=localStorage.getItem(key)||'';if(!value){value=token();localStorage.setItem(key,value);}}catch{value=token();}return value;}
  async function loadTurnstile(){
    if(window.turnstile)return window.turnstile;
    if(turnstilePromise)return turnstilePromise;
    turnstilePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.onload=()=>window.turnstile?resolve(window.turnstile):reject(new Error('turnstile_unavailable'));script.onerror=()=>reject(new Error('turnstile_unavailable'));document.head.append(script);});
    return turnstilePromise;
  }
  async function mountCaptcha(containerId,actionName,messageId,buttonId,canSubmit=()=>true){
    const container=$(containerId);if(!container||!siteKey)return;
    const old=widgetIds.get(containerId);if(old!==undefined&&window.turnstile){try{window.turnstile.remove(old);}catch{}widgetIds.delete(containerId);}
    container.replaceChildren();setMessage(messageId,'正在准备人机验证…');const button=$(buttonId);if(button)button.disabled=true;
    try{const ts=await loadTurnstile();const widget=ts.render(container,{sitekey:siteKey,action:actionName,theme:'light',callback:()=>{setMessage(messageId,'验证完成，可以继续。');if(button)button.disabled=!canSubmit();},'expired-callback':()=>{setMessage(messageId,'验证已过期，请重新完成验证。');if(button)button.disabled=true;},'error-callback':()=>{setMessage(messageId,'验证暂时不可用，请稍后重试。');if(button)button.disabled=true;}});widgetIds.set(containerId,widget);}
    catch{setMessage(messageId,'无法加载 Cloudflare Turnstile。请检查网络后重试。');}
  }
  function captchaValue(containerId){const widget=widgetIds.get(containerId);return widget!==undefined&&window.turnstile?window.turnstile.getResponse(widget):'';}
  function resetCaptcha(containerId,buttonId){const widget=widgetIds.get(containerId);if(widget!==undefined&&window.turnstile){try{window.turnstile.reset(widget);}catch{}}const button=$(buttonId);if(button)button.disabled=true;}
  function getDraft(){return typeof window.getChristmasDraft==='function'?window.getChristmasDraft():null;}
  function setDialogOpen(dialog,open){if(!dialog)return;if(open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}else if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
  function initializeSubmission(){
    const button=$('submit-to-forest'),dialog=$('forest-submit-dialog'),form=$('forest-submit-form'),consent=$('forest-submit-consent');if(!button||!dialog||!form)return;
    button.disabled=!Boolean(API&&siteKey&&visitor&&csrf);
    button.addEventListener('click',async()=>{const draft=getDraft();if(!draft){setMessage('forest-submit-message','先完成一棵树的装饰。');return;}const queued=readStorage(QUEUE_KEY,null),candidate=queued&&queued.tree?queued.tree:draft;if(window.ChristmasEditorCore.hasCustomImages(candidate)){setMessage('forest-submit-message','自定义图片目前仅可本地保存与导出；森林尚未完成图片审核与安全存储。移除图片挂饰后可投稿预设装饰作品。');return;}const summary=$('forest-submit-summary');summary.textContent=queued?`尚有一次未确认的投稿「${queued.tree.title}」。本次会用原幂等编号安全重试，不会重复创建作品。`:`「${draft.title}」· ${draft.ornaments.length} 件挂饰`;consent.checked=false;$('forest-submit-confirm').disabled=true;setDialogOpen(dialog,true);await mountCaptcha('forest-submit-captcha','christmas_tree_submit','forest-submit-message','forest-submit-confirm',()=>consent.checked);});
    consent.addEventListener('change',()=>{$('forest-submit-confirm').disabled=!consent.checked||!captchaValue('forest-submit-captcha');});
    form.addEventListener('submit',async event=>{event.preventDefault();const existingQueue=readStorage(QUEUE_KEY,null),candidateTree=existingQueue&&existingQueue.tree?existingQueue.tree:getDraft();if(window.ChristmasEditorCore.hasCustomImages(candidateTree)){setMessage('forest-submit-message','自定义图片目前仅可本地保存与导出；森林尚未完成图片审核与安全存储。移除图片挂饰后可投稿预设装饰作品。');return;}const captcha=captchaValue('forest-submit-captcha');if(!consent.checked||!captcha)return;const existing=readStorage(QUEUE_KEY,null);const queue=existing||{idempotencyKey:token(),ownerToken:token(32),tree:getDraft(),createdAt:Date.now()};if(!existing&&!writeStorage(QUEUE_KEY,queue)){setMessage('forest-submit-message','当前浏览器无法保存安全重试信息。请先导出 PNG 后重试。');return;}if(!existing){const owned=readStorage(OWNER_KEY,[]);owned.unshift({id:'pending:'+queue.idempotencyKey,title:queue.tree.title,ownerToken:queue.ownerToken,createdAt:Date.now()});if(!writeStorage(OWNER_KEY,owned.slice(0,60))){removeStorage(QUEUE_KEY);setMessage('forest-submit-message','当前浏览器无法保存作品所有权凭据，投稿已取消。');return;}}const submit=$('forest-submit-confirm');submit.disabled=true;submit.textContent='正在提交…';try{const result=await api('/api/v1/trees',{method:'POST',body:{tree:queue.tree,idempotencyKey:queue.idempotencyKey,ownerToken:queue.ownerToken,turnstileToken:captcha}});const owned=readStorage(OWNER_KEY,[]).filter(item=>item.id!=='pending:'+queue.idempotencyKey);if(!owned.some(item=>item.id===result.submissionId))owned.unshift({id:result.submissionId,title:queue.tree.title,ownerToken:queue.ownerToken,createdAt:Date.now()});if(!writeStorage(OWNER_KEY,owned.slice(0,60)))throw new Error('local_storage_unavailable');removeStorage(QUEUE_KEY);setMessage('forest-submit-message',`已收到，正在审核。作品编号：${result.submissionId}`);setStatus('投稿已安全送达，等待管理员审核；通过后才会进入公开森林。');setTimeout(()=>setDialogOpen(dialog,false),1500);await refreshGallery();}catch(error){setMessage('forest-submit-message',error.message==='rate_limited'?'投稿频率已达上限，请稍后再试。':'提交暂未确认；本机保留了同一幂等编号和撤回凭据，可安全重试。');resetCaptcha('forest-submit-captcha','forest-submit-confirm');}finally{submit.textContent='提交审核';submit.disabled=!consent.checked||!captchaValue('forest-submit-captcha');}});
  }
  function appendTreePreview(host,tree){if(typeof window.buildChristmasTreePreview==='function'){const svg=window.buildChristmasTreePreview(tree);if(svg){host.append(svg);return;}}const fallback=document.createElement('div');fallback.className='forest-fallback-tree';fallback.textContent='🎄';host.append(fallback);}
  function renderCard(tree){
    const card=document.createElement('article');card.className='forest-card';
    const preview=document.createElement('button');preview.type='button';preview.className='forest-card-preview';preview.setAttribute('aria-label','打开作品「'+tree.title+'」');appendTreePreview(preview,tree);preview.addEventListener('click',()=>showDetail(tree));
    const title=document.createElement('h3');title.textContent=tree.title;
    const wish=document.createElement('p');wish.className='forest-card-wish';wish.textContent=tree.wish;
    const meta=document.createElement('p');meta.className='forest-card-meta';meta.textContent=`${tree.ornaments.length} 件装饰 · ${tree.stars} 颗星`;
    const actions=document.createElement('div');actions.className='forest-card-actions';
    const star=document.createElement('button');star.type='button';star.className='btn lite';star.textContent='✦ 送一颗星';star.disabled=!submissionsOpen;star.setAttribute('aria-label',submissionsOpen?'给这棵树送一颗星':'目前暂停送星');star.addEventListener('click',()=>openAction('star',tree));
    const report=document.createElement('button');report.type='button';report.className='text-button';report.textContent='举报';report.disabled=!submissionsOpen;report.addEventListener('click',()=>openAction('report',tree));
    const view=document.createElement('button');view.type='button';view.className='text-button';view.textContent='查看作品';view.addEventListener('click',()=>showDetail(tree));
    actions.append(star,view,report);card.append(preview,title,wish,meta,actions);return card;
  }
  function showDetail(tree){const dialog=$('forest-detail-dialog'),body=$('forest-detail-body');if(!dialog||!body)return;body.replaceChildren();const heading=document.createElement('h3');heading.textContent=tree.title;const preview=document.createElement('div');preview.className='forest-detail-preview';appendTreePreview(preview,tree);const wish=document.createElement('p');wish.textContent=tree.wish;const meta=document.createElement('p');meta.className='forest-card-meta';meta.textContent=`已审核公开 · ${tree.stars} 颗星`;body.append(heading,preview,wish,meta);setDialogOpen(dialog,true);}
  async function refreshGallery(reset=true){
    if(!API||!visitor)return;if(reset)offset=0;const gallery=$('forest-gallery');if(reset)gallery.replaceChildren();
    const query=new URLSearchParams({sort,limit:'12',offset:String(offset)});
    try{const data=await api('/api/v1/trees?'+query);total=data.total;for(const tree of data.items)gallery.append(renderCard(tree));offset+=data.items.length;$('forest-more').hidden=offset>=total;const count=await api('/api/v1/community-tree');$('community-tree-count').textContent=`${count.approvedTrees} 棵已审核作品 · ${count.lamps} 盏真实参与灯`;
      if(total===0&&reset){const empty=document.createElement('p');empty.className='forest-empty';empty.textContent='森林还在等第一棵通过审核的树。你可以先完成自己的作品。';gallery.append(empty);}
    }catch(error){if(reset){const msg=document.createElement('p');msg.className='forest-empty';msg.textContent=error.message==='forest_unavailable'?'公共森林暂时不可用，请稍后重试。':'暂时无法读取森林，请稍后重试。';gallery.append(msg);}}
  }
  function openAction(type,tree){action={type,tree};const label=$('forest-report-label');label.hidden=type!=='report';$('forest-action-heading').textContent=type==='star'?'送一颗星给这棵树':'举报这件作品';$('forest-action-copy').textContent=type==='star'?'每个浏览器身份对同一作品只能送一次星。':'请选择准确的原因；举报只进入管理员私密队列。';$('forest-action-confirm').textContent=type==='star'?'送出星星':'提交举报';$('forest-action-confirm').disabled=true;setMessage('forest-action-message','');setDialogOpen($('forest-action-dialog'),true);mountCaptcha('forest-action-captcha',type==='star'?'christmas_tree_star':'christmas_tree_report','forest-action-message','forest-action-confirm');}
  async function submitAction(event){event.preventDefault();if(!action)return;const captcha=captchaValue('forest-action-captcha');if(!captcha)return;const button=$('forest-action-confirm');button.disabled=true;try{if(action.type==='star'){const result=await api(`/api/v1/trees/${action.tree.id}/stars`,{method:'POST',body:{turnstileToken:captcha}});setMessage('forest-action-message',result.duplicate?'你已经给这棵树送过星啦。':`星星送达，现在有 ${result.stars} 颗。`);}else{const key=idempotency('report-'+action.tree.id);const result=await api(`/api/v1/trees/${action.tree.id}/reports`,{method:'POST',body:{reason:$('forest-report-reason').value,idempotencyKey:key,turnstileToken:captcha}});setMessage('forest-action-message',`举报已进入审核队列（${result.reportId}）。`);}setTimeout(()=>setDialogOpen($('forest-action-dialog'),false),1200);await refreshGallery();}catch(error){setMessage('forest-action-message',error.message==='rate_limited'?'操作频率已达上限，请稍后再试。':'操作未完成，请检查网络并重新验证后重试。');resetCaptcha('forest-action-captcha','forest-action-confirm');}}
  function initializePrivacy(){const open=$('forest-privacy-open'),dialog=$('forest-privacy-dialog'),form=$('forest-privacy-form');if(!open||!dialog||!form)return;open.disabled=!Boolean(API&&siteKey&&visitor&&csrf);
    open.addEventListener('click',()=>{const owned=readStorage(OWNER_KEY,[]),select=$('forest-owned-tree');select.replaceChildren();owned.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=`${item.title} · ${item.id.slice(0,8)}`;select.append(option);});if(!owned.length){setStatus('此浏览器还没有本地保存的作品所有权凭据。');return;}setMessage('forest-privacy-message','');$('forest-privacy-confirm').disabled=true;setDialogOpen(dialog,true);mountCaptcha('forest-privacy-captcha','christmas_privacy_request','forest-privacy-message','forest-privacy-confirm');});
    form.addEventListener('submit',async event=>{event.preventDefault();const captcha=captchaValue('forest-privacy-captcha');if(!captcha)return;const owned=readStorage(OWNER_KEY,[]),item=owned.find(v=>v.id===$('forest-owned-tree').value);if(!item)return;const requestType=$('forest-privacy-type').value;const refKey=IDEM_PREFIX+'privacy-'+item.id+'-'+requestType;let reference='',key='';try{reference=localStorage.getItem(refKey+'-ref')||'';key=localStorage.getItem(refKey+'-key')||'';if(!reference){reference=token();localStorage.setItem(refKey+'-ref',reference);}if(!key){key=token();localStorage.setItem(refKey+'-key',key);}}catch{reference=token();key=token();}const button=$('forest-privacy-confirm');button.disabled=true;try{const result=await api('/api/v1/privacy-requests',{method:'POST',body:{type:requestType,treeId:item.id,ownerToken:item.ownerToken,reference,idempotencyKey:key,turnstileToken:captcha}});const refs=readStorage(PRIVACY_KEY,[]);if(!refs.some(x=>x.requestId===result.requestId)){refs.unshift({requestId:result.requestId,reference,type:requestType,createdAt:Date.now()});writeStorage(PRIVACY_KEY,refs.slice(0,20));}$('forest-privacy-reference').value=reference;setMessage('forest-privacy-message',`请求已私密送达。查询回执请保存此代码：${reference}`);}catch(error){setMessage('forest-privacy-message',error.message==='owner_verification_failed'?'作品所有权核验失败，检查本机是否仍保存投稿凭据。':'隐私请求未确认；本机保留了安全重试编号，可重新完成验证后重试。');resetCaptcha('forest-privacy-captcha','forest-privacy-confirm');}});
    $('forest-privacy-check').addEventListener('click',async()=>{const reference=$('forest-privacy-reference').value.trim();if(!reference){setMessage('forest-privacy-message','请输入回执代码。');return;}try{const result=await api('/api/v1/privacy-requests/status',{method:'POST',body:{reference}});$('forest-privacy-result').hidden=false;$('forest-privacy-result').textContent=JSON.stringify(result,null,2);setMessage('forest-privacy-message','已读取此回执对应的私密请求状态。');}catch{setMessage('forest-privacy-message','回执无效或请求暂不可用。');}});
  }
  async function init(){
    document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>setDialogOpen($(button.dataset.closeDialog),false)));
    $('forest-action-form')?.addEventListener('submit',submitAction);
    document.querySelectorAll('[data-forest-sort]').forEach(button=>button.addEventListener('click',()=>{sort=button.dataset.forestSort;document.querySelectorAll('[data-forest-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));refreshGallery(true);}));
    $('forest-more')?.addEventListener('click',()=>refreshGallery(false));initializeSubmission();initializePrivacy();
    if(!API){setStatus('本地候选尚未连接圣诞森林 Staging；作品不会被发送或公开。');return;}
    try{const prior=readStorage(VISITOR_KEY,'');const config=await fetch(API+'/api/v1/config',{headers:prior?{'X-Forest-Visitor':prior}:{},cache:'no-store',mode:'cors'}).then(async r=>{if(!r.ok)throw new Error('config_unavailable');return r.json();});visitor=config.visitorToken||'';csrf=config.csrfToken||'';siteKey=config.turnstileSiteKey||'';submissionsOpen=Boolean(config.submissionsOpen);if(visitor)writeStorage(VISITOR_KEY,visitor);$('submit-to-forest').disabled=!Boolean(submissionsOpen&&siteKey&&visitor&&csrf);$('forest-privacy-open').disabled=!Boolean(config.forestAvailable&&siteKey&&visitor&&csrf);if(!config.forestAvailable){setStatus('圣诞森林服务尚未就绪；本地编辑和导出仍可使用。');return;}if(!config.submissionsOpen){setStatus('公共浏览可用，投稿和投票目前关闭。');}else setStatus('已连接圣诞森林。投稿会先进入审核，页面不会上传个人照片。');await refreshGallery(true);}
    catch{setStatus('暂时无法连接圣诞森林；DIY 草稿与 PNG 导出不受影响。');}
  }
  init();
})();

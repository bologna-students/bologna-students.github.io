(function(root){'use strict';const entries=[
['迎接十二月','welcome','给自己留十分钟不赶路的时间。今天从一盏暖灯开始。','#workshop','点亮我的树'],
['纸星星','craft','用一张废纸折出一颗星，也可以在树上放一颗。','#workshop','添加星星'],
['双塔色卡','observe','从窗边挑三种冬日颜色，为树搭配一组新配色。','#workshop','试试配色'],
['写给陌生人','letter','先在心里写一句不需要署名的问候。邮局开放后，再自愿寄出。','',''],
['热饮暂停','rest','给一杯温热的水或饮品留出慢慢喝完的时间。','',''],
['森林漫游','browse','如果森林已经开放，看看不同作品的配色；没有作品时，也不必着急。','#forest','看看森林'],
['冬日声音','listen','停下耳机片刻，听听身边真实的街声。无需录音或上传。','',''],
['小小感谢','gratitude','想起一个帮过你的人。可以只在心里说声谢谢。','',''],
['灯光实验','craft','试着把同一棵树的彩灯打开，再关上，看看你更喜欢哪一种。','#workshop','切换彩灯'],
['窗边观察','observe','寻找身边一个三角形，让它成为今天的小小圣诞树。','',''],
['给未来的你','reflection','在自己的纸上写下：明年的这个时候，我希望仍记得……','',''],
['一首冬歌','music','选一首你熟悉的歌，给今天一个轻轻的背景。不自动播放音乐。','',''],
['不完美挂饰','craft','给树留一个歪一点的挂饰。亲手做的痕迹也值得保留。','#workshop','装饰一角'],
['远方问候','connection','若你愿意，给远方的人发一句简单问候。不必公开联系方式。','',''],
['我的冬日照片','photo','可以拍一张只属于自己的冬日照片，注意避开陌生人的隐私。','',''],
['奶油白与松绿','palette','给树试一组安静的颜色，也可以保留你最喜欢的原色。','#workshop','试一组新颜色'],
['考试周呼吸','rest','放松肩膀，慢慢呼吸几次。休息也属于认真生活的一部分。','',''],
['一件微小好事','reflection','回想今天一件不太显眼、却让你舒服了一点的小事。','',''],
['纸上信封','craft','用纸画一个信封，把不想公开的心事留在自己手里。','',''],
['认真看一棵树','browse','若森林有审核通过的作品，可以认真看一棵。没有作品时不生成虚假热闹。','#forest','浏览真实作品'],
['分享前的小检查','privacy','截图分享自己的树前，确认祝福里没有电话、住址或他人的私人信息。','#workshop','看看我的祝福'],
['留住这棵树','souvenir','把自己的树导出成图片，作为今年冬天的一份私人纪念。','#workshop','回工坊导出'],
['写给此刻','letter','给现在的自己写一句温柔的话。信件不必总是寄往远方。','',''],
['平安夜的暖光','celebrate','谢谢你走到第二十四扇门。无论此刻在哪里，愿你拥有一个可以安心停留的角落。','#workshop','留一棵纪念树']
].map(([title,kind,text,href,label],i)=>Object.freeze({day:i+1,title,kind,text,href,label}));
const romeFormatter=(()=>{try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'});}catch{return null;}})();
function dateKey(now){try{if(!romeFormatter)return null;const date=new Date(now);if(!Number.isFinite(date.getTime()))return null;const parts=Object.fromEntries(romeFormatter.formatToParts(date).map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}`;}catch{return null;}}
function unlocked(day,now=Date.now()){if(!Number.isInteger(day)||day<1||day>24)return false;const today=dateKey(now);return today!==null&&today>=`2026-12-${String(day).padStart(2,'0')}`;}
function open(day,now=Date.now()){return unlocked(day,now)?entries[day-1]:null;}
function nextUnlockAt(now=Date.now()){
  const today=dateKey(now);if(!today||today>='2026-12-24')return null;
  let target='2026-12-01';
  if(today>='2026-12-01'){
    const [year,month,day]=today.split('-').map(Number);
    target=new Date(Date.UTC(year,month-1,day)+86400000).toISOString().slice(0,10);
  }
  let low=Math.floor(new Date(now).getTime());
  if(!Number.isFinite(low))return null;
  let high=low+370*86400000;
  if(dateKey(high)<target)return null;
  while(high-low>1){const middle=Math.floor((low+high)/2);if(dateKey(middle)>=target)high=middle;else low=middle;}
  return high;
}
root.ChristmasCalendar=Object.freeze({entries:Object.freeze(entries),unlocked,open,nextUnlockAt});if(typeof module==='object'&&module.exports)module.exports=root.ChristmasCalendar;})(globalThis);

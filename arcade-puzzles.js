(function (global, factory) {
  "use strict";
  var bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  global.BolognaHalloweenPuzzles = bank;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Facts: unibo.it/en/university/who-we-are/our-history/our-history;
  // unibo.it/en/enrolled-students; bolognawelcome.com/en/blog/seven-secrets-bologna;
  // bolognawelcome.com/en/blog/what-to-eat-in-bologna;
  // bolognawelcome.com/en/places/towers-historic-buildings/archiginnasio-eng;
  // bolognawelcome.com/en/other/libraries-3/salaborsa-en;
  // whc.unesco.org/en/list/1650; and this site's published living guide.
  // Row: id, question, accepted answers separated by |, hint 1, hint 2.
  // Hint 3 always reveals the first accepted answer.
  var rows = {
    easy: [
      ["e01","南瓜灯的主角，意大利语怎么说？","zucca|南瓜","首字母是 z。","意大利菜单里常见 zucca 口味。"],
      ["e02","一只小幽灵飘过拱廊：幽灵的意大利语是？","fantasma|幽灵","它不是蝙蝠，也不是黑猫。","这个词以 fan 开头。"],
      ["e03","万圣夜天上倒挂的小动物，意大利语叫？","pipistrello|蝙蝠","它有翅膀，却不是鸟。","词首是 pipi。"],
      ["e04","黑猫在窗台打哈欠：猫的意大利语是？","gatto|猫","两个 t 藏在这个词中。","词形是 ga__o。"],
      ["e05","糖果袋里的一颗糖，意大利语常说？","caramella|糖果","它和英文 caramel 看着有点像。","词首 cara，词尾 mella。"],
      ["e06","月亮照着双塔：月亮的意大利语是？","luna|月亮","它只有四个字母。","词形是 lu_a。"],
      ["e07","墙角那张蜘蛛网，意大利语叫？","ragnatela|蜘蛛网","先想到蜘蛛 ragno。","词首 ragna，词尾 tela。"],
      ["e08","女巫从塔顶飞过：女巫的意大利语是？","strega|女巫","它以 st 开头。","六个字母，结尾是 ega。"],
      ["e09","万圣夜后，日历翻到几月？","11|十一月|novembre|november","万圣夜在十月末。","十月之后紧跟的月份。"],
      ["e10","每年万圣节在十月的哪一天？","31|31日|三十一日","是十月最后一天。","日期数字是 3 和 1。"],
      ["e11","Bologna Students 这本指南介绍的是哪座城市？","bologna|博洛尼亚","城市名就在网站标题中。","它的意大利语拼作 Bologna。"],
      ["e12","UniBo 里的 Bo 指哪座城市？","bologna|博洛尼亚","也是这本生活指南的城市。","UniBo 的后两个字母是城市缩写。"],
      ["e13","博洛尼亚所在的大区是？","emilia romagna|emilia-romagna|艾米利亚罗马涅|艾米利亚-罗马涅","大区名字由两部分构成。","第一部分 Emilia，第二部分 Romagna。"],
      ["e14","城市天际线里著名的两座中世纪塔，统称什么？","双塔|due torri|two towers","其中一座叫 Asinelli。","意大利语直译是 Due Torri。"],
      ["e15","双塔里名字以 A 开头的那座是？","asinelli|阿西内利塔|阿西内利","另一座叫 Garisenda。","答案拼作 Asinelli。"],
      ["e16","双塔里名字以 G 开头的那座是？","garisenda|加里森达塔|加里森达","另一座叫 Asinelli。","答案拼作 Garisenda。"],
      ["e17","想约朋友在城市主广场见面，应说 Piazza 什么？","maggiore|piazza maggiore|马焦雷广场","广场名字意为“较大的”。","完整地名 Piazza Maggiore。"],
      ["e18","广场边那尊海神喷泉，海神叫什么？","nettuno|neptune|海王星|尼普顿","名字也是太阳系一颗行星。","意大利语是 Nettuno。"],
      ["e19","博洛尼亚街上连绵的有顶拱廊，意大利语叫什么？","portici|portico|拱廊","雨天走在下面更方便。","复数形式 portici。"],
      ["e20","博洛尼亚常见的粉色切片肉肠叫什么？","mortadella|莫塔德拉","本地三明治里能见到。","意大利语以 morta 开头。"],
      ["e21","环形小面食常在高汤里出现，叫什么？","tortellini|意式饺子|托尔泰利尼","它是包馅面食。","名字以 tortell 开头。"],
      ["e22","与肉酱最搭的博洛尼亚传统宽面叫什么？","tagliatelle|意式宽面|塔利亚泰莱","它是长条而非细意面。","本地经典菜是 tagliatelle al ragù。"],
      ["e23","菜单上 ragù 指哪类酱？","肉酱|meat sauce|ragu|ragù","常搭配宽面。","中文答案是“肉酱”。"],
      ["e24","意大利语 gelato 是什么甜品？","冰淇淋|gelato|ice cream","夏天在甜品店常见。","用小勺吃的冷冻甜品。"],
      ["e25","有人说 grazie，你听到的是哪句礼貌话？","谢谢|thank you|grazie","有人帮你拿到糖果袋。","中文是“谢谢”。"],
      ["e26","点一杯 caffè，通常是在点什么？","咖啡|coffee|caffè|caffe","这不是果汁。","中文是“咖啡”。"],
      ["e27","生活指南一共收录多少张地点卡？","53|五十三","搜索框附近就写着总数。","比 50 多三张。"],
      ["e28","生活指南里，奶茶和咖啡归入哪一类？","奶茶咖啡甜品","它还包括甜品。","分类名连写三个词：奶茶、咖啡、甜品。"],
      ["e29","想从地点卡直接查路线，页面提供哪个地图服务的链接？","google maps|谷歌地图|googlemap","地点卡底部有打开地图的入口。","品牌的英文是 Google Maps。"],
      ["e30","指南中想读群友看法，展开卡片上的哪块内容？","评价|群友评价|看看群友怎么说|reviews","它默认折叠。","点“看看群友怎么说”。"]
    ],
    medium: [
      ["m01","UniBo 官方历史页把哪一年作为学校传统起源纪年？","1088|一零八八","这是十一世纪末的四位数。","一千零八十年代末。"],
      ["m02","小威尼斯般的运河窥视窗藏在哪条街？","via piella|piella街|皮耶拉街","官方城市指南称它为 little window。","街名是 Via Piella。"],
      ["m03","Via Piella 的小窗口能看到哪条运河？","moline canal|canale delle moline|moline运河|莫利内运河","它不是护城河。","运河名里有 Moline。"],
      ["m04","Corte Isolani 木质拱廊上藏着几支箭？","3|三|三支","数字不到五。","一、二，再多一支。"],
      ["m05","耳语能沿拱壁传到对角的秘密，位于哪座宫殿的拱顶？","palazzo del podestà|palazzo del podesta|podestà宫|podesta宫","就在 Piazza Maggiore 附近。","宫殿名含 Podestà。"],
      ["m06","圣卢卡长拱廊最后通往哪座圣所？","san luca|圣卢卡圣所|madonna di san luca|santuario della madonna di san luca","它位于城外山丘上。","名字里有 San Luca。"],
      ["m07","肉酱宽面里，宽面的意大利语原名是什么？","tagliatelle","不是 spaghetti。","菜单会写 tagliatelle al ragù。"],
      ["m08","Tortellini in brodo 中，in brodo 表示放在什么里？","高汤|汤|broth|brodo","不是烤箱。","中文是“在汤里”。"],
      ["m09","本地短而卷的面，常与香肠同上桌，叫什么？","gramigna|格拉米尼亚面","Bologna Welcome 写作 alla salsiccia。","词首 gram，结尾 igna。"],
      ["m10","绿色千层面的绿色主要来自哪种叶菜？","菠菜|spinach|spinaci","它被揉进面皮。","意大利语 spinaci。"],
      ["m11","薄饼 piadina 更典型地来自大区名称的哪一半？","romagna|罗马涅","大区全称 Emilia-Romagna。","答案是连字符后半部。"],
      ["m12","Crescentine fritte 是油炸的哪类食物？","面团|炸面团|fried dough|bread dough","常和冷切肉、奶酪同吃。","fritte 的意思是炸过的。"],
      ["m13","想预约 UniBo 考试场次，官方常用哪个应用？","almaesami","不是排课页面。","名字以 Alma 开头，以 Esami 结尾。"],
      ["m14","UniBo 的学生注册到毕业手续入口叫什么？","studenti online|studentionline","名字里直写 Students 的意大利语。","官方英文列表写 StudentiOnline。"],
      ["m15","UniBo 查课程资料的平台叫？","virtuale","它的名字意为“虚拟的”。","官方服务名是 Virtuale。"],
      ["m16","UniBo 管理国际交流项目的平台叫？","almarm|alma rm","它以 Alma 开头。","完整短名 AlmaRm。"],
      ["m17","UniBo 校园无线网络叫？","almawifi|alma wifi","名字以 Alma 开头。","后半段就是 WiFi。"],
      ["m18","指南的五类里，亚洲餐那一类有几张卡？","15|十五","它比意餐类多两张。","十加五。"],
      ["m19","指南的意餐/本地吃喝类有几张卡？","13|十三","它比中餐/亚洲餐少两张。","十加三。"],
      ["m20","指南的奶茶咖啡甜品类有几张卡？","8|八","不到十张。","比超市/生活多一张。"],
      ["m21","指南的景点/活动类有几张卡？","10|十","与奶茶咖啡甜品类相差两张。","正好一个十。"],
      ["m22","地点卡上的群友推荐写在可展开的哪一栏？","看看群友怎么说|评价|群友评价","每张卡下部有它。","标题直接写着“看看群友怎么说”。"],
      ["m23","站内搜索会同时筛地点和哪类文字？","评价|群友评价|reviews","群友留下的体验也能被搜到。","不只搜标题，还搜展开栏里的看法。"],
      ["m24","博洛尼亚的两座地标塔中，哪一座名字来自 Asinelli 家族？","asinelli|阿西内利塔|阿西内利","不是 Garisenda。","英文名是 Tower of Asinelli。"],
      ["m25","Archiginnasio 如今的一间著名教学空间，名字与人体解剖有关，是什么？","解剖剧场|anatomical theatre|teatro anatomico","它在宫殿楼上。","英文直接叫 Anatomical Theatre。"],
      ["m26","Archiginnasio 今天也容纳哪种公共文化机构？","图书馆|library|biblioteca","学生会想到借书与阅读。","官方称 Municipal Library。"],
      ["m27","博洛尼亚拱廊被列入哪项世界遗产名录？","unesco|联合国教科文组织|世界遗产","这不是一项餐饮奖。","机构英文缩写五个字母：UNESCO。"],
      ["m28","圣彼得罗尼奥大教堂所在的广场叫？","piazza maggiore|马焦雷广场","它是城市主广场。","名字以 Piazza 开头，第二词 Maggiore。"],
      ["m29","哪座博洛尼亚图书馆的玻璃地板下能看到古代遗迹？","salaborsa|sala borsa|萨拉博尔萨图书馆","它就在 Piazza Maggiore 一带。","名字由 Sala 和 Borsa 两部分组成。"],
      ["m30","博洛尼亚传统夹 mortadella 的街头午餐通常是什么？","三明治|panino|sandwich","不是冰淇淋。","意大利语叫 panino con mortadella。"]
    ],
    hard: [
      ["h01","原版谜团最后一问：指南里恰好 7 张地点卡的是哪一类？","超市/生活|超市生活|supermarkets/life|supermarket/life","看首页分类数字。","依次是 15、13、8、7、10，找第四类。"],
      ["h02","UNESCO 记录：博洛尼亚拱廊列入世界遗产是哪一年？","2021|二零二一","是 2020 年代初。","数字 20 后接 21。"],
      ["h03","UNESCO 记录的博洛尼亚拱廊总长度约多少公里？","62|62公里|六十二公里|62km","超过 50 公里。","六十多公里，个位数为 2。"],
      ["h04","世界遗产中的博洛尼亚拱廊由多少个代表性组成部分构成？","12|十二","不到十五处。","十加二。"],
      ["h05","Via Piella 小窗口的官方地址门牌写 16/a 到多少号？","18/a|18a","仍在同一条街。","16/a 往后两号，是 18/a。"],
      ["h06","三支中世纪箭藏在 Corte Isolani，它位于哪条街？","strada maggiore|马焦雷街","名字第二词与主广场相同。","第一词 Strada，第二词 Maggiore。"],
      ["h07","耳语拱顶属于 Palazzo del Podestà，在哪个广场旁？","piazza maggiore|马焦雷广场","与城市主广场相邻。","完整地名 Piazza Maggiore。"],
      ["h08","那句拱廊铭文 Panis Vita, Canabis Protectio, Vinum Laetitia 中，Vinum 指什么？","葡萄酒|wine|vino","它和面包、麻一起出现。","意大利语 vino。"],
      ["h09","同一句拉丁铭文的 Panis 指什么？","面包|bread|pane","它排在铭文最前。","意大利语 pane。"],
      ["h10","这句拱廊铭文位于哪条主街的起点？","via dell'indipendenza|via indipendenza|独立街","它与独立有关。","街名 Via dell'Indipendenza。"],
      ["h11","UniBo 的 Palazzo Poggi 校址在 Via 哪条街？","zamboni|via zamboni|赞博尼街","街名以 Z 开头。","完整地名 Via Zamboni。"],
      ["h12","Archiginnasio 曾是大学所在地，其正门地址在哪个广场？","piazza galvani|伽伐尼广场","广场名纪念一位意大利科学家。","地址 Piazza Galvani 1。"],
      ["h13","Salaborsa 玻璃地板下可见的遗迹，其中包括古代哪一时期的 Bononia？","罗马时期|古罗马|roman|roman bononia","想想 Bononia 这个拉丁名称。","Bologna Welcome 介绍为 Roman Bononia。"],
      ["h14","UniBo 官方称其为西方世界最古老的什么？","大学|university|università|universita","不是最古老的城市。","答案是 university。"],
      ["h15","UniBo 早期 Studium 与哪门学科的研究特别相关？","法律|法学|law|罗马法|roman law","想想中世纪的法条。","尤其与罗马法研究有关。"],
      ["h16","中世纪学生按来源组成的团体，拉丁名是什么？","nationes|nations","不是现代国家。","以 nation 开头，复数结尾 es。"],
      ["h17","保护赴博洛尼亚求学者的神圣罗马帝国皇帝，姓 Barbarossa；他的名字是？","frederick|federico|腓特烈|frederick i|federico i","中英文名字都与“腓特烈”对应。","完整常见称呼 Frederick I Barbarossa。"],
      ["h18","1888 年 UniBo 庆祝的是建校传统纪年的第多少周年？","800|八百|八百周年","从 1088 到 1888。","两年相减得到 800。"],
      ["h19","Archiginnasio 曾作大学校址，官方介绍称一直使用至哪一年？","1803|一八零三","十九世纪初。","十八之后接 03。"],
      ["h20","Archiginnasio 木质解剖剧场建于哪一年？","1637|一六三七","十七世纪上半叶。","年份前三位是 163，末位 7。"],
      ["h21","Bologna Welcome 介绍的经典绿色千层面，意大利语菜名是？","lasagne verdi|lasagne verdi alla bolognese|绿色千层面","颜色是关键。","lasagne 后面接 verdi。"],
      ["h22","Bologna Welcome 说当地肉酱经典搭配宽面，不是通常国外叫的哪种面？","spaghetti|意大利细面|意大利面条","英文海外菜单常写 Bolognese。","它以 spag 开头。"],
      ["h23","Bologna Welcome 的传统甜点清单中，以 tagliatelle 命名的蛋糕叫什么？","torta di tagliatelle|宽面蛋糕","菜名以 Torta 开头。","后面接 di tagliatelle。"],
      ["h24","Bologna Welcome 的传统食谱清单里，有一道 risotto con le rane；rane 是哪种动物？","青蛙|蛙|frogs|rane","名字和本站的黄色彩蛋有点缘分。","它会呱呱叫；意大利语复数 rane。"],
      ["h25","城市七个秘密的传说里，Asinelli 塔顶藏着一件破损的什么器物？","花瓶|瓶子|vase|broken vase","传说它象征争端解决。","英文叫 broken vase。"],
      ["h26","城市七个秘密里的 Palazzo del Podestà，声音是沿什么传播到对角？","墙壁|墙|拱壁|walls","不是手机信号。","两人对角低语，声音贴着墙走。"],
      ["h27","这个站点的五类地点数量顺序中，第三类有几张卡？","8|八","顺序从中餐、意餐到奶茶甜品。","数量依次 15、13、8、7、10。"],
      ["h28","首页显示的五个多人推荐徽标，确切有几个？","5|五","比三个额外秘密多两个。","一只手的手指数。"],
      ["h29","指南地点卡总共提供多少个 Google Maps 链接？","55|五十五","链接数量比地点卡略多。","53 张卡，地图链接多两个。"],
      ["h30","主页历史合作商家 JIAJIA、MIA、TANG 中，哪一家展示可展开的二维码？","jiajia|嘉嘉","它是三个名字里字母重复最多的。","答案是 JIAJIA（嘉嘉）。"]
    ]
  };
  var byId = {};
  Object.keys(rows).forEach(function (level) {
    rows[level] = rows[level].map(function (row) {
      var answers = row[2].split("|");
      var item = { id: row[0], level: level, question: row[1], answers: answers,
        hints: [row[3], row[4], "答案：" + answers[0] + "。"] };
      byId[item.id] = item;
      return item;
    });
  });
  return { levels: rows, byId: byId };
});

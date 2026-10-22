(function (global, factory) {
  "use strict";
  var arcade = factory();
  if (typeof module === "object" && module.exports) module.exports = arcade;
  global.BolognaHalloweenArcade = arcade;
  if (global.document) {
    var boot = function () { arcade.mount(global.document, global); };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STORAGE_KEY = "bologna-students.halloween-arcade.2026.production.v1";
  var PUZZLE_RUN_KEY = STORAGE_KEY + ".puzzle-run.v1";

  function seasonPhase(date) {
    try {
      var values = {};
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(date || new Date()).forEach(function (part) { values[part.type] = Number(part.value); });
      if (values.year !== 2026) return "normal";
      if (values.month === 10 && values.day >= 20) return "halloween";
      if (values.month === 11) return "afterparty";
      if (values.month === 12) return "read-only";
      return "normal";
    } catch (_) {
      return "normal";
    }
  }

  function scoreTime(elapsedMilliseconds) {
    var actual = Math.max(0, elapsedMilliseconds / 1000);
    return { actual: actual, error: Math.abs(actual - 10) };
  }

  function pumpkinPosition(elapsedSeconds, shotIndex, reducedMotion) {
    if (reducedMotion) {
      var stations = [0.18, 0.5, 0.82, 0.32, 0.68, 0.5, 0.84, 0.24, 0.56, 0.16, 0.5, 0.76];
      var step = Math.floor(Math.max(0, elapsedSeconds) / 0.9);
      return stations[(step + shotIndex) % stations.length];
    }
    return 0.5 + 0.35 * Math.sin(Math.max(0, elapsedSeconds) * 1.55 + shotIndex * 0.37);
  }

  function scoreCandyThrow(elapsedSeconds, shotIndex, reducedMotion) {
    var impactDelay = 0.58;
    var position = pumpkinPosition(elapsedSeconds + impactDelay, shotIndex, reducedMotion);
    var distance = Math.abs(position - 0.5);
    var tolerance = Math.max(0.075, 0.135 - shotIndex * 0.006);
    var points = distance > tolerance ? 0 : (distance <= tolerance * 0.34 ? 2 : 1);
    return { points: points, distance: distance, targetPosition: position, tolerance: tolerance };
  }

  function normalizeAnswer(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("zh-CN")
      .replace(/[\s,.;!?，。！？:：/·_\-’'"()（）]/g, "");
  }

  function acceptsAnswer(value, accepted) {
    var answer = normalizeAnswer(value);
    return !!answer && accepted.some(function (item) { return answer === normalizeAnswer(item); });
  }

  function safeRead(storage, key) {
    try {
      var raw = storage.getItem(key);
      return { value: raw ? JSON.parse(raw) : null, persistent: true };
    } catch (_) {
      return { value: null, persistent: false };
    }
  }

  function safeWrite(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  var fallbackPuzzles = [
    {
      question: "第一枚线索：Bologna 的万圣夜里，南瓜灯来自一种蔬菜。它的意大利语名字是什么？",
      answers: ["zucca"],
      hints: ["答案的首字母是意大利语 z。", "这种橙色蔬菜会被雕刻成灯。", "意大利语的 pumpkin 是 zucca。"]
    },
    {
      question: "第二枚线索：UniBo 官方历史介绍中，传统上常用哪一年作为 Studium of Bologna 的起源年份？",
      answers: ["1088", "一零八八"],
      hints: ["这是一个四位数，落在十一世纪末。", "UniBo 历史页把传统纪年放在一千零八十年代。", "答案是 1088。"]
    },
    {
      question: "最后一枚线索：生活指南顶部有一类恰好收录 7 个地点。它是哪一类？",
      answers: ["超市/生活", "超市生活", "supermarkets/life", "supermarket/life"],
      hints: ["最后一条线索藏在生活指南入口那排分类数字里。", "数字依次是 15、13、8、7、10；找出 7 对应的分类。", "答案是「超市/生活」。"]
    }
  ];

  function mount(document, window) {
    var app = document.getElementById("arcade-app");
    var closed = document.getElementById("arcade-closed");
    if (!app || !closed) return;

    var phase = seasonPhase(new Date());
    var readOnly = phase === "read-only";
    var active = phase === "halloween" || phase === "afterparty" || readOnly;
    document.documentElement.classList.toggle("arcade-active", phase === "halloween" || phase === "afterparty");
    document.documentElement.classList.toggle("arcade-readonly", readOnly);
    app.hidden = !active;
    closed.hidden = active;
    if (!active) return;

    function applyReadOnlyView() {
      app.hidden = false;
      closed.hidden = true;
      document.documentElement.classList.remove("arcade-active", "arcade-readonly");
      document.documentElement.classList.add("arcade-readonly");
      app.querySelectorAll(".player-panel, .game-jump, .game-card, .share-section").forEach(function (element) { element.hidden = true; });
      var title = document.getElementById("arcade-title");
      var copy = document.getElementById("arcade-hero-copy");
      var joinTitle = document.getElementById("ranking-join-heading");
      var joinCopy = document.getElementById("ranking-join-copy");
      var label = document.getElementById("season-label");
      if (title) title.textContent = "南瓜灯熄灭了，战绩还留在这里";
      if (copy) copy.textContent = "本季游戏和新成绩提交已关闭。公开榜单只读至 2026 年 12 月 31 日（Europe/Rome）；之后按说明清理身份与成绩。";
      if (joinTitle) joinTitle.textContent = "本季榜单已进入只读期";
      if (joinCopy) joinCopy.textContent = "不能创建新身份、修改昵称或提交新成绩。已有参赛者仍可查看战绩、恢复身份或删除资料。";
      if (label) label.textContent = "PUBLIC SCORE ARCHIVE · DEC 2026";
    }

    function closeArchiveView() {
      app.hidden = true;
      closed.hidden = false;
      document.documentElement.classList.remove("arcade-active", "arcade-readonly");
    }

    function emitRankingEvent(name, detail) {
      try { document.dispatchEvent(new window.CustomEvent(name, { detail: detail || {} })); }
      catch (_) { /* Optional ranking integration must never block local play. */ }
    }

    var seasonLabel = document.getElementById("season-label");
    if (seasonLabel) seasonLabel.textContent = readOnly ? "PUBLIC SCORE ARCHIVE · DEC 2026" : phase === "afterparty" ? "HALLOWEEN AFTERPARTY · NOV 2026" : "HALLOWEEN ARCADE · OCT 2026";
    if (readOnly) {
      applyReadOnlyView();
      var archiveTimer = window.setInterval(function () { if (seasonPhase(new Date()) === "normal") { window.clearInterval(archiveTimer); closeArchiveView(); } }, 60000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden && seasonPhase(new Date()) === "normal") { window.clearInterval(archiveTimer); closeArchiveView(); } });
      window.addEventListener("pageshow", function () { if (seasonPhase(new Date()) === "normal") { window.clearInterval(archiveTimer); closeArchiveView(); } });
      window.addEventListener("focus", function () { if (seasonPhase(new Date()) === "normal") { window.clearInterval(archiveTimer); closeArchiveView(); } });
      return;
    }

    var memoryStorage = {};
    var storageAvailable = true;
    var storage;
    try { storage = window.localStorage; storage.getItem(STORAGE_KEY); }
    catch (_) { storageAvailable = false; storage = {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null; },
      setItem: function (key, value) { memoryStorage[key] = value; }
    }; }
    var loaded = safeRead(storage, STORAGE_KEY);
    var persistentStorage = storageAvailable && loaded.persistent;
    storageAvailable = persistentStorage;
    var saved = loaded.value && typeof loaded.value === "object" ? loaded.value : {};
    var record = {
      nickname: cleanNickname(saved.nickname || "南瓜观察员"),
      time: validTimeRecord(saved.time),
      candy: validCandyRecord(saved.candy),
      puzzleCompleted: saved.puzzleCompleted === true
    };
    var storageNote = document.getElementById("storage-note");
    var nicknameInput = document.getElementById("player-nickname");
    var timeRecord = document.getElementById("record-time");
    var candyRecord = document.getElementById("record-candy");
    var puzzleRecord = document.getElementById("record-puzzle");
    var shareCard = document.getElementById("share-card");

    function cleanNickname(value) {
      return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "南瓜观察员";
    }
    function validTimeRecord(value) {
      if (!value || typeof value !== "object") return null;
      if (!Number.isFinite(value.actual) || !Number.isFinite(value.error) || value.actual < 0 || value.error < 0) return null;
      return { actual: value.actual, error: value.error };
    }
    function validCandyRecord(value) {
      if (!value || typeof value !== "object" || !Number.isInteger(value.score) || value.score < 0 || value.score > 20) return null;
      return { score: value.score };
    }
    function persist() {
      storageAvailable = persistentStorage && safeWrite(storage, STORAGE_KEY, record);
      if (storageNote) storageNote.textContent = storageAvailable
        ? "个人最佳记录只保存在本机，不是所有玩家共享的排行榜。"
        : "浏览器不允许本地存储；本页仍可玩，但关闭页面后记录可能丢失。";
    }
    function renderRecords() {
      if (nicknameInput && document.activeElement !== nicknameInput) nicknameInput.value = record.nickname;
      if (timeRecord) timeRecord.textContent = record.time ? record.time.error.toFixed(2) + " 秒误差" : "尚无纪录";
      if (candyRecord) candyRecord.textContent = record.candy ? record.candy.score + " 分 / 20" : "尚无纪录";
      if (puzzleRecord) puzzleRecord.textContent = record.puzzleCompleted ? "已通关" : "尚未通关";
      if (storageNote && !storageAvailable) storageNote.textContent = "浏览器不允许本地存储；本页仍可玩，但关闭页面后记录可能丢失。";
    }
    function makeShareCard() {
      var name = document.getElementById("share-name");
      var time = document.getElementById("share-time");
      var candy = document.getElementById("share-candy");
      var puzzle = document.getElementById("share-puzzle");
      if (name) name.textContent = record.nickname;
      if (time) time.textContent = record.time ? record.time.actual.toFixed(2) + " s · ±" + record.time.error.toFixed(2) + " s" : "尚无纪录";
      if (candy) candy.textContent = record.candy ? record.candy.score + " / 20" : "尚无纪录";
      if (puzzle) puzzle.textContent = record.puzzleCompleted ? "谜团已解" : "尚未通关";
      if (shareCard) shareCard.hidden = false;
    }
    function cleanAndSave() { record.nickname = cleanNickname(nicknameInput ? nicknameInput.value : record.nickname); persist(); renderRecords(); }
    var saveName = document.getElementById("save-nickname");
    if (saveName) saveName.addEventListener("click", cleanAndSave);
    if (nicknameInput) nicknameInput.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); cleanAndSave(); nicknameInput.blur(); } });
    var cardButton = document.getElementById("make-share-card");
    if (cardButton) cardButton.addEventListener("click", makeShareCard);

    // Game 1: performance.now() measures the real elapsed interval; no visible ticking timer runs.
    var timeStart = document.getElementById("time-start");
    var timeStop = document.getElementById("time-stop");
    var timeReset = document.getElementById("time-reset");
    var timeStatus = document.getElementById("time-status");
    var timeAttempts = document.getElementById("time-attempts");
    var roundBest = document.getElementById("time-round-best");
    var timerDisplay = document.getElementById("timer-display");
    var timeStartedAt = null;
    var timeResults = [];
    function renderTimeRound() {
      if (!timeAttempts) return;
      Array.prototype.forEach.call(timeAttempts.children, function (item, index) {
        var attempt = timeResults[index];
        item.classList.toggle("is-best", !!attempt && attempt === bestAttempt(timeResults));
        item.textContent = attempt
          ? "第 " + (index + 1) + " 次：" + attempt.actual.toFixed(2) + " 秒 · 偏差 " + attempt.error.toFixed(2)
          : "第 " + (index + 1) + " 次：待挑战";
      });
      if (roundBest) {
        var best = bestAttempt(timeResults);
        roundBest.textContent = best ? best.actual.toFixed(2) + " 秒（偏差 " + best.error.toFixed(2) + "）" : "—";
      }
    }
    function startTime() {
      if (timeStartedAt !== null || timeResults.length >= 3) return;
      if (timeResults.length === 0) emitRankingEvent("bologna:arcade-game-start", { game: "time" });
      timeStartedAt = window.performance.now();
      if (timerDisplay) timerDisplay.textContent = "••••";
      if (timeStatus) timeStatus.textContent = "计时中。准备好后按「停止」。";
      if (timeStart) timeStart.disabled = true;
      if (timeStop) { timeStop.disabled = false; timeStop.focus(); }
    }
    function stopTime() {
      if (timeStartedAt === null) return;
      var measured = scoreTime(window.performance.now() - timeStartedAt);
      timeStartedAt = null;
      if (timerDisplay) timerDisplay.textContent = "STOP";
      timeResults.push(measured);
      renderTimeRound();
      if (timeStart) timeStart.disabled = timeResults.length >= 3;
      if (timeStop) timeStop.disabled = true;
      if (timeStatus) timeStatus.textContent = "实际 " + measured.actual.toFixed(2) + " 秒，距离 10.00 秒偏差 " + measured.error.toFixed(2) + " 秒。";
      if (timeResults.length === 3) {
        var best = bestAttempt(timeResults);
        if (!record.time || best.error < record.time.error) {
          record.time = { actual: best.actual, error: best.error };
          persist();
          makeShareCard();
        }
        if (timeStatus) timeStatus.textContent += " 本轮最佳：" + best.actual.toFixed(2) + " 秒。";
        if (timeReset) timeReset.textContent = "再来一轮";
        renderRecords();
        emitRankingEvent("bologna:arcade-score", {
          game: "time",
          result: { attemptsUs: timeResults.map(function (item) { return Math.round(item.actual * 1000000); }) }
        });
      } else if (timeStatus) {
        timeStatus.textContent += " 还剩 " + (3 - timeResults.length) + " 次。";
      }
    }
    function resetTime() {
      timeStartedAt = null;
      timeResults = [];
      if (timeStart) timeStart.disabled = false;
      if (timeStop) timeStop.disabled = true;
      if (timeReset) timeReset.textContent = "重新开始";
      if (timerDisplay) timerDisplay.textContent = "READY";
      if (timeStatus) timeStatus.textContent = "准备好后按「开始计时」。";
      renderTimeRound();
    }
    function bestAttempt(results) { return results.length ? results.reduce(function (best, item) { return !best || item.error < best.error ? item : best; }, null) : null; }
    if (timeStart) timeStart.addEventListener("click", startTime);
    if (timeStop) timeStop.addEventListener("click", stopTime);
    if (timeReset) timeReset.addEventListener("click", resetTime);

    // Game 2: a normalized timing game. Only this card's canvas animates while a round is active.
    var canvas = document.getElementById("candy-stage");
    var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    var candyStart = document.getElementById("candy-start");
    var candyThrow = document.getElementById("candy-throw");
    var candyReset = document.getElementById("candy-reset");
    var candyShots = document.getElementById("candy-shots");
    var candyScore = document.getElementById("candy-score");
    var candyStatus = document.getElementById("candy-status");
    var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reducedMotion = !!(reduceQuery && reduceQuery.matches);
    var candyState = { active: false, shots: 0, score: 0, shotsMs: [], startedAt: 0, throwing: null, frame: null, motionTimer: null, throwTimer: null, hiddenAt: null };
    function currentTime() { return window.performance.now(); }
    function elapsedGameSeconds(now) { return Math.max(0, ((now || currentTime()) - candyState.startedAt) / 1000); }
    function resizeCanvas() {
      if (!canvas || !ctx) return;
      var rect = canvas.getBoundingClientRect();
      var width = Math.max(280, rect.width || 800);
      var ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(width * 0.5 * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawCandyStage(currentTime());
    }
    function drawCandyStage(now) {
      if (!ctx || !canvas) return;
      var width = canvas.width / Math.min(2, window.devicePixelRatio || 1);
      var height = width * .5;
      if (width < 10) { width = 800; height = 400; }
      ctx.clearRect(0, 0, width, height);
      var sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#241c30"); sky.addColorStop(1, "#100e17");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      var moon = ctx.createRadialGradient(width * .17, height * .22, 2, width * .17, height * .22, height * .19);
      moon.addColorStop(0, "rgba(255,225,174,.7)"); moon.addColorStop(.18, "rgba(233,181,118,.14)"); moon.addColorStop(1, "rgba(233,181,118,0)");
      ctx.fillStyle = moon; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(247,224,187,.45)";
      [[.1,.25,1.4],[.29,.12,1],[.79,.18,1.2],[.93,.3,.8],[.64,.31,.7]].forEach(function (star) { ctx.beginPath(); ctx.arc(width * star[0], height * star[1], star[2], 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = "rgba(231,190,143,.18)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(width * .5, height * .45); ctx.lineTo(width * .5, height * .88); ctx.stroke();
      ctx.fillStyle = "#1b3027"; ctx.beginPath(); ctx.moveTo(0, height * .83); ctx.quadraticCurveTo(width * .23, height * .71, width * .48, height * .84); ctx.quadraticCurveTo(width * .75, height * .72, width, height * .82); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();

      var elapsed = candyState.active ? elapsedGameSeconds(now) : 0;
      var pumpkinX = width * pumpkinPosition(elapsed, candyState.shots, reducedMotion);
      drawPumpkin(pumpkinX, height * .56, Math.min(width, height) * .145);
      drawCandyShooter(width * .5, height * .84, Math.min(width, height) * .052);
      if (candyState.throwing) {
        var progress = reducedMotion ? 1 : Math.min(1, (now - candyState.throwing.startedAt) / 430);
        var x = width * .5;
        var y = height * (.83 - .31 * progress - .12 * Math.sin(progress * Math.PI));
        drawCandy(x, y, Math.min(width, height) * .042);
      }
      if (!candyState.active) {
        ctx.fillStyle = "rgba(255,241,221,.78)"; ctx.font = "600 15px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("按开始，等灯靠近中间", width * .5, height * .95);
      }
    }
    function drawPumpkin(x, y, radius) {
      ctx.save(); ctx.translate(x, y); ctx.shadowColor = "rgba(248,147,61,.5)"; ctx.shadowBlur = Math.max(4, radius * .65);
      var fill = ctx.createRadialGradient(-radius * .25, -radius * .3, 2, 0, 0, radius * 1.35);
      fill.addColorStop(0, "#ffc265"); fill.addColorStop(.45, "#ee843b"); fill.addColorStop(1, "#a6422d");
      ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, 0, radius * .86, radius * .72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(120,48,35,.56)"; ctx.lineWidth = Math.max(1, radius * .08);
      [-.42, 0, .42].forEach(function (offset) { ctx.beginPath(); ctx.ellipse(offset * radius, 0, radius * .27, radius * .68, offset * .16, -1.3, 1.3); ctx.stroke(); });
      ctx.fillStyle = "#5e4a31"; ctx.fillRect(-radius * .12, -radius * .88, radius * .24, radius * .28);
      ctx.fillStyle = "#311927"; ctx.beginPath(); ctx.moveTo(-radius * .47, -radius * .12); ctx.lineTo(-radius * .25, -radius * .25); ctx.lineTo(-radius * .18, -radius * .04); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(radius * .47, -radius * .12); ctx.lineTo(radius * .25, -radius * .25); ctx.lineTo(radius * .18, -radius * .04); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-radius * .43, radius * .17); ctx.quadraticCurveTo(0, radius * .53, radius * .43, radius * .17); ctx.lineTo(radius * .34, radius * .4); ctx.lineTo(-radius * .34, radius * .4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawCandy(x, y, radius) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.15);
      ctx.fillStyle = "#f6d898"; ctx.strokeStyle = "#fff0d5"; ctx.lineWidth = Math.max(1, radius * .08);
      ctx.beginPath(); ctx.moveTo(-radius * .36, -radius * .15); ctx.lineTo(-radius * .88, -radius * .52); ctx.lineTo(-radius * .75, radius * .25); ctx.lineTo(-radius * .3, radius * .17); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(radius * .36, -radius * .15); ctx.lineTo(radius * .88, -radius * .52); ctx.lineTo(radius * .75, radius * .25); ctx.lineTo(radius * .3, radius * .17); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#d96f46"; ctx.beginPath(); ctx.arc(0, 0, radius * .47, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,242,213,.58)"; ctx.beginPath(); ctx.arc(-radius * .14, -radius * .16, radius * .13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    function drawCandyShooter(x, y, radius) {
      ctx.fillStyle = "rgba(241,205,160,.55)"; ctx.beginPath(); ctx.ellipse(x, y, radius * 1.1, radius * .38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#eab86e"; ctx.beginPath(); ctx.arc(x, y - radius * .5, radius * .48, Math.PI, 0); ctx.lineTo(x + radius * .48, y); ctx.lineTo(x - radius * .48, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#a95a3b"; ctx.fillRect(x - radius * .48, y, radius * .96, radius * .42);
    }
    function stopCanvasLoop() {
      if (candyState.frame !== null && window.cancelAnimationFrame) window.cancelAnimationFrame(candyState.frame);
      if (candyState.motionTimer !== null) window.clearInterval(candyState.motionTimer);
      candyState.frame = null; candyState.motionTimer = null;
    }
    function startCanvasLoop() {
      stopCanvasLoop();
      if (!candyState.active || document.hidden) return;
      if (reducedMotion) {
        drawCandyStage(currentTime());
        candyState.motionTimer = window.setInterval(function () { drawCandyStage(currentTime()); }, 250);
      } else {
        var tick = function (now) { drawCandyStage(now); if (candyState.active && !document.hidden) candyState.frame = window.requestAnimationFrame(tick); };
        candyState.frame = window.requestAnimationFrame(tick);
      }
    }
    function updateCandyLabels() {
      if (candyShots) candyShots.textContent = candyState.shots + " / 10";
      if (candyScore) candyScore.textContent = String(candyState.score);
      if (candyThrow) candyThrow.disabled = !candyState.active || !!candyState.throwing;
    }
    function finishCandyThrow() {
      if (!candyState.throwing) return;
      var result = candyState.throwing.result;
      candyState.throwing = null;
      candyState.shots += 1;
      candyState.score += result.points;
      if (candyStatus) candyStatus.textContent = result.points
        ? (result.points === 2 ? "漂亮！糖果落进灯芯，精准 +2。" : "投中了南瓜灯，+1。")
        : "差一点，糖果滚到南瓜旁边了。";
      updateCandyLabels();
      if (candyState.shots >= 10) {
        candyState.active = false;
        stopCanvasLoop();
        if (!record.candy || candyState.score > record.candy.score) {
          record.candy = { score: candyState.score };
          persist(); makeShareCard();
        }
        if (candyStatus) candyStatus.textContent += " 本局 " + candyState.score + " / 20 分。";
        if (candyStart) { candyStart.disabled = false; candyStart.textContent = "再玩一局"; }
        if (candyThrow) candyThrow.disabled = true;
        emitRankingEvent("bologna:arcade-score", {
          game: "candy",
          result: { shotsMs: candyState.shotsMs.slice(), reducedMotion: reducedMotion }
        });
      } else {
        updateCandyLabels();
        startCanvasLoop();
      }
      drawCandyStage(currentTime());
    }
    function throwCandy() {
      if (!candyState.active || candyState.throwing) return;
      var elapsedMs = elapsedGameSeconds() * 1000;
      var result = scoreCandyThrow(elapsedMs / 1000, candyState.shots, reducedMotion);
      candyState.shotsMs.push(Math.round(elapsedMs));
      candyState.throwing = { result: result, startedAt: currentTime() };
      if (candyStatus) candyStatus.textContent = "糖果飞向灯芯……";
      updateCandyLabels();
      if (candyState.throwTimer !== null) window.clearTimeout(candyState.throwTimer);
      candyState.throwTimer = window.setTimeout(function () { candyState.throwTimer = null; finishCandyThrow(); }, reducedMotion ? 120 : 460);
      if (reducedMotion) drawCandyStage(currentTime());
    }
    function resetCandy() {
      stopCanvasLoop();
      if (candyState.throwTimer !== null) window.clearTimeout(candyState.throwTimer);
      candyState.throwTimer = null;
      candyState = { active: false, shots: 0, score: 0, shotsMs: [], startedAt: 0, throwing: null, frame: null, motionTimer: null, throwTimer: null, hiddenAt: null };
      updateCandyLabels();
      if (candyStart) { candyStart.disabled = false; candyStart.textContent = "开始投篮"; }
      if (candyStatus) candyStatus.textContent = "开始后南瓜灯才会移动；不会播放声音。";
      drawCandyStage(currentTime());
    }
    if (ctx && candyStart && candyThrow && candyReset) {
      resizeCanvas();
      if (window.ResizeObserver) new window.ResizeObserver(resizeCanvas).observe(canvas);
      else window.addEventListener("resize", resizeCanvas);
      candyStart.addEventListener("click", function () {
        if (candyState.active) return;
        resetCandy();
        emitRankingEvent("bologna:arcade-game-start", { game: "candy" });
        candyState.active = true;
        candyState.startedAt = currentTime();
        candyStart.disabled = true;
        candyStart.textContent = "游戏进行中";
        candyState.shots = 0; candyState.score = 0;
        if (candyStatus) candyStatus.textContent = "等南瓜靠近中线，再点投糖果。";
        updateCandyLabels(); startCanvasLoop();
      });
      candyThrow.addEventListener("click", throwCandy);
      candyReset.addEventListener("click", resetCandy);
      if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener("change", function (event) {
        reducedMotion = !!event.matches;
        if (candyState.active) startCanvasLoop(); else drawCandyStage(currentTime());
      });
    } else if (candyStatus) {
      candyStatus.textContent = "当前浏览器无法绘制游戏画面，请尝试更新浏览器。";
      if (candyStart) candyStart.disabled = true;
      if (candyThrow) candyThrow.disabled = true;
    }

    document.addEventListener("visibilitychange", function () {
      if (!candyState.active) {
        if (document.hidden && timeStartedAt !== null) {
          timeStartedAt = null;
          if (timeStart) timeStart.disabled = timeResults.length >= 3;
          if (timeStop) timeStop.disabled = true;
          if (timerDisplay) timerDisplay.textContent = "READY";
          if (timeStatus) timeStatus.textContent = "切换离开页面，当前计时已取消，没有计入次数。";
        }
        return;
      }
      if (document.hidden) {
        candyState.hiddenAt = currentTime();
        stopCanvasLoop();
        if (candyState.throwTimer !== null) { window.clearTimeout(candyState.throwTimer); candyState.throwTimer = null; }
      } else if (candyState.hiddenAt !== null) {
        var paused = currentTime() - candyState.hiddenAt;
        candyState.startedAt += paused;
        if (candyState.throwing) candyState.throwing.startedAt += paused;
        candyState.hiddenAt = null;
        if (candyState.throwing) {
          var remaining = Math.max(0, (reducedMotion ? 120 : 460) - (currentTime() - candyState.throwing.startedAt));
          candyState.throwTimer = window.setTimeout(function () { candyState.throwTimer = null; finishCandyThrow(); }, remaining);
        }
        startCanvasLoop();
      }
    });

    // Game 3: one persistent draw per tier; public score remains three correct answers.
    var puzzlePanel = document.getElementById("puzzle-panel");
    var puzzleQuestion = document.getElementById("puzzle-question");
    var puzzleAnswer = document.getElementById("puzzle-answer");
    var puzzleSubmit = document.getElementById("puzzle-submit");
    var puzzleHint = document.getElementById("puzzle-hint");
    var hintText = document.getElementById("puzzle-hint-text");
    var hintLevel = document.getElementById("hint-level");
    var puzzleStatus = document.getElementById("puzzle-status");
    var puzzleProgress = document.getElementById("puzzle-progress");
    var puzzleComplete = document.getElementById("puzzle-complete");
    var puzzleReplay = document.getElementById("puzzle-replay");
    var bank = window.BolognaHalloweenPuzzles;
    var tiers = ["easy", "medium", "hard"];
    var validBank = !!bank && tiers.every(function (tier) { return bank.levels[tier] && bank.levels[tier].length === 30; });
    function validRun(value) {
      return validBank && value && Array.isArray(value.ids) && value.ids.length === 3 &&
        Number.isInteger(value.index) && value.index >= 0 && value.index <= 3 &&
        Number.isInteger(value.hintsUsed) && value.hintsUsed >= 0 && value.hintsUsed <= 3 &&
        value.ids.every(function (id, index) { return bank.byId[id] && bank.byId[id].level === tiers[index]; }) &&
        new Set(value.ids).size === 3;
    }
    function randomIndex(length) {
      if (window.crypto && window.crypto.getRandomValues) {
        var number = new Uint32Array(1);
        window.crypto.getRandomValues(number);
        return number[0] % length;
      }
      return Math.floor(Math.random() * length);
    }
    function drawRun(previous) {
      if (!validBank) return { ids: [], index: 0, hintsUsed: 0 };
      return { ids: tiers.map(function (tier, index) {
        var candidates = bank.levels[tier].filter(function (item) { return !previous || item.id !== previous.ids[index]; });
        return candidates[randomIndex(candidates.length)].id;
      }), index: 0, hintsUsed: 0 };
    }
    function storeRun() { if (validBank) safeWrite(storage, PUZZLE_RUN_KEY, puzzleRun); }
    var remembered = safeRead(storage, PUZZLE_RUN_KEY).value;
    var puzzleRun = validRun(remembered) ? remembered : drawRun(null);
    var puzzles = validBank ? puzzleRun.ids.map(function (id) { return bank.byId[id]; }) : fallbackPuzzles;
    var puzzleIndex = validBank ? (record.puzzleCompleted || remembered ? puzzleRun.index : 0) : (record.puzzleCompleted ? 3 : 0);
    if (validBank && !validRun(remembered)) {
      puzzleRun.index = record.puzzleCompleted ? 3 : 0;
      storeRun();
      puzzleIndex = puzzleRun.index;
    }
    var hintsUsed = validBank ? puzzleRun.hintsUsed : 0;
    var puzzleChallengeRequested = false;
    function beginPuzzleChallenge() {
      if (puzzleChallengeRequested) return;
      puzzleChallengeRequested = true;
      emitRankingEvent("bologna:arcade-game-start", { game: "puzzle" });
    }
    function renderPuzzle() {
      if (puzzleIndex >= puzzles.length) {
        if (puzzlePanel) puzzlePanel.hidden = true;
        if (puzzleComplete) puzzleComplete.hidden = false;
        if (puzzleProgress) puzzleProgress.textContent = "3 / 3 关完成";
        return;
      }
      if (puzzlePanel) puzzlePanel.hidden = false;
      if (puzzleComplete) puzzleComplete.hidden = true;
      if (puzzleQuestion) puzzleQuestion.textContent = puzzles[puzzleIndex].question;
      if (puzzleAnswer) { puzzleAnswer.value = ""; puzzleAnswer.disabled = false; }
      if (puzzleSubmit) puzzleSubmit.disabled = false;
      if (puzzleHint) { puzzleHint.disabled = hintsUsed >= 3; puzzleHint.textContent = "给我一条提示"; }
      if (hintText) { hintText.hidden = hintsUsed === 0; hintText.textContent = hintsUsed ? puzzles[puzzleIndex].hints[hintsUsed - 1] : ""; }
      if (hintLevel) hintLevel.textContent = "提示 " + hintsUsed + " / 3";
      if (puzzleStatus) puzzleStatus.textContent = "不确定时可以逐级看提示。";
      if (puzzleProgress) puzzleProgress.textContent = "第 " + (puzzleIndex + 1) + " / 3 关";
    }
    function submitPuzzle() {
      if (puzzleIndex >= puzzles.length || !puzzleAnswer) return;
      beginPuzzleChallenge();
      if (acceptsAnswer(puzzleAnswer.value, puzzles[puzzleIndex].answers)) {
        puzzleStatus.textContent = "答对了，线索已收好。";
        puzzleIndex += 1; hintsUsed = 0;
        if (validBank) { puzzleRun.index = puzzleIndex; puzzleRun.hintsUsed = 0; storeRun(); }
        if (puzzleIndex >= puzzles.length) {
          record.puzzleCompleted = true;
          persist(); makeShareCard(); renderRecords();
          emitRankingEvent("bologna:arcade-score", { game: "puzzle", result: { completed: true } });
        }
        renderPuzzle();
      } else {
        puzzleStatus.textContent = puzzleAnswer.value.trim() ? "还差一点，再想想或查看下一条提示。" : "先写下一个答案吧。";
        puzzleAnswer.focus();
      }
    }
    if (puzzleSubmit) puzzleSubmit.addEventListener("click", submitPuzzle);
    if (puzzleAnswer) puzzleAnswer.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); submitPuzzle(); } });
    if (puzzleHint) puzzleHint.addEventListener("click", function () {
      if (puzzleIndex >= puzzles.length) return;
      beginPuzzleChallenge();
      if (hintsUsed < 3) hintsUsed += 1;
      if (validBank) { puzzleRun.hintsUsed = hintsUsed; storeRun(); }
      hintLevel.textContent = "提示 " + hintsUsed + " / 3";
      hintText.textContent = puzzles[puzzleIndex].hints[hintsUsed - 1];
      hintText.hidden = false;
      if (hintsUsed >= 3) puzzleHint.disabled = true;
    });
    if (puzzleReplay) puzzleReplay.addEventListener("click", function () {
      if (validBank) { puzzleRun = drawRun(puzzleRun); puzzles = puzzleRun.ids.map(function (id) { return bank.byId[id]; }); storeRun(); }
      puzzleIndex = 0; hintsUsed = 0; puzzleChallengeRequested = false; beginPuzzleChallenge(); renderPuzzle();
    });
    if (puzzleAnswer) puzzleAnswer.addEventListener("focus", beginPuzzleChallenge);

    renderRecords();
    if (puzzleIndex >= puzzles.length) {
      puzzleIndex = puzzles.length;
      renderPuzzle();
    } else renderPuzzle();
    if (!storageAvailable && storageNote) storageNote.textContent = "浏览器不允许本地存储；本页仍可玩，但关闭页面后记录可能丢失。";

    var seasonTimer = null;
    function closeSeason() {
      if (app.hidden) return;
      app.hidden = true;
      closed.hidden = false;
      document.documentElement.classList.remove("arcade-active", "arcade-readonly");
      timeStartedAt = null;
      if (timeStart) timeStart.disabled = true;
      if (timeStop) timeStop.disabled = true;
      resetCandy();
      if (seasonTimer !== null) { window.clearInterval(seasonTimer); seasonTimer = null; }
    }
    function checkSeason() {
      var currentPhase = seasonPhase(new Date());
      if (currentPhase === "normal") { closeSeason(); return; }
      if (currentPhase === "read-only") {
        if (!document.documentElement.classList.contains("arcade-readonly")) {
          timeStartedAt = null;
          if (timeStart) timeStart.disabled = true;
          if (timeStop) timeStop.disabled = true;
          if (candyState) resetCandy();
          applyReadOnlyView();
        }
        return;
      }
      if (seasonLabel) seasonLabel.textContent = currentPhase === "afterparty" ? "HALLOWEEN AFTERPARTY · NOV 2026" : "HALLOWEEN ARCADE · OCT 2026";
    }
    seasonTimer = window.setInterval(checkSeason, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) checkSeason(); });
    window.addEventListener("pageshow", checkSeason);
    window.addEventListener("focus", checkSeason);
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    seasonPhase: seasonPhase,
    scoreTime: scoreTime,
    pumpkinPosition: pumpkinPosition,
    scoreCandyThrow: scoreCandyThrow,
    normalizeAnswer: normalizeAnswer,
    acceptsAnswer: acceptsAnswer,
    safeRead: safeRead,
    safeWrite: safeWrite,
    mount: mount
  };
});

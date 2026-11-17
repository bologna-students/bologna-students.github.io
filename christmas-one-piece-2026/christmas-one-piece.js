(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document === "object") api.mount(document);
})(typeof globalThis === "object" ? globalThis : this, function () {
  const SYMBOLS = ["✦", "◒", "⚓", "☼", "◇", "✧", "♧", "☽"];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const progressAt = (startedAt, now, duration) => clamp((now - startedAt) / duration, 0, 1);
  const reducedMotion = (windowObject) =>
    Boolean(windowObject && windowObject.matchMedia &&
      windowObject.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function mount(documentObject) {
    const canvas = documentObject.getElementById("tree-canvas");
    const pauseButton = documentObject.getElementById("pause-button");
    const replayButton = documentObject.getElementById("replay-button");
    const reveal = documentObject.getElementById("reveal");
    const status = documentObject.getElementById("status");
    if (!canvas || !pauseButton || !replayButton || !reveal || !status) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const windowObject = documentObject.defaultView;
    let paused = false;
    let startedAt = performance.now();
    let frameId = 0;
    let particles = [];

    function resize() {
      const ratio = Math.min(windowObject.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 500;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: 170 }, (_, index) => {
        const row = index / 169;
        const y = 42 + row * (height * .8);
        const widthAtRow = 18 + row * width * .75;
        return {
          x: width / 2 + (Math.random() - .5) * widthAtRow,
          y,
          symbol: SYMBOLS[index % SYMBOLS.length],
          color: index % 4 ? "#f6c453" : "#70c4d2",
          size: 9 + (index % 4) * 2,
          phase: Math.random() * Math.PI * 2
        };
      });
    }

    function draw(now) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const progress = reducedMotion(windowObject) ? 1 : progressAt(startedAt, now, 5200);
      context.clearRect(0, 0, width, height);
      context.textAlign = "center";
      particles.forEach((particle, index) => {
        const gathered = progress > .58;
        const targetX = width / 2 + Math.sin(index * 2.4) * (10 + (index % 7) * 2);
        const targetY = height * .13 + (index % 25) * 13;
        const x = gathered ? targetX : particle.x;
        const y = gathered ? targetY : particle.y;
        const twinkle = reducedMotion(windowObject) ? 1 : .75 + Math.sin(now / 310 + particle.phase) * .25;
        context.globalAlpha = twinkle;
        context.fillStyle = particle.color;
        context.font = `${particle.size}px serif`;
        context.fillText(particle.symbol, x, y);
      });
      context.globalAlpha = 1;
      context.strokeStyle = "#d85b4e";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(width / 2, height * .15);
      context.lineTo(width / 2 - 28, height * .86);
      context.lineTo(width / 2 + 28, height * .86);
      context.closePath();
      context.stroke();
      if (progress > .72) {
        const burstProgress = Math.min((progress - .72) / .28, 1);
        [[width * .22, height * .25, "#f6c453"], [width * .78, height * .3, "#70c4d2"]].forEach(([x, y, color]) => {
          for (let ray = 0; ray < 12; ray += 1) {
            const angle = (Math.PI * 2 * ray) / 12;
            const distance = 10 + burstProgress * 45;
            context.fillStyle = color;
            context.globalAlpha = 1 - burstProgress;
            context.beginPath();
            context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 2, 0, Math.PI * 2);
            context.fill();
          }
        });
        context.globalAlpha = 1;
      }
      if (progress >= 1) reveal.classList.add("is-visible");
      if (!paused && !documentObject.hidden && !reducedMotion(windowObject)) frameId = windowObject.requestAnimationFrame(draw);
    }

    function replay() {
      windowObject.cancelAnimationFrame(frameId);
      startedAt = performance.now();
      reveal.classList.remove("is-visible");
      paused = false;
      pauseButton.textContent = "暂停动画";
      pauseButton.setAttribute("aria-pressed", "false");
      status.textContent = "粒子正在集合 · 默认静音";
      draw(startedAt);
    }

    pauseButton.addEventListener("click", () => {
      paused = !paused;
      pauseButton.textContent = paused ? "继续动画" : "暂停动画";
      pauseButton.setAttribute("aria-pressed", String(paused));
      status.textContent = paused ? "动画已暂停 · 默认静音" : "粒子正在集合 · 默认静音";
      if (!paused) draw(performance.now());
    });
    replayButton.addEventListener("click", replay);
    documentObject.addEventListener("visibilitychange", () => {
      if (documentObject.hidden) windowObject.cancelAnimationFrame(frameId);
      else if (!paused) draw(performance.now());
    });
    windowObject.addEventListener("resize", resize, { passive: true });
    resize();
    if (reducedMotion(windowObject)) {
      status.textContent = "已启用减少动态效果 · 默认静音";
    }
    draw(startedAt);
  }

  return { clamp, progressAt, mount };
});

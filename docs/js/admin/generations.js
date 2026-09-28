// Admin view for the generations game: controls, summary, charts, participant grid.
window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
(function () {
  const STALE_S = 15; // participant not seen for this long is shown faded
  const $ = (id) => document.getElementById(id);
  let trendChart = null, histChart = null, histKey = "", peopleKey = "", state = null, ctx = null;
  const pairText = (p) => p ? `${p.a} & ${p.b} — ${p.pct}%` + (p.ties ? ` (+${p.ties} more)` : "") : "–";

  $("next").onclick = () => ADMIN.action("/api/admin/next");
  $("reset").onclick = () => ADMIN.action("/api/admin/reset", {}, "Start a new generations round? Everyone registered gets a fresh generation-1 profile.");

  function renderSummary() {
    const h = state.history[state.generation - 1] || {};
    $("gen").textContent = "Generation " + state.generation;
    $("ginround").textContent = h.n == null ? 0 : h.n;
    $("gmean").textContent = h.mean == null ? "–" : h.mean.toFixed(2) + "%";
    $("grel").textContent = h.total_pairs ? `${h.related_pairs} of ${h.total_pairs} (${(100 * h.related_pairs / h.total_pairs).toFixed(1)}%)` : "–";
    $("gbest").textContent = pairText(h.best_pair);
    $("gworst").textContent = pairText(h.worst_pair);
  }

  function renderCharts() {
    const hist = state.history.filter(Boolean);
    const key = JSON.stringify(hist.map((h) => [h.generation, h.mean, h.related_pairs, h.n]));
    if (key === histKey) return;
    histKey = key;
    Chart.defaults.color = ctx.css("--muted");
    Chart.defaults.borderColor = ctx.css("--line");

    const labels = hist.map((h) => "Gen " + h.generation);
    const mean = hist.map((h) => h.mean);
    const related = hist.map((h) => (h.total_pairs ? (100 * h.related_pairs) / h.total_pairs : null));
    if (!trendChart) {
      trendChart = new Chart($("trend"), {
        type: "line",
        data: { labels, datasets: [
          { label: "Mean match %", data: mean, borderColor: ctx.css("--accent"), backgroundColor: ctx.css("--accent"), tension: 0.2 },
          { label: "% of pairs still related", data: related, borderColor: ctx.css("--green"), backgroundColor: ctx.css("--green"), tension: 0.2 },
        ] },
        options: { maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } } } },
      });
    } else {
      trendChart.data.labels = labels;
      trendChart.data.datasets[0].data = mean;
      trendChart.data.datasets[1].data = related;
      trendChart.update();
    }

    // Histogram: number of pairs per match %, from 0 up to the highest observed value.
    const cur = state.history[state.generation - 1];
    const counts = cur ? cur.histogram : [];
    let top = counts.length - 1;
    while (top > 0 && !counts[top]) top--;
    const hl = [], hv = [];
    for (let i = 0; i <= Math.max(top, 1); i++) { hl.push(i + "%"); hv.push(counts[i] || 0); }
    if (!histChart) {
      histChart = new Chart($("hist"), {
        type: "bar",
        data: { labels: hl, datasets: [{ label: "Pairs", data: hv, backgroundColor: ctx.css("--accent") }] },
        options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
                   scales: { x: { title: { display: true, text: "Match" } }, y: { beginAtZero: true, title: { display: true, text: "Number of pairs" } } } },
      });
    } else {
      histChart.data.labels = hl;
      histChart.data.datasets[0].data = hv;
      histChart.update();
    }
  }

  function renderPeople() {
    const inRound = state.participants.filter((p) => p.profile);
    const key = state.generation + ":" + inRound.map((p) => p.id).join(",") + ":" + state.history.length;
    if (key !== peopleKey) {
      peopleKey = key;
      const wrap = $("people");
      wrap.innerHTML = "";
      for (const p of inRound) {
        const s = p.stats || {};
        const card = document.createElement("div");
        card.className = "card person";
        card.dataset.id = p.id;
        const boxes = (p.profile.top + p.profile.bottom).split("").map((c) => `<div class="box ${c}"></div>`).join("");
        card.innerHTML =
          `<div class="head"><b>ID ${p.id}</b><button title="Remove participant">✕</button></div>` +
          `<div class="mini">${boxes}</div>` +
          `<div class="muted" style="font-size:13px;margin-top:6px">` +
          (s.best ? `best ${s.best.pct}% (ID ${s.best.id}) · related ${s.related}` : "no others yet") + `</div>`;
        card.querySelector("button").onclick = () => ctx.action("/api/admin/remove", { id: p.id }, `Remove participant ${p.id}?`);
        wrap.appendChild(card);
      }
    }
    for (const p of inRound) {
      const el = document.querySelector(`.person[data-id="${p.id}"]`);
      if (el) el.classList.toggle("stale", p.seen_ago > STALE_S);
    }
  }

  ADMIN_VIEWS.generations = {
    render(s, c) {
      state = s; ctx = c;
      renderSummary();
      renderCharts();
      renderPeople();
    },
  };
})();

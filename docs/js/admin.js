// Admin panel: password login, polling of /api/admin/state, controls, charts.
(function () {
  const POLL_MS = 2000;
  const STALE_S = 15; // participant not seen for this long is shown faded
  const $ = (id) => document.getElementById(id);
  let password = null;
  try { password = sessionStorage.getItem("gen_admin_pw"); } catch (e) { /* ignore */ }
  let state = null, trendChart = null, histChart = null, histKey = "", peopleKey = "", qrText = "";

  const adminCall = (method, path, body) => API.call(method, path, body, { "X-Admin-Password": password || "" });
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const pairText = (p) => p ? `${p.a} & ${p.b} — ${p.pct}%` + (p.ties ? ` (+${p.ties} more)` : "") : "–";

  function showLogin(msg) {
    $("panel").hidden = true;
    $("login").hidden = false;
    $("loginmsg").textContent = msg || "";
    $("pw").focus();
  }

  $("login").addEventListener("submit", (ev) => {
    ev.preventDefault();
    password = $("pw").value;
    try { sessionStorage.setItem("gen_admin_pw", password); } catch (e) { /* ignore */ }
    poll(true);
  });

  async function action(path, body, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    const r = await adminCall("POST", path, body || {});
    if (r.status !== 200) $("status").textContent = "Action failed: " + (r.data.error || r.status);
    poll(true);
  }
  $("next").onclick = () => action("/api/admin/next");
  $("reset").onclick = () => action("/api/admin/reset", {}, "Reset the game? All participants and history are cleared.");
  $("lock").onclick = () => action("/api/admin/lock", { locked: !state.locked });

  function joinLink() {
    if (state.public_url) return state.public_url + "/";
    const url = new URL("index.html", location.href);
    if (API.serverParam) url.searchParams.set("server", API.serverParam);
    return url.toString();
  }

  function renderLink() {
    const link = joinLink();
    $("link").textContent = link;
    const local = ["localhost", "127.0.0.1"].includes(location.hostname) && !state.public_url;
    $("linkhint").textContent = local ? "Phones cannot open 'localhost': open this admin page via the machine's network address, or start the server with --tunnel." : "";
    if (link !== qrText && window.QRCode) {
      $("qr").innerHTML = "";
      new QRCode($("qr"), { text: link, width: 180, height: 180 });
      qrText = link;
    }
  }

  function renderSummary() {
    const h = state.history[state.generation - 1] || {};
    $("gen").textContent = "Generation " + state.generation;
    $("joinstate").textContent = state.locked ? "Joining is closed" : "Joining is open";
    $("lock").textContent = state.locked ? "Unlock joining" : "Lock joining";
    $("lock").disabled = state.generation !== 1;
    $("count").textContent = `${state.participants.length} / ${state.max_participants}`;
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
    Chart.defaults.color = css("--muted");
    Chart.defaults.borderColor = css("--line");

    const labels = hist.map((h) => "Gen " + h.generation);
    const mean = hist.map((h) => h.mean);
    const related = hist.map((h) => (h.total_pairs ? (100 * h.related_pairs) / h.total_pairs : null));
    if (!trendChart) {
      trendChart = new Chart($("trend"), {
        type: "line",
        data: { labels, datasets: [
          { label: "Mean match %", data: mean, borderColor: css("--accent"), backgroundColor: css("--accent"), tension: 0.2 },
          { label: "% of pairs still related", data: related, borderColor: css("--green"), backgroundColor: css("--green"), tension: 0.2 },
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
        data: { labels: hl, datasets: [{ label: "Pairs", data: hv, backgroundColor: css("--accent") }] },
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
    const key = state.generation + ":" + state.participants.map((p) => p.id).join(",");
    if (key !== peopleKey) {
      peopleKey = key;
      const wrap = $("people");
      wrap.innerHTML = "";
      for (const p of state.participants) {
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
        card.querySelector("button").onclick = () => action("/api/admin/remove", { id: p.id }, `Remove participant ${p.id}?`);
        wrap.appendChild(card);
      }
    }
    for (const p of state.participants) {
      const el = document.querySelector(`.person[data-id="${p.id}"]`);
      if (el) el.classList.toggle("stale", p.seen_ago > STALE_S);
    }
  }

  let timer = null;
  async function poll(immediate) {
    clearTimeout(timer);
    try {
      const r = await adminCall("GET", "/api/admin/state");
      if (r.status === 401) { if (password) showLogin("Wrong password."); else showLogin(); return; }
      state = r.data;
      $("login").hidden = true;
      $("panel").hidden = false;
      $("status").textContent = "";
      renderSummary();
      renderLink();
      renderCharts();
      renderPeople();
    } catch (e) {
      $("status").textContent = "Cannot reach the server — retrying…";
    }
    timer = setTimeout(poll, POLL_MS);
  }
  if (password) poll(); else showLogin();
})();

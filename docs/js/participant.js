// Participant page: join once (token kept in localStorage), then poll /api/me.
(function () {
  const POLL_MS = 1500;
  const $ = (id) => document.getElementById(id);
  let token = API.store("gen_token");
  if (!token) {
    token = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "");
    API.store("gen_token", token);
  }
  let shownGeneration = null;
  let boxes = null; // [row][col] -> element

  function showMessage(title, text) {
    $("game").hidden = true;
    $("message").hidden = false;
    $("message").innerHTML = `<h2>${title}</h2><p class="muted">${text}</p>`;
  }

  function showUnreachable() {
    showMessage("Cannot reach the game server",
      "Retrying automatically… If you opened a github.io link, the address must end in " +
      "<b>?server=https://…trycloudflare.com</b> (the https link printed by the server).");
  }

  function buildGenome() {
    // Two blocks of 25 columns; each block holds the top row then the bottom row.
    const genome = $("genome");
    genome.innerHTML = "";
    boxes = [[], []];
    for (let b = 0; b < 2; b++) {
      const block = document.createElement("div");
      block.className = "block";
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 25; c++) {
          const el = document.createElement("div");
          el.className = "box";
          block.appendChild(el);
          boxes[row][b * 25 + c] = el;
        }
      }
      genome.appendChild(block);
    }
  }

  function tieText(entry) {
    if (!entry) return "";
    return `with ID ${entry.id}` + (entry.ties ? ` (+${entry.ties} more)` : "");
  }

  function render(d) {
    $("message").hidden = true;
    $("game").hidden = false;
    if (!boxes) buildGenome();
    $("myid").textContent = d.id;
    $("gen").textContent = "Generation " + d.generation;
    const newGen = shownGeneration !== null && shownGeneration !== d.generation;
    const rows = [d.profile.top, d.profile.bottom];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 50; col++) {
        const el = boxes[row][col];
        el.className = "box " + rows[row][col];
        if (newGen && d.greyed_last && d.greyed_last[col] === row) {
          void el.offsetWidth; // restart animation
          el.classList.add("fresh");
        }
      }
    }
    shownGeneration = d.generation;
    const s = d.stats;
    if (!s || !s.n_others) {
      ["best", "worst", "mean", "related"].forEach((k) => ($(k).textContent = "–"));
      $("bestid").textContent = "waiting for others to join";
      $("worstid").textContent = "";
      $("relatedof").textContent = "";
      return;
    }
    $("best").textContent = s.best.pct + "%";
    $("bestid").textContent = tieText(s.best);
    $("worst").textContent = s.worst.pct + "%";
    $("worstid").textContent = tieText(s.worst);
    $("mean").textContent = s.mean.toFixed(1) + "%";
    $("related").textContent = s.related;
    $("relatedof").textContent = `of ${s.n_others} other participants`;
  }

  async function tick() {
    try {
      let r = await API.call("GET", "/api/me?token=" + encodeURIComponent(token));
      if (r.status === 404) {
        // Not (or no longer, after a reset) registered: try to join.
        const j = await API.call("POST", "/api/join", { token });
        if (j.status !== 200) {
          if (j.data.error === "full") showMessage("All places are taken", j.data.message);
          else if (j.data.error === "closed") showMessage("Too late to join", j.data.message);
          else showUnreachable(); // e.g. a github.io link without ?server=
          return;
        }
        r = await API.call("GET", "/api/me?token=" + encodeURIComponent(token));
      }
      if (r.status === 200) render(r.data);
      $("status").textContent = "";
    } catch (e) {
      $("status").textContent = "Connection lost — retrying…";
      if (shownGeneration === null) showUnreachable();
    } finally {
      setTimeout(tick, POLL_MS);
    }
  }
  tick();
})();

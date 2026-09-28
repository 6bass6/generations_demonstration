// Generations game: 2x50 boxes + match statistics.
window.VIEWS = window.VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let shownGeneration = null;
  let boxes = null; // [row][col] -> element

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

  VIEWS.generations = {
    topbar: true,
    label: (d) => "Generation " + d.generations.generation,
    render(d) {
      const g = d.generations;
      $("gen-out").hidden = g.in_round;
      $("gen-in").hidden = !g.in_round;
      if (!g.in_round) return;
      if (!boxes) buildGenome();
      const newGen = shownGeneration !== null && shownGeneration !== g.generation;
      const rows = [g.profile.top, g.profile.bottom];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 50; col++) {
          const el = boxes[row][col];
          el.className = "box " + rows[row][col];
          if (newGen && g.greyed_last && g.greyed_last[col] === row) {
            void el.offsetWidth; // restart animation
            el.classList.add("fresh");
          }
        }
      }
      shownGeneration = g.generation;
      const s = g.stats;
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
    },
  };
})();

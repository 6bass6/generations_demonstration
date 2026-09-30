// Y-STR game: one block per marker (all start at allele 10), changed markers listed
// by name, and the number of other players with exactly the same haplotype.
window.VIEWS = window.VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let shownKey = null, blocks = null, builtFor = null;

  function build(n) {
    const wrap = $("ystr-blocks");
    wrap.innerHTML = "";
    blocks = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "strblock";
      wrap.appendChild(el);
      blocks.push(el);
    }
  }

  VIEWS.ystr = {
    topbar: true,
    label: (d) => `${d.ystr.panel} · Generation ${d.ystr.generation}`,
    render(d) {
      const y = d.ystr;
      $("ystr-out").hidden = y.in_round;
      $("ystr-in").hidden = !y.in_round;
      if (!y.in_round) return;
      if (builtFor !== y.panel) { build(y.markers.length); builtFor = y.panel; shownKey = null; }
      const key = y.panel + ":" + y.generation;
      const newGen = shownKey !== null && shownKey !== key;
      y.alleles.forEach((a, i) => {
        const el = blocks[i];
        el.className = "strblock" + (a > 10 ? " up" : a < 10 ? " down" : "");
        el.textContent = a === 10 ? "" : a;
        if (newGen && y.changed_last.includes(i)) {
          void el.offsetWidth; // restart animation
          el.classList.add("fresh");
        }
      });
      shownKey = key;
      const changed = y.alleles.map((a, i) => [y.markers[i], a]).filter(([, a]) => a !== 10);
      $("ystr-changes").innerHTML = changed.length
        ? changed.map(([m, a]) => `<span class="chip ${a > 10 ? "up" : "down"}">${m}: ${a}</span>`).join("")
        : '<span class="muted">No changes yet — all markers are still allele 10.</span>';
      const n = y.shared_with;
      $("ystr-shared").textContent = n;
      $("ystr-sharedof").textContent = y.n_in_round > 1
        ? (n === 0 ? "No other player shares your haplotype" : `other player${n === 1 ? "" : "s"} share${n === 1 ? "s" : ""} your haplotype (of ${y.n_in_round - 1})`)
        : "waiting for others to join";
    },
  };
})();

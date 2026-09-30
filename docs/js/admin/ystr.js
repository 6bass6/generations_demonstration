// Admin view for Y-STR: panel switch (restarts), next generation, % still identical
// to the starting haplotype and the IDs that differ (with their changed markers).
window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let panelsKey = "";
  $("ystr-next").onclick = () => ADMIN.action("/api/admin/ystr/next");
  $("ystr-reset").onclick = () => ADMIN.action("/api/admin/ystr/reset", {}, "Restart at generation 0? Everyone goes back to allele 10.");

  function renderPanels(y) {
    const key = y.panel + ":" + y.panels.map((p) => p.key).join(",");
    if (key === panelsKey) return;
    panelsKey = key;
    $("ystr-panels").innerHTML = "";
    for (const p of y.panels) {
      const b = document.createElement("button");
      b.textContent = `${p.name} (${p.n_markers})`;
      if (p.key === y.panel) b.className = "active";
      else b.onclick = () => ADMIN.action("/api/admin/ystr/panel", { panel: p.key }, `Switch to ${p.name}? This restarts at generation 0.`);
      $("ystr-panels").appendChild(b);
    }
  }

  ADMIN_VIEWS.ystr = {
    render(state) {
      const y = state.ystr, s = y.stats;
      renderPanels(y);
      const name = y.panels.find((p) => p.key === y.panel).name;
      $("ystr-title").textContent = `${name} · Generation ${y.generation}`;
      $("ystr-pct").textContent = s.pct_start === null ? "–" : s.pct_start.toFixed(1) + "%";
      $("ystr-nstart").textContent = `${s.n_start} of ${s.n} in this round`;
      $("ystr-ndiff").textContent = s.differ_ids.length;
      $("ystr-nhap").textContent = s.n_haplotypes;
      $("ystr-diff").innerHTML = s.differ_ids.length
        ? s.differ_ids.map((i) => {
            const changes = y.alleles[i].map((a, k) => [y.markers[k], a]).filter(([, a]) => a !== 10);
            return `<div class="row" style="margin-bottom:6px"><span class="chip" style="min-width:70px;text-align:center">ID ${i}</span>` +
              changes.map(([m, a]) => `<span class="chip ${a > 10 ? "up" : "down"}">${m}: ${a}</span>`).join("") + "</div>";
          }).join("")
        : '<p class="muted">Everyone still has the starting haplotype.</p>';
    },
  };
})();

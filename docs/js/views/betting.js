// Betting: pick 0-3 while betting is open; see correct/wrong after the admin reveals.
window.VIEWS = window.VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let token = null, wired = false;

  function wire() {
    $("bet-buttons").querySelectorAll("button").forEach((b) => {
      b.onclick = async () => {
        const r = await API.call("POST", "/api/bet", { token, pick: +b.dataset.pick });
        if (r.status !== 200) $("bet-note").textContent = r.data.message || "Could not place the bet.";
        refreshNow();
      };
    });
    wired = true;
  }

  VIEWS.betting = {
    topbar: true,
    label: (d) => "Betting · round " + d.betting.round,
    render(d, ctx) {
      token = ctx.token;
      if (!wired) wire();
      const b = d.betting;
      $("bet-buttons").querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("picked", +btn.dataset.pick === b.pick);
        btn.disabled = !b.open;
      });
      $("bet-title").textContent = b.open ? "Place your bet" : "Betting is closed";
      if (b.open) $("bet-note").textContent = b.pick === null ? "Tap a number. You can change it until betting closes." : `Your bet: ${b.pick}. You can still change it.`;
      else $("bet-note").textContent = b.pick === null ? "You did not place a bet." : `Your bet: ${b.pick}.`;

      const res = $("bet-result");
      if (b.answer === null) {
        res.hidden = b.open;
        res.innerHTML = '<h2>Waiting for the answer…</h2>';
      } else {
        res.hidden = false;
        res.innerHTML = b.pick === null
          ? `<h2>The answer was ${b.answer}</h2><p class="muted">You did not bet this round.</p>`
          : b.correct
            ? `<div class="result-icon">✅</div><h2>Correct!</h2><p class="muted">The answer was ${b.answer}.</p>`
            : `<div class="result-icon">❌</div><h2>Wrong</h2><p class="muted">The answer was ${b.answer}, you picked ${b.pick}.</p>`;
      }
    },
  };
})();

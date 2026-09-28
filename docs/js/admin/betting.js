// Admin view for betting: live counts, open/close, reveal answer, winning IDs.
window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let bet = null, lastRound = null;

  $("bet-toggle").onclick = () => ADMIN.action("/api/admin/bet/open", { open: !bet.open });
  $("bet-new").onclick = () => ADMIN.action("/api/admin/bet/new", {}, "Start a new betting round? All bets are cleared.");
  $("bet-reveal").onclick = () => {
    const v = $("bet-answer").value.trim();
    if (!/^[0-3]$/.test(v)) { $("bet-answer-msg").textContent = "Type 0, 1, 2 or 3."; return; }
    $("bet-answer-msg").textContent = "";
    ADMIN.action("/api/admin/bet/reveal", { answer: +v });
  };
  $("bet-answer").addEventListener("keydown", (e) => { if (e.key === "Enter") $("bet-reveal").click(); });

  ADMIN_VIEWS.betting = {
    render(state) {
      bet = state.betting;
      if (lastRound !== null && bet.round !== lastRound) $("bet-answer").value = ""; // new round
      lastRound = bet.round;
      $("bet-round").textContent = "Betting · round " + bet.round;
      $("bet-state").textContent = bet.answer !== null ? `Revealed: the answer is ${bet.answer}` : bet.open ? "Betting is open" : "Betting is closed";
      $("bet-toggle").textContent = bet.open ? "Close betting" : "Reopen betting";
      $("bet-toggle").disabled = bet.answer !== null;
      const total = bet.counts.reduce((a, b) => a + b, 0);
      $("bet-counts").innerHTML = bet.counts.map((n, i) =>
        `<div class="bet-count${bet.answer === i ? " correct" : ""}"><div class="n">${i}</div>` +
        `<div class="bar"><span style="width:${total ? (100 * n) / total : 0}%"></span></div><b>${n}</b></div>`).join("");
      $("bet-nopick").textContent = bet.no_pick.length ? `No bet yet (${bet.no_pick.length}): IDs ${ADMIN.idList(bet.no_pick)}` : "Everyone has placed a bet.";
      if (bet.winners === null) {
        $("bet-winners-title").textContent = "Winners";
        $("bet-winners").innerHTML = '<span class="muted">Reveal the correct number to see the winners.</span>';
      } else {
        $("bet-winners-title").textContent = `Winners — ${bet.winners.length} with the correct number ${bet.answer}`;
        $("bet-winners").innerHTML = bet.winners.length
          ? bet.winners.map((i) => `<span class="chip win">ID ${i}</span>`).join("")
          : '<span class="muted">Nobody picked the correct number.</span>';
      }
    },
  };
})();

// Birthday paradox: enter day + month, see who shares it.
window.VIEWS = window.VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  let built = false, touched = false, token = null;

  function fillDays() {
    const month = +$("bday-month").value || 1;
    const keep = +$("bday-day").value;
    const max = DAYS_IN_MONTH[month - 1];
    $("bday-day").innerHTML = '<option value="">Day</option>' +
      Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
    if (keep && keep <= max) $("bday-day").value = keep;
  }

  function build() {
    $("bday-month").innerHTML = '<option value="">Month</option>' +
      MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    fillDays();
    $("bday-month").onchange = () => { touched = true; fillDays(); };
    $("bday-day").onchange = () => { touched = true; };
    $("bday-save").onclick = async () => {
      const month = +$("bday-month").value, day = +$("bday-day").value;
      if (!month || !day) { $("bday-saved").textContent = "Please choose a day and a month."; return; }
      const r = await API.call("POST", "/api/birthday", { token, month, day });
      $("bday-saved").textContent = r.status === 200 ? "Saved." : (r.data.message || "Could not save, please try again.");
      touched = false;
      refreshNow();
    };
    built = true;
  }

  VIEWS.birthday = {
    topbar: true,
    label: () => "Birthday paradox",
    render(d, ctx) {
      token = ctx.token;
      if (!built) build();
      const b = d.birthday;
      // Show the saved date in the selects, unless the participant is busy changing them.
      if (b.birthday && !touched) {
        $("bday-month").value = b.birthday[0];
        fillDays();
        $("bday-day").value = b.birthday[1];
      }
      if (!b.birthday) {
        $("bday-result").innerHTML = '<p class="muted">Enter your birthday to see if anyone shares it.</p>';
        return;
      }
      $("bday-saved").textContent = "Your birthday: " + formatDate(b.birthday[0], b.birthday[1]);
      $("bday-result").innerHTML = b.same_ids.length
        ? `<h2>🎉 Same birthday as</h2><div class="chips" style="justify-content:center;margin-top:12px">` +
          b.same_ids.map((i) => `<span class="chip win">ID ${i}</span>`).join("") + "</div>"
        : '<h2>Nobody shares your birthday</h2><p class="muted">…yet. Wait for others to enter theirs.</p>';
    },
  };
})();

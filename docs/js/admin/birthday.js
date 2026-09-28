// Admin view for the birthday paradox: shared birthdays and the theoretical chance.
window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
(function () {
  const $ = (id) => document.getElementById(id);
  $("bday-clear").onclick = () => ADMIN.action("/api/admin/birthday/clear", {}, "Clear all entered birthdays?");

  ADMIN_VIEWS.birthday = {
    render(state) {
      const b = state.birthday;
      const people = b.groups.reduce((n, g) => n + g.ids.length, 0);
      $("bday-n").textContent = `${b.n_entered} / ${state.participants.length}`;
      $("bday-n2").textContent = b.n_entered;
      $("bday-p").textContent = (100 * b.p_shared).toFixed(1) + "%";
      $("bday-groups").textContent = b.groups.length;
      $("bday-people").textContent = people;
      $("bday-list").innerHTML = b.groups.length
        ? b.groups.map((g) => `<div class="row" style="margin-bottom:8px"><b style="min-width:130px">${formatDate(g.month, g.day)}</b>` +
            g.ids.map((i) => `<span class="chip win">ID ${i}</span>`).join("") + "</div>").join("")
        : '<p class="muted">No shared birthdays yet.</p>';
    },
  };
})();

// Admin view for the welcome screen: list of registered IDs.
window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
ADMIN_VIEWS.welcome = {
  render(state) {
    const ids = state.participants.map((p) => p.id);
    document.getElementById("welcome-ids").innerHTML =
      ids.length ? ids.map((i) => `<span class="chip">${i}</span>`).join("") : '<span class="muted">Nobody has joined yet.</span>';
  },
};

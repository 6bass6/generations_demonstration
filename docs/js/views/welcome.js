// Welcome screen: shown after registering, until the admin starts a game.
window.VIEWS = window.VIEWS || {};
VIEWS.welcome = {
  topbar: false,
  render(d) { document.getElementById("welcome-id").textContent = d.id; },
};

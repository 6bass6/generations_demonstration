// Participant page core: join once (token kept in localStorage), poll /api/me,
// and show the view of the game the admin has selected (see js/views/*.js).
(function () {
  const POLL_MS = 1500;
  const $ = (id) => document.getElementById(id);
  let token = API.store("gen_token");
  if (!token) {
    token = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "");
    API.store("gen_token", token);
  }
  let connected = false;
  let timer = null, busy = false; // one polling loop only

  function hideViews() {
    document.querySelectorAll("section[id^='view-']").forEach((el) => (el.hidden = true));
  }

  function showMessage(title, text) {
    hideViews();
    $("topbar").hidden = true;
    $("message").hidden = false;
    $("message").innerHTML = `<h2>${title}</h2><p class="muted">${text}</p>`;
  }

  function showUnreachable() {
    showMessage("Cannot reach the game server",
      "Retrying automatically… If you opened a github.io link, the address must end in " +
      "<b>?server=https://…trycloudflare.com</b> (the https link printed by the server).");
  }

  function render(d) {
    const view = VIEWS[d.mode];
    if (!view) return showMessage("Please wait", "The next game is being prepared.");
    $("message").hidden = true;
    document.querySelectorAll("section[id^='view-']").forEach((el) => (el.hidden = el.id !== "view-" + d.mode));
    $("topbar").hidden = !view.topbar;
    $("myid").textContent = d.id;
    if (view.label) $("modelabel").textContent = view.label(d);
    view.render(d, { token });
  }

  async function tick() {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    try {
      let r = await API.call("GET", "/api/me?token=" + encodeURIComponent(token));
      if (r.status === 404) {
        // Not (or no longer, after clearing) registered: try to join.
        const j = await API.call("POST", "/api/join", { token });
        if (j.status !== 200) {
          if (j.data.error === "full") showMessage("All places are taken", j.data.message);
          else if (j.data.error === "closed") showMessage("Too late to join", j.data.message);
          else showUnreachable(); // e.g. a github.io link without ?server=
          return;
        }
        r = await API.call("GET", "/api/me?token=" + encodeURIComponent(token));
      }
      if (r.status === 200) { connected = true; render(r.data); }
      $("status").textContent = "";
    } catch (e) {
      $("status").textContent = "Connection lost — retrying…";
      if (!connected) showUnreachable();
    } finally {
      busy = false;
      timer = setTimeout(tick, POLL_MS);
    }
  }
  // Views can ask for an immediate refresh after the participant did something.
  window.refreshNow = tick;
  tick();
})();

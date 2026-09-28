// Admin panel core: password login, polling of /api/admin/state, game selector,
// shared controls. Each game's section is rendered by js/admin/<mode>.js.
(function () {
  const POLL_MS = 2000;
  const MODE_NAMES = { welcome: "Welcome", generations: "Generations", birthday: "Birthday paradox", betting: "Betting" };
  const $ = (id) => document.getElementById(id);
  let password = null;
  try { password = sessionStorage.getItem("gen_admin_pw"); } catch (e) { /* ignore */ }
  let state = null, qrText = "", modesKey = "";

  const adminCall = (method, path, body) => API.call(method, path, body, { "X-Admin-Password": password || "" });

  function showLogin(msg) {
    $("panel").hidden = true;
    $("login").hidden = false;
    $("loginmsg").textContent = msg || "";
    $("pw").focus();
  }

  $("login").addEventListener("submit", (ev) => {
    ev.preventDefault();
    password = $("pw").value;
    try { sessionStorage.setItem("gen_admin_pw", password); } catch (e) { /* ignore */ }
    poll();
  });

  // Shared helpers handed to the per-game admin views.
  const ctx = {
    async action(path, body, confirmText) {
      if (confirmText && !confirm(confirmText)) return;
      const r = await adminCall("POST", path, body || {});
      if (r.status !== 200) $("status").textContent = "Action failed: " + (r.data.message || r.data.error || r.status);
      poll();
    },
    css: (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    idList: (ids) => (ids && ids.length ? ids.join(", ") : "–"),
  };
  window.ADMIN = ctx;

  $("clearall").onclick = () => ctx.action("/api/admin/clear_all", {}, "Forget ALL participants? Every device gets a new ID and all game data is cleared.");
  $("lock").onclick = () => ctx.action("/api/admin/lock", { locked: !state.locked });

  function renderModes() {
    const key = state.modes.join(",") + ":" + state.mode;
    if (key === modesKey) return;
    modesKey = key;
    const wrap = $("modes");
    wrap.innerHTML = "";
    for (const m of state.modes) {
      const b = document.createElement("button");
      b.textContent = MODE_NAMES[m] || m;
      if (m === state.mode) b.className = "active";
      b.onclick = () => ctx.action("/api/admin/mode", { mode: m });
      wrap.appendChild(b);
    }
  }

  function joinLink() {
    if (state.public_url) return state.public_url + "/";
    const url = new URL("index.html", location.href);
    if (API.serverParam) url.searchParams.set("server", API.serverParam);
    return url.toString();
  }

  function renderCommon() {
    $("count").textContent = `${state.participants.length} / ${state.max_participants}`;
    $("joinstate").textContent = state.locked ? "Joining is closed" : "Joining is open";
    $("lock").textContent = state.locked ? "Unlock joining" : "Lock joining";
    const link = joinLink();
    $("link").textContent = link;
    const local = ["localhost", "127.0.0.1"].includes(location.hostname) && !state.public_url;
    $("linkhint").textContent = local ? "Phones cannot open 'localhost': open this admin page via the machine's network address, or start the server with --tunnel." : "";
    if (link !== qrText && window.QRCode) {
      $("qr").innerHTML = "";
      new QRCode($("qr"), { text: link, width: 180, height: 180 });
      qrText = link;
    }
  }

  let timer = null;
  async function poll() {
    clearTimeout(timer);
    try {
      const r = await adminCall("GET", "/api/admin/state");
      if (r.status === 401) { if (password) showLogin("Wrong password."); else showLogin(); return; }
      state = r.data;
      $("login").hidden = true;
      $("panel").hidden = false;
      $("status").textContent = "";
      renderModes();
      renderCommon();
      document.querySelectorAll("section[id^='admin-']").forEach((el) => (el.hidden = el.id !== "admin-" + state.mode));
      const view = (window.ADMIN_VIEWS || {})[state.mode];
      if (view) view.render(state, ctx);
    } catch (e) {
      $("status").textContent = "Cannot reach the server — retrying…";
    }
    timer = setTimeout(poll, POLL_MS);
  }
  if (password) poll(); else showLogin();
})();

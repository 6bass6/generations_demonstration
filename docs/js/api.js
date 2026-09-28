// Server URL resolution and small fetch helpers shared by both pages.
// Order: ?server=<url> link parameter > js/config.js > same origin.
(function () {
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  const param = new URLSearchParams(location.search).get("server");
  if (param) store("gen_server", param);
  const server = (param || (window.GEN_CONFIG && window.GEN_CONFIG.serverUrl) || "").replace(/\/+$/, "");

  async function call(method, path, body, headers) {
    const res = await fetch(server + path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { status: res.status, data };
  }

  window.API = { server, serverParam: param, store, call };
})();

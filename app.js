// Glue: form <-> generator <-> render <-> storage <-> edit/learn <-> print.

(function () {
  "use strict";

  const LS = {
    profiles: "cob.profiles.v1",
    prefs: "cob.prefs.v1",
    last: "cob.lastProfile.v1",
  };

  const PREF_DROP_THRESHOLD = 2;  // removed N+ times and never kept => drop
  const PREF_USE_EDIT_THRESHOLD = 2; // edited to same text N+ times => use as default

  const form = document.getElementById("clientForm");
  const sopEl = document.getElementById("sop");
  const profileSelect = document.getElementById("profileSelect");
  const prefHint = document.getElementById("prefHint");
  const editToggle = document.getElementById("editToggle");
  const saveEditsBtn = document.getElementById("saveEditsBtn");

  let currentSOP = null;       // last generated SOP object
  let preEditSnapshot = null;  // deep copy of items before edit mode
  let currentProfileName = "";

  // ----- utility -----
  function loadJSON(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  }
  function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function readForm() {
    const fd = new FormData(form);
    const d = {};
    for (const [k, v] of fd.entries()) {
      if (k in d) {
        if (Array.isArray(d[k])) d[k].push(v);
        else d[k] = [d[k], v];
      } else {
        d[k] = v;
      }
    }
    // multi-select <select multiple> elements need explicit handling
    form.querySelectorAll("select[multiple]").forEach((sel) => {
      d[sel.name] = Array.from(sel.selectedOptions).map((o) => o.value);
    });
    return d;
  }

  function writeForm(d) {
    form.reset();
    for (const key of Object.keys(d)) {
      const els = form.elements[key];
      if (!els) continue;
      const val = d[key];
      if (els instanceof HTMLSelectElement && els.multiple) {
        const arr = Array.isArray(val) ? val : [val];
        Array.from(els.options).forEach((o) => { o.selected = arr.includes(o.value); });
      } else if (els instanceof RadioNodeList) {
        els.value = val;
      } else {
        els.value = val;
      }
    }
  }

  // ----- preferences -----
  function getPrefs() { return loadJSON(LS.prefs, {}); }
  function setPrefs(p) { saveJSON(LS.prefs, p); }

  function applyPrefsToSOP(sop) {
    const prefs = getPrefs();
    let dropped = 0, edited = 0;

    const applyList = (items) => items.filter((it) => {
      const p = prefs[it.id];
      if (!p) return true;
      if (p.removed >= PREF_DROP_THRESHOLD && (p.kept || 0) === 0) {
        dropped++;
        return false;
      }
      if (p.editedTo && p.editedToCount >= PREF_USE_EDIT_THRESHOLD) {
        it.text = p.editedTo;
        it.learned = true;
        edited++;
      }
      return true;
    });

    sop.sections.forEach((s) => { s.items = applyList(s.items); });
    sop.schedule.groups.forEach((g) => { g.items = applyList(g.items); });
    return { dropped, edited };
  }

  function snapshotItems(sop) {
    const out = {};
    const snap = (arr) => arr.forEach((it) => { out[it.id] = it.text; });
    sop.sections.forEach((s) => snap(s.items));
    sop.schedule.groups.forEach((g) => snap(g.items));
    return out;
  }

  function learnFromEdits(beforeSnap, afterItems) {
    // afterItems: { id -> text } of items that survived in the rendered DOM
    const prefs = getPrefs();
    const now = Date.now();

    Object.keys(beforeSnap).forEach((id) => {
      const original = beforeSnap[id];
      const after = afterItems[id];
      prefs[id] = prefs[id] || { kept: 0, removed: 0, editedTo: null, editedToCount: 0, updated: now };
      if (after === undefined) {
        prefs[id].removed = (prefs[id].removed || 0) + 1;
      } else if (after.trim() !== original.trim()) {
        if (prefs[id].editedTo === after.trim()) prefs[id].editedToCount = (prefs[id].editedToCount || 0) + 1;
        else { prefs[id].editedTo = after.trim(); prefs[id].editedToCount = 1; }
        prefs[id].kept = (prefs[id].kept || 0) + 1;
      } else {
        prefs[id].kept = (prefs[id].kept || 0) + 1;
      }
      prefs[id].updated = now;
    });
    setPrefs(prefs);
  }

  // ----- render -----
  function render(sop) {
    const { dropped, edited } = applyPrefsToSOP(sop);
    sopEl.classList.remove("editing");
    sopEl.innerHTML = "";

    const h1 = document.createElement("h1");
    h1.textContent = `${sop.client} — Onboarding SOP`;
    sopEl.appendChild(h1);

    const sub = document.createElement("p");
    sub.style.color = "#5f6772";
    sub.style.margin = "0 0 0.75rem";
    sub.textContent = `Generated ${new Date(sop.generated).toLocaleString()}`;
    sopEl.appendChild(sub);

    if (sop.meta.length) {
      const dl = document.createElement("dl");
      dl.className = "meta";
      sop.meta.forEach(([k, v]) => {
        const dt = document.createElement("dt"); dt.textContent = k;
        const dd = document.createElement("dd"); dd.textContent = v;
        dl.append(dt, dd);
      });
      sopEl.appendChild(dl);
    }

    if (sop.stack.length) {
      const chips = document.createElement("div");
      sop.stack.forEach((s) => {
        const c = document.createElement("span");
        c.className = "chip"; c.textContent = s;
        chips.appendChild(c);
      });
      sopEl.appendChild(chips);
    }

    sop.sections.forEach((section) => {
      const h2 = document.createElement("h2");
      h2.textContent = section.title;
      sopEl.appendChild(h2);
      const ul = document.createElement("ul");
      ul.dataset.section = section.key;
      section.items.forEach((it) => ul.appendChild(renderLi(it)));
      sopEl.appendChild(ul);
    });

    // Maintenance schedule
    const h2 = document.createElement("h2");
    h2.textContent = sop.schedule.title;
    sopEl.appendChild(h2);
    sop.schedule.groups.forEach((g) => {
      const h3 = document.createElement("h3");
      h3.textContent = g.when;
      sopEl.appendChild(h3);
      const ul = document.createElement("ul");
      ul.dataset.section = "ma." + g.when.toLowerCase();
      g.items.forEach((it) => ul.appendChild(renderLi(it)));
      sopEl.appendChild(ul);
    });

    // Preference hint
    const parts = [];
    if (edited) parts.push(`${edited} item${edited === 1 ? "" : "s"} auto-rewritten from your past edits`);
    if (dropped) parts.push(`${dropped} item${dropped === 1 ? "" : "s"} dropped per your preferences`);
    prefHint.textContent = parts.length ? "Applied: " + parts.join("; ") : "";
  }

  function renderLi(item) {
    const li = document.createElement("li");
    li.dataset.itemId = item.id;
    li.textContent = item.text;
    if (item.learned) li.title = "Rewritten from your learned preferences";
    return li;
  }

  // ----- edit mode -----
  function startEdit() {
    if (!currentSOP) return;
    preEditSnapshot = snapshotItems(currentSOP);
    sopEl.classList.add("editing");
    sopEl.querySelectorAll("li").forEach((li) => {
      li.contentEditable = "true";
    });
    editToggle.textContent = "Cancel edits";
    saveEditsBtn.hidden = false;
  }

  function cancelEdit() {
    sopEl.classList.remove("editing");
    sopEl.querySelectorAll("li").forEach((li) => { li.contentEditable = "false"; });
    editToggle.textContent = "Edit output";
    saveEditsBtn.hidden = true;
    render(currentSOP); // re-render from model to discard DOM edits
  }

  function saveEdits() {
    const after = {};
    sopEl.querySelectorAll("li[data-item-id]").forEach((li) => {
      const t = li.innerText.trim();
      if (t) after[li.dataset.itemId] = t;
    });
    learnFromEdits(preEditSnapshot, after);

    // Persist edits into currentSOP model so re-render shows the edited state
    const updateList = (items) =>
      items
        .filter((it) => after[it.id] !== undefined)
        .map((it) => ({ ...it, text: after[it.id] }));
    currentSOP.sections.forEach((s) => { s.items = updateList(s.items); });
    currentSOP.schedule.groups.forEach((g) => { g.items = updateList(g.items); });

    sopEl.classList.remove("editing");
    sopEl.querySelectorAll("li").forEach((li) => { li.contentEditable = "false"; });
    editToggle.textContent = "Edit output";
    saveEditsBtn.hidden = true;

    // Re-render so hints update and snapshot refreshes — but skip applyPrefs so we keep user edits
    // Simplest: re-run render which will re-apply prefs; our edits are now stored so applyPrefs will use them.
    render(currentSOP);
    prefHint.textContent = "Edits saved and learned.";
  }

  // ----- profiles -----
  function refreshProfileList() {
    const profiles = loadJSON(LS.profiles, {});
    profileSelect.innerHTML = '<option value="">— Load profile —</option>';
    Object.keys(profiles).sort().forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      profileSelect.appendChild(opt);
    });
    const last = localStorage.getItem(LS.last);
    if (last && profiles[last]) profileSelect.value = last;
  }

  function saveProfile() {
    const d = readForm();
    const name = (d.company || "").trim() || prompt("Profile name:");
    if (!name) return;
    const profiles = loadJSON(LS.profiles, {});
    profiles[name] = { data: d, updated: Date.now() };
    saveJSON(LS.profiles, profiles);
    localStorage.setItem(LS.last, name);
    currentProfileName = name;
    refreshProfileList();
    profileSelect.value = name;
    prefHint.textContent = `Profile "${name}" saved.`;
  }

  function loadProfile(name) {
    if (!name) return;
    const profiles = loadJSON(LS.profiles, {});
    const p = profiles[name];
    if (!p) return;
    writeForm(p.data);
    localStorage.setItem(LS.last, name);
    currentProfileName = name;
    prefHint.textContent = `Loaded "${name}".`;
  }

  function deleteProfile() {
    const name = profileSelect.value;
    if (!name) return;
    if (!confirm(`Delete profile "${name}"?`)) return;
    const profiles = loadJSON(LS.profiles, {});
    delete profiles[name];
    saveJSON(LS.profiles, profiles);
    if (currentProfileName === name) currentProfileName = "";
    refreshProfileList();
    prefHint.textContent = `Deleted "${name}".`;
  }

  function newProfile() {
    form.reset();
    currentProfileName = "";
    profileSelect.value = "";
    localStorage.removeItem(LS.last);
    prefHint.textContent = "";
  }

  function exportJSON() {
    const payload = {
      profiles: loadJSON(LS.profiles, {}),
      prefs: loadJSON(LS.prefs, {}),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `client-onboarding-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.profiles && !data.prefs) throw new Error("invalid file");
        if (data.profiles) {
          const existing = loadJSON(LS.profiles, {});
          saveJSON(LS.profiles, { ...existing, ...data.profiles });
        }
        if (data.prefs) {
          const existing = loadJSON(LS.prefs, {});
          saveJSON(LS.prefs, { ...existing, ...data.prefs });
        }
        refreshProfileList();
        prefHint.textContent = "Import complete.";
      } catch (e) {
        alert("Import failed: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ----- generate -----
  function generate() {
    const data = readForm();
    if (!data.company) {
      alert("Please enter a company name.");
      form.elements.company.focus();
      return;
    }
    currentSOP = window.Generator.build(data);
    render(currentSOP);
  }

  // ----- wiring -----
  document.getElementById("generateBtn").addEventListener("click", generate);
  document.getElementById("saveBtn").addEventListener("click", saveProfile);
  document.getElementById("loadBtn").addEventListener("click", () => loadProfile(profileSelect.value));
  document.getElementById("deleteBtn").addEventListener("click", deleteProfile);
  document.getElementById("newBtn").addEventListener("click", newProfile);
  document.getElementById("exportJsonBtn").addEventListener("click", exportJSON);
  document.getElementById("importJsonInput").addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  profileSelect.addEventListener("change", () => loadProfile(profileSelect.value));

  editToggle.addEventListener("click", () => {
    if (sopEl.classList.contains("editing")) cancelEdit();
    else startEdit();
  });
  saveEditsBtn.addEventListener("click", saveEdits);

  document.getElementById("printBtn").addEventListener("click", () => {
    if (!currentSOP) { alert("Generate a checklist first."); return; }
    window.print();
  });

  // Auto-load most recent profile
  refreshProfileList();
  const last = localStorage.getItem(LS.last);
  if (last) loadProfile(last);
})();

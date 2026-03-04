(() => {
  "use strict";

  const LS_KEY = "yaron_appraiser_final_v1_state";

  const AREA_SETS = {
    residential: [
      "סלון","מטבח","מסדרון","חדר רחצה","מרפסת","חדר שירות","תקרה","חדר שינה 1","חדר ילדים 1"
    ],
    business: [
      "חלל מסחרי/אולם","משרד","חדר שירות","מחסן","חזית/ויטרינה","תקרת תותב/תקרה משנית","שירותים","מסדרון","חדר שרתים"
    ],
    warehouse: [
      "שטח עיקרי","מחסן","משרד","רמפה/כניסה","מערכת חשמל","חדר שירות","תקרה","חזית"
    ],
    other: [
      "שטח עיקרי","חדר שירות","תקרה","חזית"
    ]
  };

  const SIGNS = {
    water: [
      "כתמי רטיבות בקירות",
      "כתמי רטיבות בתקרה",
      "עליות קפילריות בשיפולי קירות",
      "התנפחות טיח",
      "התפרקות טיח",
      "קילופי צבע",
      "התנפחות רצפת פרקט",
      "עליות מים מעל ריצוף",
      "סימני תפרחת בין אריחים",
      "סימני עובש",
      "ריח טחב",
      "רטיבות והתנפחות גב מטבח",
      "רטיבות והתנפחות בצוקל מטבח",
      "סימני הפרדות קרמיקה בחדר רטוב",
      "בעיות איטום/רובה בחדר רטוב",
      "סימני רטיבות והתנפחות במשקופים פנימיים",
      "פגיעה בארון חשמל",
      "פגיעה במערכת חשמל",
      "סימני רטיבות בשכבות תשתית מתחת לריצוף",
      "אינדיקציה ללחות בקירות",
      "נזק לתקרה משנית (נזקי מים)"
    ],
    fire: [
      "נזקי פיח",
      "נזקי עשן",
      "נזקי מי כיבוי",
      "פגיעה במערכות חשמל ותאורה",
      "פגיעה בתקרות משניות/גבס",
      "פגיעה במערכות מים/אינסטלציה",
      "פגיעה במערכות מתח נמוך",
      "פגיעה במערכות גז",
      "פגיעה במערכות תקשורת"
    ],
    burglary: [
      "נזק לדלת/מנעול",
      "נזק למסגרת/משקוף",
      "נזק לחלון/ויטרינה",
      "נזק לתריס",
      "פגיעה במערכת אזעקה",
      "פגיעה במצלמות אבטחה"
    ],
    taxEvent: [
      "פגיעה ישירה",
      "הדף",
      "נזק משני",
      "נזקי רסיסים"
    ]
  };

  function defaultState(){
    return {
      meta: {
        mode: "private",
        fullName: "",
        idNumber: "",
        address: "",
        propertyKind: "residential",
        areaSqm: "",
        propertyType: "",
        buildYear: "",
        buildMaterial: "",
        preEventCondition: "",
        phone: "",
        eventDate: "",
        visitDate: "",
        insurerName: "",
        policyNumber: "",
        lastDocDate: "",
        photosNote: "",
      },
      coverage: {
        building: { insured:"", actual:"", deduct:"", check:"auto" },
        contents: { insured:"", actual:"", deduct:"", check:"auto" },
        extensions: { thirdParty:false, lossProfit:false, bizVAT:false, plumberArrangement:false }
      },
      event: {
        type: "water",
        subType: "",
        subTypeOther: "",
        docPolice: true,
        docFire: false,
        openingOverride: ""
      },
      circumstances: {
        free: "",
        waterPrevRepair:false,
        waterRecentPlumber:false,
        waterFollowText:"",
        override:""
      },
      damage: {
        areas: [], // {name, signs:[]}
        bedroomCount: 1,
        kidsCount: 1,
        customAreas: [],
        override:""
      },
      findings: {
        damageEvidence: "na",
        moistMeter:false,
        moistAbnormal:false,
        moistLab:false,
        moistNote:"",
        free:"",
        override:""
      },
      boq: {
        enableClaimColumn:false,
        privateWideScope:false,
        building: [],
        contents: [],
        services: {
          cleaning:false,
          waste:false,
          dumpster:false,
          moveContents:false,
          drying:false,
          note:""
        },
        override:""
      },
      explanations: {
        override:""
      },
      summary: {
        recoText:"",
        signText:"",
        sumClaim:"",
        sumNote:"",
        override:""
      },
      photos: {
        hero: { src:"", caption:"" },
        gallery: [] // {id, src, caption}
      }
    };
  }

  let state = defaultState();
  let saveTimer = null;

  function qs(id){ return document.getElementById(id); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function safeNum(v){
    if(v===null || v===undefined) return 0;
    const s = String(v).replace(/[^\d.\-]/g,"").trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtILS(n){
    try{
      return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(n);
    }catch(e){
      return String(Math.round(n));
    }
  }

  function escapeHtml(str){
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function nl2br(str){
    return escapeHtml(str).replace(/\n/g,"<br>");
  }

  function debounceSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 450);
    qs("saveStatus").textContent = "נשמר אוטומטית…";
  }

  function saveNow(){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      qs("saveStatus").textContent = "נשמר ✓ ("+new Date().toLocaleTimeString("he-IL")+")";
    }catch(e){
      qs("saveStatus").textContent = "שגיאת שמירה מקומית: " + (e?.message || e);
    }
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return false;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== "object") return false;
      state = deepMerge(defaultState(), parsed);
      return true;
    }catch(e){
      return false;
    }
  }

  function deepMerge(base, extra){
    if(Array.isArray(base) && Array.isArray(extra)) return extra;
    if(typeof base !== "object" || base===null) return extra;
    const out = {...base};
    for(const k of Object.keys(extra || {})){
      if(k in base){
        out[k] = deepMerge(base[k], extra[k]);
      }else{
        out[k] = extra[k];
      }
    }
    return out;
  }

  function setMode(mode){
    state.meta.mode = mode;
    // Enforce tax flow: eventType locked to taxEvent
    if(mode === "tax"){
      state.event.type = "taxEvent";
    }
    renderModeVisibility();
    debounceSave();
  }

  function renderModeVisibility(){
    const mode = state.meta.mode;
    qs("cardCoverage").classList.toggle("hidden", mode === "tax");
    qs("insuranceMetaWrap").classList.toggle("hidden", mode !== "insurance");
    qs("pillPlumber").classList.toggle("hidden", mode !== "insurance");
    qs("pillClaimCol").classList.toggle("hidden", mode !== "insurance");
    qs("pillFullScope").classList.toggle("hidden", mode !== "private");

    const hint = {
      private: "פרטי: תביעה/שומה ללקוח. אין חובה לפוליסה.",
      insurance: "עבור חברת ביטוח: כינון/שיפוי + אופציה לטור תביעה.",
      tax: "מס רכוש: ללא כיסויי ביטוח; אירוע קבוע ותתי‑סיווג."
    }[mode] || "";
    qs("modeHint").textContent = hint;

    // eventType selector behavior
    const eventSel = qs("eventType");
    eventSel.value = state.event.type;
    if(mode === "tax"){
      eventSel.value = "taxEvent";
      eventSel.disabled = true;
    }else{
      eventSel.disabled = false;
      // prevent selecting taxEvent for non-tax modes (per your earlier requirement)
      if(eventSel.value === "taxEvent"){
        eventSel.value = "water";
        state.event.type = "water";
      }
    }

    // Show water follow-ups only when event water
    qs("waterFollowWrap").classList.toggle("hidden", state.event.type !== "water");

    // show/hide subtype other
    qs("eventSubTypeOtherWrap").style.display = (state.event.subType === "other") ? "block" : "none";
  }

  function ensureAreasBase(){
    // initialize selected areas if empty
    if(!Array.isArray(state.damage.areas)) state.damage.areas = [];
    const base = AREA_SETS[state.meta.propertyKind] || AREA_SETS.residential;

    // Guarantee bedroom/kids counts at least 1 for residential
    if(state.meta.propertyKind === "residential"){
      if(!state.damage.bedroomCount) state.damage.bedroomCount = 1;
      if(!state.damage.kidsCount) state.damage.kidsCount = 1;
    }

    // Build dynamic rooms names
    const dyn = [];
    if(state.meta.propertyKind === "residential"){
      for(let i=1;i<=state.damage.bedroomCount;i++) dyn.push("חדר שינה " + i);
      for(let i=1;i<=state.damage.kidsCount;i++) dyn.push("חדר ילדים " + i);
    }

    // Remove default "חדר שינה 1/חדר ילדים 1" duplicates from base when we build dyn
    const filteredBase = base.filter(n => !/^חדר שינה \d+$/.test(n) && !/^חדר ילדים \d+$/.test(n));

    const all = [...filteredBase, ...dyn, ...(state.damage.customAreas||[])];

    // Keep selected areas that still exist; add none automatically
    state.damage.areas = state.damage.areas
      .filter(a => all.includes(a.name))
      .map(a => ({ name: a.name, signs: Array.isArray(a.signs)?a.signs:[] }));

    return all;
  }

  function toggleArea(name){
    const idx = state.damage.areas.findIndex(a => a.name === name);
    if(idx >= 0){
      state.damage.areas.splice(idx,1);
    }else{
      state.damage.areas.push({ name, signs: []});
    }
    debounceSave();
    renderAreasAndSigns();
  }

  function addBedroom(){
    state.damage.bedroomCount = Math.min(10, (state.damage.bedroomCount||1) + 1);
    debounceSave();
    renderAreasAndSigns();
  }
  function addKids(){
    state.damage.kidsCount = Math.min(10, (state.damage.kidsCount||1) + 1);
    debounceSave();
    renderAreasAndSigns();
  }
  function addCustomArea(name){
    const n = String(name||"").trim();
    if(!n) return;
    state.damage.customAreas = state.damage.customAreas || [];
    if(state.damage.customAreas.includes(n)) return;
    state.damage.customAreas.push(n);
    debounceSave();
    renderAreasAndSigns();
  }

  function renderAreasAndSigns(){
    const allAreas = ensureAreasBase();

    // areas list chips
    const areasList = qs("areasList");
    areasList.innerHTML = "";
    allAreas.forEach(name => {
      const selected = state.damage.areas.some(a => a.name === name);
      const el = document.createElement("label");
      el.className = "pill";
      el.innerHTML = `<input type="checkbox" ${selected ? "checked":""}/> ${escapeHtml(name)}`;
      el.addEventListener("change", () => toggleArea(name));
      areasList.appendChild(el);
    });

    // signs editor for selected areas
    const signsWrap = qs("damageSignsEditor");
    signsWrap.innerHTML = "";

    const eventType = state.event.type;
    const signList = SIGNS[eventType] || [];
    if(state.damage.areas.length === 0){
      signsWrap.innerHTML = `<div class="mini muted">בחר אזור אחד לפחות כדי להציג תתי‑פגיעה.</div>`;
      return;
    }

    state.damage.areas.forEach(area => {
      const box = document.createElement("div");
      box.className = "card";
      box.style.boxShadow = "none";
      box.style.marginBottom = "10px";
      box.innerHTML = `<h2 style="margin:0 0 6px 0;font-size:14px">${escapeHtml(area.name)}</h2>
        <div class="row" style="gap:8px;flex-wrap:wrap"></div>
        <div class="mini muted" style="margin-top:6px">נבחר: <span class="chosen"></span></div>
      `;
      const row = box.querySelector(".row");
      const chosen = box.querySelector(".chosen");

      signList.forEach(sign => {
        const checked = (area.signs||[]).includes(sign);
        const lab = document.createElement("label");
        lab.className = "pill";
        lab.innerHTML = `<input type="checkbox" ${checked?"checked":""}/> ${escapeHtml(sign)}`;
        lab.addEventListener("change", () => {
          area.signs = area.signs || [];
          const i = area.signs.indexOf(sign);
          if(i>=0) area.signs.splice(i,1); else area.signs.push(sign);
          debounceSave();
          renderAreasAndSigns(); // rerender to update chosen summary
        });
        row.appendChild(lab);
      });

      chosen.textContent = (area.signs && area.signs.length) ? area.signs.join(" • ") : "—";
      signsWrap.appendChild(box);
    });
  }

  function underInsuranceText(kind){
    const cov = (kind==="building") ? state.coverage.building : state.coverage.contents;
    const insured = safeNum(cov.insured);
    const actual = safeNum(cov.actual);

    const forced = cov.check;
    if(forced === "forceNo") return { ratio: 1, text: "אין תת‑ביטוח (ידני)." };
    if(forced === "forceYes"){
      const ratio = actual>0 ? Math.min(1, insured/actual) : 0.5;
      return { ratio, text: "קיים תת‑ביטוח (ידני). יחס: " + ratio.toFixed(2) };
    }
    if(actual<=0 || insured<=0) return { ratio: 1, text: "חישוב תת‑ביטוח: חסרים נתונים." };
    const ratio = Math.min(1, insured/actual);
    if(ratio >= 0.999) return { ratio:1, text:"חישוב תת‑ביטוח: סכום הביטוח תואם." };
    return { ratio, text:"חישוב תת‑ביטוח: קיים תת‑ביטוח ביחס " + ratio.toFixed(2) + " (מבוטח/נדרש)." };
  }

  function renderCoverageRatios(){
    const b = underInsuranceText("building");
    const c = underInsuranceText("contents");
    qs("covB_ratio").textContent = b.text;
    qs("covC_ratio").textContent = c.text;
  }

  function boqHeadCells(){
    // Base cols: desc, unit, qty, unitPrice, total
    // Insurance: reinstate, indemnity (auto 2/3), optional claim
    // Tax: indemnity only (and we still store unit price/total; display simplified)
    const mode = state.meta.mode;
    const claim = !!state.boq.enableClaimColumn && mode === "insurance";

    if(mode === "insurance"){
      return [
        {k:"desc", t:"תיאור"},
        {k:"unit", t:"יח׳"},
        {k:"qty", t:"כמות"},
        claim ? {k:"claim", t:"תביעה"} : null,
        {k:"reinstate", t:"כינון"},
        {k:"indemnity", t:"שיפוי (‑⅓)"},
        {k:"actions", t:""}
      ].filter(Boolean);
    }
    if(mode === "tax"){
      return [
        {k:"desc", t:"תיאור"},
        {k:"unit", t:"יח׳"},
        {k:"qty", t:"כמות"},
        {k:"indemnity", t:"שיפוי"},
        {k:"actions", t:""}
      ];
    }
    // private
    return [
      {k:"desc", t:"תיאור"},
      {k:"unit", t:"יח׳"},
      {k:"qty", t:"כמות"},
      {k:"unitPrice", t:"מחיר יח׳"},
      {k:"total", t:"סה״כ"},
      {k:"actions", t:""}
    ];
  }

  function newBoqRow(){
    const mode = state.meta.mode;
    const row = { id: cryptoId(), desc:"", unit:"", qty:"", unitPrice:"" , total:"", claim:"", reinstate:"", indemnity:"" };
    if(mode === "insurance"){
      row.reinstate = "";
      row.indemnity = "";
    }
    if(mode === "tax"){
      row.indemnity = "";
    }
    return row;
  }

  function cryptoId(){
    return "r_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function computeBoqRow(row){
    const mode = state.meta.mode;

    if(mode === "private"){
      const qty = safeNum(row.qty);
      const up = safeNum(row.unitPrice);
      row.total = (qty * up) ? String(qty * up) : (row.total||"");
      return row;
    }

    if(mode === "insurance"){
      // If plumber arrangement and row seems like "תיקון פיצוץ/שרברב" we keep value but note in report; no pricing enforced here.
      const rein = safeNum(row.reinstate);
      const indemn = rein ? rein * (2/3) : safeNum(row.indemnity);
      row.indemnity = rein ? String(indemn) : row.indemnity;
      return row;
    }

    if(mode === "tax"){
      // tax: only indemnity, but allow manual
      const ind = safeNum(row.indemnity);
      row.indemnity = ind ? String(ind) : row.indemnity;
      return row;
    }
  }

  function renderBoq(){
    const head = boqHeadCells();

    function renderTable(headEl, bodyEl, rows){
      headEl.innerHTML = "";
      head.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h.t;
        headEl.appendChild(th);
      });
      bodyEl.innerHTML = "";

      rows.forEach((row, idx) => {
        computeBoqRow(row);
        const tr = document.createElement("tr");

        head.forEach(h => {
          const td = document.createElement("td");

          if(h.k === "actions"){
            td.innerHTML = `<button class="smallBtn danger" type="button">מחק</button>`;
            td.querySelector("button").addEventListener("click", () => {
              rows.splice(idx,1);
              debounceSave();
              renderBoq();
            });
            tr.appendChild(td);
            return;
          }

          const input = document.createElement(h.k === "desc" ? "textarea" : "input");
          input.value = row[h.k] ?? "";
          input.placeholder = (h.k==="desc") ? "תיאור סעיף" : "";
          input.className = (["qty","unitPrice","total","claim","reinstate","indemnity"].includes(h.k)) ? "num" : "";
          if(h.k === "desc"){ input.style.minHeight="44px"; input.style.resize="vertical"; }

          input.addEventListener("input", () => {
            row[h.k] = input.value;
            computeBoqRow(row);
            // update dependent fields without re-rendering whole table aggressively
            debounceSave();
            renderBoq();
          });

          td.appendChild(input);
          tr.appendChild(td);
        });

        bodyEl.appendChild(tr);
      });
    }

    renderTable(qs("boqBuildingHead"), qs("boqBuildingBody"), state.boq.building);
    renderTable(qs("boqContentsHead"), qs("boqContentsBody"), state.boq.contents);
  }

  async function fileToDataURL(file){
    return new Promise((resolve,reject) => {
      try{
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result||""));
        reader.onerror = () => reject(reader.error || new Error("FileReader error"));
        reader.readAsDataURL(file);
      }catch(e){ reject(e); }
    });
  }

  async function setHero(file){
    if(!file) return;
    const url = await fileToDataURL(file);
    state.photos.hero.src = url;
    debounceSave();
    renderPhotos();
  }

  function deleteHero(){
    state.photos.hero.src = "";
    state.photos.hero.caption = "";
    qs("heroCaption").value = "";
    debounceSave();
    renderPhotos();
  }

  async function addGalleryFiles(files){
    const list = Array.from(files || []);
    for(const file of list){
      if(state.photos.gallery.length >= 8) break;
      const url = await fileToDataURL(file);
      state.photos.gallery.push({ id: cryptoId(), src: url, caption: "" });
    }
    debounceSave();
    renderPhotos();
  }

  function moveGallery(id, dir){
    const i = state.photos.gallery.findIndex(p => p.id === id);
    if(i < 0) return;
    const j = i + dir;
    if(j < 0 || j >= state.photos.gallery.length) return;
    const tmp = state.photos.gallery[i];
    state.photos.gallery[i] = state.photos.gallery[j];
    state.photos.gallery[j] = tmp;
    debounceSave();
    renderPhotos();
  }

  function deleteGallery(id){
    state.photos.gallery = state.photos.gallery.filter(p => p.id !== id);
    debounceSave();
    renderPhotos();
  }

  function renderPhotos(){
    // hero thumb
    const heroThumb = qs("heroThumb");
    heroThumb.innerHTML = "";
    if(state.photos.hero.src){
      const img = document.createElement("img");
      img.src = state.photos.hero.src;
      heroThumb.appendChild(img);
    }else{
      heroThumb.innerHTML = `<span class="muted mini">אין תמונה</span>`;
    }

    // gallery grid
    const grid = qs("galleryGrid");
    grid.innerHTML = "";
    state.photos.gallery.forEach(p => {
      const c = document.createElement("div");
      c.className = "photoCard";
      c.innerHTML = `
        <div class="thumb">${p.src ? `<img alt="" src="${p.src}">` : `<span class="muted mini">—</span>`}</div>
        <div class="field">
          <label>כיתוב</label>
          <input value="${escapeHtml(p.caption||"")}" placeholder="לדוגמה: חדר רחצה – מוקד רטיבות">
        </div>
        <div class="row">
          <div class="orderBtns">
            <button type="button" class="smallBtn">↑</button>
            <button type="button" class="smallBtn">↓</button>
          </div>
          <button type="button" class="smallBtn danger">מחק</button>
        </div>
      `;
      const input = c.querySelector("input");
      input.addEventListener("input", () => {
        p.caption = input.value;
        debounceSave();
      });
      const btnUp = c.querySelectorAll("button")[0];
      const btnDn = c.querySelectorAll("button")[1];
      const btnDel = c.querySelectorAll("button")[2];
      btnUp.addEventListener("click", () => moveGallery(p.id, -1));
      btnDn.addEventListener("click", () => moveGallery(p.id, +1));
      btnDel.addEventListener("click", () => deleteGallery(p.id));

      grid.appendChild(c);
    });

    qs("btnHeroDelete").disabled = !state.photos.hero.src;
  }

  function makeOpeningText(){
    if(state.event.openingOverride.trim()) return state.event.openingOverride.trim();

    const mode = state.meta.mode;
    const incidentLabel = {
      water: "נזקי מים/צנרת",
      fire: "נזקי שריפה/עשן/פיח",
      burglary: "נזקי פריצה/גניבה",
      taxEvent: "אירוע מס רכוש"
    }[state.event.type] || "אירוע";

    const dateEv = state.meta.eventDate || "—";
    const dateVisit = state.meta.visitDate || "—";
    const addr = state.meta.address || "—";

    const police = state.event.docPolice ? "המבוטחים/הנבדקים הגישו תלונה במשטרה." : "";
    const fire = state.event.docFire ? "קיים דוח כבאות (ככל שנמסר)." : "";
    const requester = (mode === "insurance") ? "עבור חברת ביטוח" : (mode === "tax" ? "לצורך הליך מס רכוש" : "לצורך תביעת ביטוח/שימוש עצמי");

    return [
      `הח"מ התבקש לערוך חוות דעת שמאית בגין ${incidentLabel} אשר אירעו ביום ${dateEv}, בנכס בכתובת ${addr}.`,
      `הביקור בנכס נערך ביום ${dateVisit}. במהלך הביקור נבדקו הנזקים, תועדו הממצאים ונערכה בדיקה מקצועית במקום (${requester}).`,
      police,
      fire
    ].filter(Boolean).join("\n");
  }

  function makeCircumstancesText(){
    if(state.circumstances.override.trim()) return state.circumstances.override.trim();
    const parts = [];
    if(state.circumstances.free.trim()){
      parts.push(`לדברי המבוטח/השוהה בנכס: ${state.circumstances.free.trim()}`);
    }
    if(state.event.type === "water"){
      if(state.circumstances.waterPrevRepair) parts.push("נמסר כי בוצע תיקון קודם בנכס.");
      if(state.circumstances.waterRecentPlumber) parts.push("נמסר כי בחודשים האחרונים הוזמן שרברב/שרברב מטעם הביטוח.");
      if(state.circumstances.waterFollowText.trim()){
        parts.push(state.circumstances.waterFollowText.trim());
      }
    }
    return parts.length ? parts.join("\n") : "—";
  }

  function compressAreaSigns(signs){
    // Simple de-dup + join; later can be improved with semantic grouping (we keep stable now)
    const uniq = Array.from(new Set((signs||[]).map(s => String(s).trim()).filter(Boolean)));
    if(!uniq.length) return "";
    // A small compression: group plaster/paint/wet marks into one phrase if many
    const hasPlaster = uniq.some(x => x.includes("טיח"));
    const hasPaint = uniq.some(x => x.includes("צבע"));
    const hasMarks = uniq.some(x => x.includes("כתמי") || x.includes("רטיבות"));
    if(hasPlaster && hasPaint && hasMarks){
      const remaining = uniq.filter(x => !(x.includes("טיח") || x.includes("צבע") || x.includes("כתמי") || x.includes("רטיבות")));
      return ["כתמי רטיבות/ממצאי לחות בקירות/תקרה, פגיעה בטיח ובצבע", ...remaining].join(", ");
    }
    return uniq.join(", ");
  }

  function makeDamageText(){
    if(state.damage.override.trim()) return state.damage.override.trim();
    if(!state.damage.areas.length) return "—";

    const lines = [];
    const eventLabel = {
      water:"חדירת מים/צנרת",
      fire:"אירוע שריפה/עשן/פיח",
      burglary:"אירוע פריצה/גניבה",
      taxEvent:"אירוע מס רכוש"
    }[state.event.type] || "אירוע";

    lines.push(`במהלך הביקור במקום התגלו נזקים כתוצאה מ${eventLabel} באזורים הבאים:`);

    state.damage.areas.forEach(a => {
      const s = compressAreaSigns(a.signs);
      if(s){
        lines.push(`• ${a.name}: ${s}.`);
      }else{
        lines.push(`• ${a.name}: נצפה נזק/ממצאים ללא פירוט תתי‑פגיעה.`);
      }
    });

    // Private wide scope hint
    if(state.meta.mode === "private" && state.boq.privateWideScope){
      lines.push("הערה: במסגרת שומה פרטית בוצעה הערכה בגישה רחבה יותר להחזרת המצב לקדמותו (לפי שיקול מקצועי ותנאי התביעה).");
    }

    return lines.join("\n");
  }

  function makeFindingsText(){
    if(state.findings.override.trim()) return state.findings.override.trim();

    const parts = [];
    const ev = state.findings.damageEvidence;
    if(ev === "yes") parts.push("נמצאו ממצאי פגיעה התואמים את האירוע.");
    if(ev === "no") parts.push("לא נמצאו ממצאי פגיעה מובהקים התואמים את האירוע.");
    if(state.findings.free.trim()) parts.push(state.findings.free.trim());

    // Moisture logic
    if(state.event.type === "water"){
      const m = [];
      if(state.findings.moistMeter) m.push("בוצעה בדיקה באמצעות מד לחות.");
      if(state.findings.moistAbnormal) m.push("נרשמה תוצאה חריגה – קיימת אינדיקציה ללחות/רטיבות באזורים שנבדקו (ממצא אינדיקטיבי, לא קביעה מעבדתית).");
      if(state.findings.moistLab) m.push("סומן כי תבוצע/בוצעה בדיקת מעבדה (מכון התקנים/קדיחה) בהתאם לצורך.");
      if(state.findings.moistNote.trim()) m.push(state.findings.moistNote.trim());
      if(m.length) parts.push(m.join(" "));
    }

    return parts.length ? parts.join("\n") : "—";
  }

  
  function makeExplanationsText(){
    if(state.explanations.override.trim()) return state.explanations.override.trim();

    const mode = state.meta.mode;
    const kind = state.meta.propertyKind; // residential | business | other
    const lines = [];

    lines.push("הערכת הנזק נקבעה על בסיס הממצאים שנצפו במועד הביקור בנכס ותיעוד הנזקים בשטח.");
    lines.push("הבדיקה בנכס בוצעה באופן חזותי בלבד, ללא פירוק אלמנטים וללא ביצוע בדיקות הנדסיות או מעבדתיות.");

    if(mode === "tax"){
      // מס רכוש – ברירת מחדל ללא מע״מ (בדרך כלל)
      lines.push("ההערכה אינה כוללת מע\"מ.");
    }else{
      if(kind === "residential"){
        lines.push("מדובר בדירת מגורים, ולפיכך ההערכה כוללת מע\"מ.");
      }else{
        lines.push("מדובר בנכס שאינו דירת מגורים, ולפיכך ההערכה אינה כוללת מע\"מ (ככל שרלוונטי).");
      }
    }

    lines.push("המחירים מבוססים על הצעות מחיר שהתקבלו ועל מחירון דקל שיפוצים בהתאם למקובל בשוק.");
    lines.push("כל האמור בדו\"ח זה נכון למועד הביקור בנכס.");
    lines.push("ייתכן כי במהלך ביצוע העבודות יתגלו ליקויים נוספים שלא היו גלויים לעין במועד הבדיקה, ובמקרה זה תעודכן ההערכה בהתאם.");

    return lines.join("\n");
}


  function calcBoqTotals(rows){
    const mode = state.meta.mode;
    let claim=0, rein=0, ind=0, total=0;
    (rows||[]).forEach(r => {
      if(mode === "private"){
        total += safeNum(r.total) || (safeNum(r.qty)*safeNum(r.unitPrice));
      }else if(mode === "insurance"){
        claim += safeNum(r.claim);
        rein += safeNum(r.reinstate);
        ind += safeNum(r.indemnity) || (safeNum(r.reinstate)*(2/3));
      }else{
        ind += safeNum(r.indemnity);
      }
    });
    return {claim, rein, ind, total};
  }

  function servicesLines(){
    const s = state.boq.services;
    const lines = [];
    if(s.cleaning) lines.push("• ניקיון לפני מסירה.");
    if(s.waste) lines.push("• פינוי פסולת (לפי הצורך והיקף הפירוקים/התכולה).");
    if(s.dumpster) lines.push("• פינוי פסולת באמצעות מכולה לאתר מורשה (ככל שנדרש).");
    if(s.moveContents) lines.push("• שינוע תכולה בתוך המבנה והחזרתה לצורך ביצוע עבודה (תמחור קבוע: 1,500 ₪, אם רלוונטי).");
    if(s.drying) lines.push("• ייבוש מצעים באמצעות מערכת ייבוש/או פינוי מצעים והחלפתם – לפי היקף רטיבות/לחות מתחת לריצוף.");
    if(s.note.trim()) lines.push("• הערה: " + s.note.trim());
    return lines;
  }

  
  function makePropertyText(){
    const kindLabel = ({
      residential:"דירת מגורים",
      business:"נכס עסקי (חנות/משרד)",
      warehouse:"מחסן/תעשיה",
      other:"נכס"
    }[state.meta.propertyKind] || "נכס");

    const lines = [];
    // Short, descriptive, not legal-heavy
    const typeFree = (state.meta.propertyType || "").trim();
    const area = (state.meta.areaSqm || "").trim();
    const year = (state.meta.buildYear || "").trim();
    const mat = (state.meta.buildMaterial || "").trim();
    const pre = (state.meta.preEventCondition || "").trim();

    let first = `הנכס נשוא הבדיקה הינו ${kindLabel}`;
    if(typeFree) first += ` (${typeFree})`;
    if(area) first += `, בשטח של כ‑${area} מ״ר`;
    first += ".";
    lines.push(first);

    if(year){
      lines.push(`שנת בנייה: ${year}.`);
    }

    if(mat){
      const matLabel = ({
        concrete:"בטון",
        blocks:"בלוקים",
        palkal:"פל‑קל",
        wood:"עץ",
        steel:"פלדה",
        other:"אחר"
      }[mat] || mat);
      lines.push(`חומר בנייה: ${matLabel}.`);
    }

    if(pre){
      const preLabel = ({
        good:"תקין",
        reasonable:"בלאי סביר",
        poor:"ליקויים/בלאי משמעותי",
        unknown:"לא ידוע",
        na:"לא רלוונטי"
      }[pre] || pre);
      lines.push(`מצב הנכס לפני האירוע: ${preLabel}.`);
    }

    return lines.join("\n");
  }

function coverageTableHTML(){
    if(state.meta.mode === "tax") return "";
    const b = state.coverage.building, c = state.coverage.contents;
    const bRatio = underInsuranceText("building").ratio;
    const cRatio = underInsuranceText("contents").ratio;

    const ext = state.coverage.extensions;
    const extText = [
      ext.thirdParty ? "צד ג׳" : null,
      ext.lossProfit ? "אובדן רווחים" : null
    ].filter(Boolean).join(", ");

    const extLine = extText ? `<div class="mini muted">הרחבות: ${escapeHtml(extText)}</div>` : `<div class="mini muted">הרחבות: —</div>`;

    return `
      <div class="reportSectionTitle">תכולת ביטוח / כיסויים</div>
      <div class="tblWrap" style="border-radius:14px">
        <table>
          <thead>
            <tr>
              <th>רכיב</th><th class="num">סכום ביטוח</th><th class="num">שווי בפועל</th><th class="num">השתתפות עצמית</th><th>תת‑ביטוח</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>מבנה</b></td>
              <td class="num">${fmtILS(safeNum(b.insured))}</td>
              <td class="num">${fmtILS(safeNum(b.actual))}</td>
              <td class="num">${fmtILS(safeNum(b.deduct))}</td>
              <td>${bRatio>=0.999 ? "אין" : ("כן ("+bRatio.toFixed(2)+")")}</td>
            </tr>
            <tr>
              <td><b>תכולה</b></td>
              <td class="num">${fmtILS(safeNum(c.insured))}</td>
              <td class="num">${fmtILS(safeNum(c.actual))}</td>
              <td class="num">${fmtILS(safeNum(c.deduct))}</td>
              <td>${cRatio>=0.999 ? "אין" : ("כן ("+cRatio.toFixed(2)+")")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${extLine}
    `;
  }

  function boqTableHTML(title, rows){
    const mode = state.meta.mode;
    const hasRows = (rows||[]).length > 0;

    if(state.boq.override.trim()){
      return `
        <div class="reportSectionTitle">${escapeHtml(title)} – כתב כמויות</div>
        <div>${nl2br(state.boq.override.trim())}</div>
      `;
    }

    if(!hasRows){
      return `
        <div class="reportSectionTitle">${escapeHtml(title)} – כתב כמויות</div>
        <div class="mini muted">טרם הוזנו סעיפים לכתב הכמויות.</div>
      `;
    }

    const claimOn = !!state.boq.enableClaimColumn && mode === "insurance";

    let head = "";
    let rowsHtml = "";

    if(mode === "private"){
      head = `<tr>
        <th>תיאור</th><th>יח׳</th><th class="num">כמות</th><th class="num">מחיר יח׳</th><th class="num">סה״כ</th>
      </tr>`;
      rowsHtml = rows.map(r => {
        const qty = safeNum(r.qty);
        const up = safeNum(r.unitPrice);
        const total = safeNum(r.total) || (qty*up);
        return `<tr>
          <td>${nl2br(r.desc||"")}</td>
          <td>${escapeHtml(r.unit||"")}</td>
          <td class="num">${qty ? qty : ""}</td>
          <td class="num">${up ? fmtILS(up) : ""}</td>
          <td class="num">${total ? fmtILS(total) : ""}</td>
        </tr>`;
      }).join("");
    }else if(mode === "insurance"){
      head = `<tr>
        <th>תיאור</th><th>יח׳</th><th class="num">כמות</th>
        ${claimOn ? `<th class="num">תביעה</th>` : ``}
        <th class="num">כינון</th><th class="num">שיפוי (‑⅓)</th>
      </tr>`;
      rowsHtml = rows.map(r => {
        const qty = safeNum(r.qty);
        const claim = safeNum(r.claim);
        const rein = safeNum(r.reinstate);
        const ind = safeNum(r.indemnity) || (rein*(2/3));
        return `<tr>
          <td>${nl2br(r.desc||"")}</td>
          <td>${escapeHtml(r.unit||"")}</td>
          <td class="num">${qty ? qty : ""}</td>
          ${claimOn ? `<td class="num">${claim ? fmtILS(claim) : ""}</td>` : ``}
          <td class="num">${rein ? fmtILS(rein) : ""}</td>
          <td class="num">${ind ? fmtILS(ind) : ""}</td>
        </tr>`;
      }).join("");
    }else{
      head = `<tr>
        <th>תיאור</th><th>יח׳</th><th class="num">כמות</th><th class="num">שיפוי</th>
      </tr>`;
      rowsHtml = rows.map(r => {
        const qty = safeNum(r.qty);
        const ind = safeNum(r.indemnity);
        return `<tr>
          <td>${nl2br(r.desc||"")}</td>
          <td>${escapeHtml(r.unit||"")}</td>
          <td class="num">${qty ? qty : ""}</td>
          <td class="num">${ind ? fmtILS(ind) : ""}</td>
        </tr>`;
      }).join("");
    }

    return `
      <div class="reportSectionTitle">${escapeHtml(title)} – כתב כמויות</div>
      <div class="tblWrap" style="border-radius:14px">
        <table>
          <thead>${head}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function summaryHTML(){
    if(state.summary.override.trim()){
      return `<div class="reportSectionTitle">סיכום שומה</div><div>${nl2br(state.summary.override.trim())}</div>`;
    }

    const mode = state.meta.mode;
    const bT = calcBoqTotals(state.boq.building);
    const cT = calcBoqTotals(state.boq.contents);

    const note = state.summary.sumNote.trim() ? `<div class="mini muted">${escapeHtml(state.summary.sumNote.trim())}</div>` : "";

    if(mode === "private"){
      const claim = safeNum(state.summary.sumClaim) || (bT.total + cT.total);
      return `
        <div class="reportSectionTitle">סיכום שומה</div>
        <div class="tblWrap" style="border-radius:14px">
          <table>
            <thead><tr><th>רכיב</th><th class="num">סה״כ</th></tr></thead>
            <tbody>
              <tr><td>כתב כמויות – מבנה</td><td class="num">${bT.total ? fmtILS(bT.total) : "—"}</td></tr>
              <tr><td>כתב כמויות – תכולה</td><td class="num">${cT.total ? fmtILS(cT.total) : "—"}</td></tr>
              <tr><td><b>סה״כ תביעה</b></td><td class="num"><b>${claim ? fmtILS(claim) : "—"}</b></td></tr>
            </tbody>
          </table>
        </div>
        ${note}
      `;
    }

    if(mode === "insurance"){
      const claimOn = !!state.boq.enableClaimColumn;
      const claim = claimOn ? (bT.claim + cT.claim) : 0;
      const rein = (bT.rein + cT.rein);
      const ind = (bT.ind + cT.ind);

      return `
        <div class="reportSectionTitle">סיכום שומה</div>
        <div class="tblWrap" style="border-radius:14px">
          <table>
            <thead>
              <tr>
                <th>רכיב</th>
                ${claimOn ? `<th class="num">תביעה</th>` : ``}
                <th class="num">כינון</th>
                <th class="num">שיפוי (‑⅓)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>סה״כ</td>
                ${claimOn ? `<td class="num">${claim ? fmtILS(claim) : "—"}</td>` : ``}
                <td class="num">${rein ? fmtILS(rein) : "—"}</td>
                <td class="num">${ind ? fmtILS(ind) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${note}
        ${state.coverage.extensions.plumberArrangement ? `<div class="mini muted">הערה: סומן “שרברב בהסדר” – תיקון השרברב הישיר אינו מתומחר במסגרת כתב הכמויות.</div>` : ``}
      `;
    }

    // tax
    const ind = (bT.ind + cT.ind);
    return `
      <div class="reportSectionTitle">סיכום שומה</div>
      <div class="tblWrap" style="border-radius:14px">
        <table>
          <thead><tr><th>רכיב</th><th class="num">שיפוי</th></tr></thead>
          <tbody>
            <tr><td><b>סה״כ</b></td><td class="num"><b>${ind ? fmtILS(ind) : "—"}</b></td></tr>
          </tbody>
        </table>
      </div>
      ${note}
    `;
  }

  function reportHTML(){
    // Data table (basic)
    const dataRows = [
      ["שם", state.meta.fullName],
      ["ת״ז / ח״פ", state.meta.idNumber],
      ["כתובת", state.meta.address],
      ["סוג נכס", ({
        residential:"מגורים", business:"עסק", warehouse:"מחסן/תעשיה", other:"אחר"
      }[state.meta.propertyKind] || state.meta.propertyKind)],
      ["שטח (מ״ר)", state.meta.areaSqm],
      ["תאריך מקרה", state.meta.eventDate],
      ["תאריך ביקור", state.meta.visitDate],
    ];

    // In insurance mode, include policy/insurer in table; in private keep but if empty won't harm; in tax omit policy
    if(state.meta.mode === "insurance"){
      dataRows.push(["חברת ביטוח", state.meta.insurerName]);
      dataRows.push(["מספר פוליסה", state.meta.policyNumber]);
      dataRows.push(["תאריך קבלת מסמך אחרון", state.meta.lastDocDate]);
    }

    const dataTable = `
      <div class="reportSectionTitle">טבלת נתונים</div>
      <table class="rTable">
        ${dataRows.map(([k,v]) => `
          <tr>
            <td class="rKey">${escapeHtml(k)}</td>
            <td>${escapeHtml(v || "—")}</td>
          </tr>
        `).join("")}
      </table>
    `;

    // Hero image at start
    const hero = state.photos.hero.src ? `
      <div class="reportSectionTitle">תמונה ראשית</div>
      <img class="reportImgHero" src="${state.photos.hero.src}" alt="">
      ${state.photos.hero.caption.trim() ? `<div class="mini muted">${escapeHtml(state.photos.hero.caption.trim())}</div>` : ``}
    ` : ``;

    // Opening
    const opening = `
      <div class="reportSectionTitle">הצהרת שמאי / מטרת ההגעה והיקף הבדיקה</div>
      <div>${nl2br(makeOpeningText())}</div>
    `;

    // Coverage
    const coverage = coverageTableHTML();


    // Property description
    const propertyDesc = `
      <div class="reportSectionTitle">תיאור הנכס</div>
      <div>${nl2br(makePropertyText())}</div>
    `;
    // Circumstances
    const circumstances = `
      <div class="reportSectionTitle">נסיבות המקרה (לדברי המבוטח/השוהה בנכס)</div>
      <div>${nl2br(makeCircumstancesText())}</div>
    `;

    // Damage
    const damage = `
      <div class="reportSectionTitle">תיאור הנזק (ממצאי שמאי)</div>
      <div>${nl2br(makeDamageText())}</div>
    `;

    // BOQ sections
    const boqB = boqTableHTML("מבנה", state.boq.building);
    const boqC = boqTableHTML("תכולה", state.boq.contents);

    // Services dynamic
    const svcLines = servicesLines();
    const svc = `
      <div class="reportSectionTitle">סעיפים כלליים (התאמה דינמית)</div>
      ${svcLines.length ? `<div>${nl2br(svcLines.join("\n"))}</div>` : `<div class="mini muted">לא סומנו סעיפים כלליים.</div>`}
    `;

    // Findings + Explanations
    const findings = `
      <div class="reportSectionTitle">ממצאים מחקירת האירוע / בדיקות</div>
      <div>${nl2br(makeFindingsText())}</div>
    `;

    const expl = `
      <div class="reportSectionTitle">ביאורים והסברים להערכה</div>
      <div>${nl2br(makeExplanationsText())}</div>
    `;

    // Photos section (8 images BEFORE summary)
    const gal = state.photos.gallery.slice(0,8);
    const photosSection = `
      <div class="reportSectionTitle">תיעוד תמונות מהשטח (8 תמונות עיקריות)</div>
      ${gal.length ? `
        <div class="reportGallery">
          ${gal.map(p => `
            <figure>
              <img src="${p.src}" alt="">
              <figcaption>${escapeHtml(p.caption || "ללא כיתוב")}</figcaption>
            </figure>
          `).join("")}
        </div>
      ` : `<div class="mini muted">לא הוזנו תמונות עיקריות.</div>`}
      ${state.meta.photosNote.trim() ? `<div class="mini muted" style="margin-top:8px">${escapeHtml(state.meta.photosNote.trim())}</div>` : ``}
    `;

    // Summary
    const summary = summaryHTML();

    // Recommendations / Signature
    const reco = `
      <div class="reportSectionTitle">המלצות שמאי</div>
      <div>${nl2br(state.summary.recoText.trim() || "—")}</div>
    `;
    const sign = `
      <div class="reportSectionTitle">חתימה</div>
      <div>${nl2br(state.summary.signText.trim() || "בכבוד רב,\nירון אמיר – שמאי רכוש")}</div>
    `;

    return [
      dataTable,
      hero,
      opening,
      coverage,
      propertyDesc,
      circumstances,
      damage,
      boqB,
      boqC,
      svc,
      findings,
      expl,
      photosSection,
      summary,
      reco,
      sign
    ].filter(Boolean).join("\n");
  }

  function goPreview(){
    // sync caption/note fields
    state.photos.hero.caption = qs("heroCaption").value || "";
    state.meta.photosNote = qs("photosNote").value || "";

    // required field: last document date for insurance flow
    if(state.meta.mode === "insurance" && !(state.meta.lastDocDate || "").trim()){
      alert("בשומה עבור חברת ביטוח חובה למלא: תאריך קבלת מסמך אחרון.");
      qs("lastDocDate").focus();
      return;
    }

    qs("reportContent").innerHTML = reportHTML();
    qs("formView").style.display = "none";
    qs("reportView").style.display = "block";
    window.scrollTo({top:0, behavior:"instant"});
  }

  function goBack(){
    qs("reportView").style.display = "none";
    qs("formView").style.display = "block";
    window.scrollTo({top:0, behavior:"instant"});
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "yaron_appraiser_case.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function importJSON(){
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = async () => {
      const file = inp.files && inp.files[0];
      if(!file) return;
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      state = deepMerge(defaultState(), parsed);
      renderAll();
      debounceSave();
      alert("נטען בהצלחה.");
    };
    inp.click();
  }

  function clearAll(){
    if(!confirm("ליצור תיק חדש? הנתונים הנוכחיים יוחלפו (יש שחזור אם שמור ב-JSON).")) return;
    state = defaultState();
    saveNow();
    renderAll();
  }

  function bindInputs(){
    // Mode radios
    qsa('input[name="mode"]').forEach(r => {
      r.addEventListener("change", () => setMode(r.value));
    });

    // Basic
    const map = [
      ["fullName", "meta.fullName"],
      ["idNumber", "meta.idNumber"],
      ["address", "meta.address"],
      ["areaSqm", "meta.areaSqm"],
      ["propertyType", "meta.propertyType"],
      ["buildYear", "meta.buildYear"],
      ["buildMaterial", "meta.buildMaterial"],
      ["preEventCondition", "meta.preEventCondition"],
      ["phone", "meta.phone"],
      ["eventDate", "meta.eventDate"],
      ["visitDate", "meta.visitDate"],
      ["insurerName", "meta.insurerName"],
      ["policyNumber", "meta.policyNumber"],
      ["photosNote", "meta.photosNote"],
    ];
    map.forEach(([id, path]) => {
      qs(id).addEventListener("input", (e) => {
        setPath(path, e.target.value);
      });
    });

    qs("propertyKind").addEventListener("change", (e) => {
      setPath("meta.propertyKind", e.target.value);
      renderAreasAndSigns();
    });

    // Coverage
    const covMap = [
      ["covB_insured","coverage.building.insured"],
      ["covB_actual","coverage.building.actual"],
      ["covB_deduct","coverage.building.deduct"],
      ["covC_insured","coverage.contents.insured"],
      ["covC_actual","coverage.contents.actual"],
      ["covC_deduct","coverage.contents.deduct"],
    ];
    covMap.forEach(([id, path]) => {
      qs(id).addEventListener("input", (e) => {
        setPath(path, e.target.value);
        renderCoverageRatios();
      });
    });
    qs("covB_check").addEventListener("change", (e) => { setPath("coverage.building.check", e.target.value); renderCoverageRatios(); });
    qs("covC_check").addEventListener("change", (e) => { setPath("coverage.contents.check", e.target.value); renderCoverageRatios(); });

    qs("extThirdParty").addEventListener("change", e => setPath("coverage.extensions.thirdParty", e.target.checked));
    qs("extLossProfit").addEventListener("change", e => setPath("coverage.extensions.lossProfit", e.target.checked));
    qs("bizVAT").addEventListener("change", e => setPath("coverage.extensions.bizVAT", e.target.checked));
    qs("plumberArrangement").addEventListener("change", e => setPath("coverage.extensions.plumberArrangement", e.target.checked));

    // Event
    qs("eventType").addEventListener("change", (e) => {
      // prevent selecting taxEvent outside tax mode
      if(state.meta.mode !== "tax" && e.target.value === "taxEvent"){
        e.target.value = "water";
      }
      setPath("event.type", e.target.value);
      // keep tax mode locked
      if(state.meta.mode === "tax") setPath("event.type", "taxEvent");
      renderModeVisibility();
      renderAreasAndSigns();
    });
    qs("eventSubType").addEventListener("change", (e) => {
      setPath("event.subType", e.target.value);
      renderModeVisibility();
    });
    qs("eventSubTypeOther").addEventListener("input", (e) => setPath("event.subTypeOther", e.target.value));
    qs("docPolice").addEventListener("change", (e) => setPath("event.docPolice", e.target.checked));
    qs("docFire").addEventListener("change", (e) => setPath("event.docFire", e.target.checked));
    qs("openingOverride").addEventListener("input", (e) => setPath("event.openingOverride", e.target.value));

    // Circumstances
    qs("circFree").addEventListener("input", e => setPath("circumstances.free", e.target.value));
    qs("waterPrevRepair").addEventListener("change", e => setPath("circumstances.waterPrevRepair", e.target.checked));
    qs("waterRecentPlumber").addEventListener("change", e => setPath("circumstances.waterRecentPlumber", e.target.checked));
    qs("waterFollowText").addEventListener("input", e => setPath("circumstances.waterFollowText", e.target.value));
    qs("circOverride").addEventListener("input", e => setPath("circumstances.override", e.target.value));

    // Damage
    qs("btnAddBedroom").addEventListener("click", (e) => { e.preventDefault(); addBedroom(); });
    qs("btnAddKids").addEventListener("click", (e) => { e.preventDefault(); addKids(); });
    qs("btnAddCustomArea").addEventListener("click", (e) => { e.preventDefault(); qs("customAreaWrap").style.display="block"; qs("customAreaName").focus(); });
    qs("btnConfirmCustomArea").addEventListener("click", (e) => {
      e.preventDefault();
      addCustomArea(qs("customAreaName").value);
      qs("customAreaName").value="";
      qs("customAreaWrap").style.display="none";
    });
    qs("damageOverride").addEventListener("input", e => setPath("damage.override", e.target.value));

    // Findings
    qsa('input[name="damageEvidence"]').forEach(r => {
      r.addEventListener("change", () => setPath("findings.damageEvidence", r.value));
    });
    qs("moistMeter").addEventListener("change", e => setPath("findings.moistMeter", e.target.checked));
    qs("moistAbnormal").addEventListener("change", e => setPath("findings.moistAbnormal", e.target.checked));
    qs("moistLab").addEventListener("change", e => setPath("findings.moistLab", e.target.checked));
    qs("findingsMoistNote").addEventListener("input", e => setPath("findings.moistNote", e.target.value));
    qs("findingsFree").addEventListener("input", e => setPath("findings.free", e.target.value));
    qs("findingsOverride").addEventListener("input", e => setPath("findings.override", e.target.value));

    // BOQ
    qs("enableClaimColumn").addEventListener("change", e => { setPath("boq.enableClaimColumn", e.target.checked); renderBoq(); });
    qs("privateWideScope").addEventListener("change", e => setPath("boq.privateWideScope", e.target.checked));
    qs("btnAddBoqBuilding").addEventListener("click", e => { e.preventDefault(); state.boq.building.push(newBoqRow()); debounceSave(); renderBoq(); });
    qs("btnAddBoqContents").addEventListener("click", e => { e.preventDefault(); state.boq.contents.push(newBoqRow()); debounceSave(); renderBoq(); });
    qs("svcCleaning").addEventListener("change", e => setPath("boq.services.cleaning", e.target.checked));
    qs("svcWaste").addEventListener("change", e => setPath("boq.services.waste", e.target.checked));
    qs("svcDumpster").addEventListener("change", e => setPath("boq.services.dumpster", e.target.checked));
    qs("svcMoveContents").addEventListener("change", e => setPath("boq.services.moveContents", e.target.checked));
    qs("svcDrying").addEventListener("change", e => setPath("boq.services.drying", e.target.checked));
    qs("svcNote").addEventListener("input", e => setPath("boq.services.note", e.target.value));
    qs("boqOverride").addEventListener("input", e => setPath("boq.override", e.target.value));

    // Explanations
    qs("explainOverride").addEventListener("input", e => setPath("explanations.override", e.target.value));

    // Summary
    qs("recoText").addEventListener("input", e => setPath("summary.recoText", e.target.value));
    qs("signText").addEventListener("input", e => setPath("summary.signText", e.target.value));
    qs("sumClaim").addEventListener("input", e => setPath("summary.sumClaim", e.target.value));
    qs("sumNote").addEventListener("input", e => setPath("summary.sumNote", e.target.value));
    qs("summaryOverride").addEventListener("input", e => setPath("summary.override", e.target.value));

    // Photos
    qs("heroCam").addEventListener("change", async (e) => { await setHero(e.target.files && e.target.files[0]); e.target.value=""; });
    qs("heroFile").addEventListener("change", async (e) => { await setHero(e.target.files && e.target.files[0]); e.target.value=""; });
    qs("heroCaption").addEventListener("input", e => { state.photos.hero.caption = e.target.value; debounceSave(); });
    qs("btnHeroDelete").addEventListener("click", (e) => { e.preventDefault(); deleteHero(); });

    qs("galCam").addEventListener("change", async (e) => { await addGalleryFiles(e.target.files); e.target.value=""; });
    qs("galFile").addEventListener("change", async (e) => { await addGalleryFiles(e.target.files); e.target.value=""; });

    // Topbar buttons
    qs("btnPreview").addEventListener("click", (e) => { e.preventDefault(); goPreview(); });
    qs("btnPrint").addEventListener("click", (e) => { e.preventDefault(); goPreview(); setTimeout(() => window.print(), 150); });
    qs("btnPrint2").addEventListener("click", (e) => { e.preventDefault(); window.print(); });
    qs("btnBack").addEventListener("click", (e) => { e.preventDefault(); goBack(); });

    qs("btnNew").addEventListener("click", (e) => { e.preventDefault(); clearAll(); });
    qs("btnExport").addEventListener("click", (e) => { e.preventDefault(); exportJSON(); });
    qs("btnImport").addEventListener("click", (e) => { e.preventDefault(); importJSON(); });
  }

  function setPath(path, value){
    const parts = path.split(".");
    let obj = state;
    for(let i=0;i<parts.length-1;i++){
      const p = parts[i];
      if(!obj[p] || typeof obj[p] !== "object") obj[p] = {};
      obj = obj[p];
    }
    obj[parts[parts.length-1]] = value;
    debounceSave();
  }

  function renderAll(){
    // radios mode
    qsa('input[name="mode"]').forEach(r => r.checked = (r.value === state.meta.mode));
    // basic
    qs("fullName").value = state.meta.fullName || "";
    qs("idNumber").value = state.meta.idNumber || "";
    qs("address").value = state.meta.address || "";
    qs("propertyKind").value = state.meta.propertyKind || "residential";
    qs("areaSqm").value = state.meta.areaSqm || "";
    qs("propertyType").value = state.meta.propertyType || "";
    qs("buildYear").value = state.meta.buildYear || "";
    qs("buildMaterial").value = state.meta.buildMaterial || "";
    qs("preEventCondition").value = state.meta.preEventCondition || "";
    qs("phone").value = state.meta.phone || "";
    qs("eventDate").value = state.meta.eventDate || "";
    qs("visitDate").value = state.meta.visitDate || "";
    qs("insurerName").value = state.meta.insurerName || "";
    qs("policyNumber").value = state.meta.policyNumber || "";
    qs("photosNote").value = state.meta.photosNote || "";

    // coverage
    qs("covB_insured").value = state.coverage.building.insured || "";
    qs("covB_actual").value = state.coverage.building.actual || "";
    qs("covB_deduct").value = state.coverage.building.deduct || "";
    qs("covB_check").value = state.coverage.building.check || "auto";

    qs("covC_insured").value = state.coverage.contents.insured || "";
    qs("covC_actual").value = state.coverage.contents.actual || "";
    qs("covC_deduct").value = state.coverage.contents.deduct || "";
    qs("covC_check").value = state.coverage.contents.check || "auto";

    qs("extThirdParty").checked = !!state.coverage.extensions.thirdParty;
    qs("extLossProfit").checked = !!state.coverage.extensions.lossProfit;
    qs("bizVAT").checked = !!state.coverage.extensions.bizVAT;
    qs("plumberArrangement").checked = !!state.coverage.extensions.plumberArrangement;

    // event
    qs("eventType").value = state.event.type || "water";
    qs("eventSubType").value = state.event.subType || "";
    qs("eventSubTypeOther").value = state.event.subTypeOther || "";
    qs("docPolice").checked = !!state.event.docPolice;
    qs("docFire").checked = !!state.event.docFire;
    qs("openingOverride").value = state.event.openingOverride || "";

    // circumstances
    qs("circFree").value = state.circumstances.free || "";
    qs("waterPrevRepair").checked = !!state.circumstances.waterPrevRepair;
    qs("waterRecentPlumber").checked = !!state.circumstances.waterRecentPlumber;
    qs("waterFollowText").value = state.circumstances.waterFollowText || "";
    qs("circOverride").value = state.circumstances.override || "";

    // damage
    qs("damageOverride").value = state.damage.override || "";

    // findings
    qsa('input[name="damageEvidence"]').forEach(r => r.checked = (r.value === (state.findings.damageEvidence || "na")));
    qs("moistMeter").checked = !!state.findings.moistMeter;
    qs("moistAbnormal").checked = !!state.findings.moistAbnormal;
    qs("moistLab").checked = !!state.findings.moistLab;
    qs("findingsMoistNote").value = state.findings.moistNote || "";
    qs("findingsFree").value = state.findings.free || "";
    qs("findingsOverride").value = state.findings.override || "";

    // boq
    qs("enableClaimColumn").checked = !!state.boq.enableClaimColumn;
    qs("privateWideScope").checked = !!state.boq.privateWideScope;
    qs("svcCleaning").checked = !!state.boq.services.cleaning;
    qs("svcWaste").checked = !!state.boq.services.waste;
    qs("svcDumpster").checked = !!state.boq.services.dumpster;
    qs("svcMoveContents").checked = !!state.boq.services.moveContents;
    qs("svcDrying").checked = !!state.boq.services.drying;
    qs("svcNote").value = state.boq.services.note || "";
    qs("boqOverride").value = state.boq.override || "";

    // explanations
    qs("explainOverride").value = state.explanations.override || "";

    // summary
    qs("recoText").value = state.summary.recoText || "";
    qs("signText").value = state.summary.signText || "";
    qs("sumClaim").value = state.summary.sumClaim || "";
    qs("sumNote").value = state.summary.sumNote || "";
    qs("summaryOverride").value = state.summary.override || "";

    // photos
    qs("heroCaption").value = state.photos.hero.caption || "";
    renderPhotos();

    // visibility rules + derived
    renderModeVisibility();
    renderCoverageRatios();
    renderAreasAndSigns();
    renderBoq();
  }

  // Init
  loadState();
  bindInputs();
  // Ensure mode radio consistent even if loaded
  if(!["private","insurance","tax"].includes(state.meta.mode)) state.meta.mode = "private";
  renderAll();
  saveNow();

})();


/* ===== PRO: Case Manager + Dashboard + Step Navigation + Autosave ===== */
(() => {
  "use strict";

  const LS_INDEX = "YA_CASE_INDEX_V1";
  const LS_ACTIVE = "YA_ACTIVE_CASE_V1";
  const LS_FIELD_MODE = "YA_FIELD_MODE_V1";

  const $ = (id) => document.getElementById(id);

  function nowISO(){ return new Date().toISOString(); }
  function uid(){
    return (crypto?.randomUUID ? crypto.randomUUID() : ("c_" + Math.random().toString(16).slice(2) + Date.now().toString(16))).slice(0, 36);
  }

  function toast(msg){
    const t = $("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function safeParse(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  }

  function loadIndex(){ return safeParse(localStorage.getItem(LS_INDEX), []); }
  function saveIndex(arr){ localStorage.setItem(LS_INDEX, JSON.stringify(arr)); }
  function getActiveCaseId(){ return localStorage.getItem(LS_ACTIVE) || ""; }
  function setActiveCaseId(id){ localStorage.setItem(LS_ACTIVE, id); }
  function caseKey(id){ return "YA_CASE_DATA_" + id; }

  function ensureCaseIndexHas(id){
    const idx = loadIndex();
    if(idx.some(x => x.id === id)) return idx;
    const item = { id, name: "תיק ללא שם", createdAt: nowISO(), updatedAt: nowISO() };
    idx.unshift(item);
    saveIndex(idx);
    return idx;
  }

  function updateIndexMeta(id, patch){
    const idx = loadIndex();
    const i = idx.findIndex(x => x.id === id);
    if(i === -1) return;
    idx[i] = { ...idx[i], ...patch, updatedAt: nowISO() };
    saveIndex(idx);
  }

  function deleteCase(id){
    const idx = loadIndex().filter(x => x.id !== id);
    saveIndex(idx);
    localStorage.removeItem(caseKey(id));
    if(getActiveCaseId() === id) setActiveCaseId("");
  }

  function exportCase(id){
    const idx = loadIndex();
    const meta = idx.find(x => x.id === id) || { id, name:"תיק", createdAt:null, updatedAt:null };
    const data = safeParse(localStorage.getItem(caseKey(id)), {});
    const blob = new Blob([JSON.stringify({ meta, data }, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    const dt = new Date().toISOString().slice(0,10);
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.name || "case"}_${dt}.json`.replace(/[^\w\u0590-\u05FF\-\.]+/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function setSavedPill(state){
    const pill = $("pillSaved");
    if(!pill) return;
    pill.textContent = state === "dirty" ? "לא נשמר" : "נשמר";
    pill.classList.toggle("warn", state === "dirty");
    pill.classList.toggle("ok", state !== "dirty");
  }

  function collectFormSnapshot(){
    const root = document.getElementById("formView") || document.getElementById("viewCase");
    if(!root) return {};
    const snap = {};
    const fields = root.querySelectorAll("input, select, textarea");
    fields.forEach((el) => {
      if(!el.name && !el.id) return;
      const key = (el.name || el.id).trim();
      if(!key) return;

      if(el.type === "checkbox"){
        snap[key] = !!el.checked;
      }else if(el.type === "radio"){
        if(el.checked) snap[key] = el.value;
      }else if(el.type === "file"){
        // skip
      }else{
        snap[key] = el.value;
      }
    });

    const details = root.querySelectorAll("details[id]");
    details.forEach(d => snap["__details__" + d.id] = d.open ? 1 : 0);

    return snap;
  }

  function applyFormSnapshot(snap){
    const root = document.getElementById("formView") || document.getElementById("viewCase");
    if(!root || !snap) return;

    const fields = root.querySelectorAll("input, select, textarea");
    fields.forEach(el => {
      const key = (el.name || el.id || "").trim();
      if(!key || !(key in snap)) return;

      if(el.type === "checkbox"){
        el.checked = !!snap[key];
      }else if(el.type === "radio"){
        el.checked = (String(el.value) === String(snap[key]));
      }else if(el.type === "file"){
        // skip
      }else{
        el.value = snap[key] ?? "";
      }
      el.dispatchEvent(new Event("input", { bubbles:true }));
      el.dispatchEvent(new Event("change", { bubbles:true }));
    });

    const details = root.querySelectorAll("details[id]");
    details.forEach(d => {
      const k = "__details__" + d.id;
      if(k in snap) d.open = !!snap[k];
    });
  }

  let saveTimer = null;
  function scheduleSave(){
    clearTimeout(saveTimer);
    setSavedPill("dirty");
    saveTimer = setTimeout(saveActiveCase, 450);
  }

  function saveActiveCase(){
    const id = getActiveCaseId();
    if(!id) return;
    const snap = collectFormSnapshot();
    localStorage.setItem(caseKey(id), JSON.stringify(snap));
    updateIndexMeta(id, {});
    setSavedPill("ok");
  }

  function showDashboard(){
    $("viewDashboard").hidden = false;
    $("viewCase").hidden = true;
    $("topTitle").textContent = "דשבורד תיקים";
    $("topSub").textContent = "יצירה, ניהול ומילוי טפסים";
    $("pillCase").textContent = "ללא תיק";
    $("sideNav").innerHTML = "";
    $("btnExportCase").disabled = true;
    $("btnDeleteCase").disabled = true;
    $("btnPrev").disabled = true;
    $("btnNext").disabled = true;
    updateProgressUI(0,0);
  }

  function showCase(id){
    $("viewDashboard").hidden = true;
    $("viewCase").hidden = false;

    const idx = ensureCaseIndexHas(id);
    const meta = idx.find(x => x.id === id);
    $("topTitle").textContent = meta?.name || "תיק";
    $("topSub").textContent = "מילוי טופס והפקת דוח";
    $("pillCase").textContent = meta?.name || "תיק";
    $("btnExportCase").disabled = false;
    $("btnDeleteCase").disabled = false;
    $("btnPrev").disabled = false;
    $("btnNext").disabled = false;

    buildNav();

    const snap = safeParse(localStorage.getItem(caseKey(id)), null);
    if(snap) applyFormSnapshot(snap);

    attachAutosave();
    setTimeout(updateProgress, 200);
  }

  let sections = [];
  let activeIdx = 0;
  let autosaveAttached = false;

  function buildNav(){
    const nav = $("sideNav");
    if(!nav) return;
    const formView = document.getElementById("formView");
    if(!formView) return;

    let cards = Array.from(formView.children).filter(el => el.classList && el.classList.contains("card"));
    if(!cards.length) cards = Array.from(formView.querySelectorAll(":scope > .card"));

    sections = cards.map((card, i) => {
      const h2 = card.querySelector(":scope > h2");
      const title = (h2?.textContent || "").trim() || `סעיף ${i+1}`;
      const id = card.id || ("sec_" + (i+1));
      card.id = id;
      card.dataset.section = "1";
      return { id, title, i };
    });

    nav.innerHTML = "";
    sections.forEach((s, i) => {
      const item = document.createElement("div");
      item.className = "navItem";
      item.tabIndex = 0;
      item.innerHTML = `<div><div class="t">${escapeHtmlSafe(s.title)}</div><div class="k">סעיף ${i+1}</div></div><div class="k">↩</div>`;
      const go = () => { activeIdx = i; scrollToSection(i); };
      item.addEventListener("click", go);
      item.addEventListener("keydown", (e) => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); }});
      nav.appendChild(item);
    });

    const navItems = () => Array.from(nav.querySelectorAll(".navItem"));
    const io = new IntersectionObserver((entries) => {
      const v = entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!v) return;
      const id = v.target.id;
      const i = sections.findIndex(s => s.id === id);
      if(i >= 0){
        activeIdx = i;
        navItems().forEach((ni, idx) => ni.classList.toggle("active", idx === i));
      }
    }, { root:null, rootMargin:"-35% 0px -60% 0px", threshold:[0.05,0.2,0.35] });

    sections.forEach(s => { const el = document.getElementById(s.id); if(el) io.observe(el); });
    navItems().forEach((ni, idx) => ni.classList.toggle("active", idx === 0));
  }

  function scrollToSection(i){
    const s = sections[i];
    if(!s) return;
    document.getElementById(s.id)?.scrollIntoView({ behavior:"smooth", block:"start" });
  }
  function stepNext(){ if(!sections.length) return; activeIdx = Math.min(activeIdx+1, sections.length-1); scrollToSection(activeIdx); }
  function stepPrev(){ if(!sections.length) return; activeIdx = Math.max(activeIdx-1, 0); scrollToSection(activeIdx); }

  function updateProgressUI(done, total){
    const pct = total ? Math.round((done/total)*100) : 0;
    $("progressFill").style.width = pct + "%";
    $("progressText").textContent = pct + "%";
  }

  function isFieldCountable(el){
    if(!el) return false;
    if(el.type === "file") return false;
    if(el.disabled) return false;
    return ["INPUT","SELECT","TEXTAREA"].includes(el.tagName);
  }

  function fieldHasValue(el){
    if(el.type === "checkbox") return !!el.checked;
    const v = (el.value ?? "").toString().trim();
    return v.length > 0;
  }

  function updateProgress(){
    const formView = document.getElementById("formView");
    if(!formView) return;
    const els = Array.from(formView.querySelectorAll("input, select, textarea")).filter(isFieldCountable);

    const radios = els.filter(e => e.type === "radio" && e.name);
    const radioNames = Array.from(new Set(radios.map(r => r.name)));

    let total = 0, done = 0;

    els.filter(e => e.type !== "radio").forEach(e => {
      total++;
      if(fieldHasValue(e)) done++;
    });

    radioNames.forEach(name => {
      total++;
      const any = formView.querySelector(`input[type="radio"][name="${CSS.escape(name)}"]:checked`);
      if(any) done++;
    });

    updateProgressUI(done, total);
  }

  function attachAutosave(){
    if(autosaveAttached) return;
    autosaveAttached = true;
    const formView = document.getElementById("formView");
    if(!formView) return;
    formView.addEventListener("input", () => { scheduleSave(); updateProgress(); }, { capture:true });
    formView.addEventListener("change", () => { scheduleSave(); updateProgress(); }, { capture:true });
  }

  function setFieldMode(on){
    document.body.classList.toggle("fieldMode", !!on);
    localStorage.setItem(LS_FIELD_MODE, on ? "1" : "0");
    const t = $("toggleFieldMode");
    if(t) t.checked = !!on;
  }

  function deriveCaseName(){
    const candidates = ["insuredName","policyHolder","claimantName","clientName","insured_name","שםמבוטח","שם_מבוטח","address","propertyAddress","siteAddress","כתובת"];
    for(const key of candidates){
      const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
      const v = (el?.value || "").trim();
      if(v && v.length >= 3) return v;
    }
    return "";
  }

  function renameCaseFromForm(){
    const id = getActiveCaseId();
    if(!id) return;
    const name = deriveCaseName();
    if(!name) return;
    updateIndexMeta(id, { name });
    const meta = loadIndex().find(x => x.id === id);
    if(meta){
      $("topTitle").textContent = meta.name;
      $("pillCase").textContent = meta.name;
    }
    renderCases();
  }

  function renderCases(){
    const list = $("caseList");
    if(!list) return;
    const idx = loadIndex();

    if(!idx.length){
      list.innerHTML = `<div class="muted">אין תיקים עדיין. לחץ “תיק חדש”.</div>`;
      return;
    }

    const active = getActiveCaseId();
    list.innerHTML = "";

    idx.forEach(meta => {
      const row = document.createElement("div");
      row.className = "caseRow";
      const isActive = meta.id === active;
      const upd = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("he-IL") : "";

      row.innerHTML = `
        <div class="meta">
          <div class="name">${escapeHtmlSafe(meta.name || "תיק ללא שם")}${isActive ? " • (פעיל)" : ""}</div>
          <div class="sub">עודכן: ${escapeHtmlSafe(upd)}</div>
        </div>
        <div class="actions">
          <button class="smallBtn" type="button" data-open="${meta.id}">פתח</button>
          <button class="smallBtn" type="button" data-export="${meta.id}">יצוא</button>
          <button class="smallBtn danger" type="button" data-del="${meta.id}">מחק</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.onclick = (e) => {
      const btn = e.target?.closest("button");
      if(!btn) return;
      const openId = btn.getAttribute("data-open");
      const expId = btn.getAttribute("data-export");
      const delId = btn.getAttribute("data-del");

      if(openId){
        openCase(openId);
      }else if(expId){
        exportCase(expId);
      }else if(delId){
        if(confirm("למחוק את התיק? זה בלתי הפיך.")){
          deleteCase(delId);
          toast("תיק נמחק");
          renderCases();
          if(!getActiveCaseId()) showDashboard();
        }
      }
    };
  }

  function openCase(id){
    setActiveCaseId(id);
    showCase(id);
    toast("תיק נטען");
    $("proSide")?.classList.remove("open");
  }

  function createNewCase(){
    const id = uid();
    const idx = loadIndex();
    idx.unshift({ id, name:"תיק חדש", createdAt: nowISO(), updatedAt: nowISO() });
    saveIndex(idx);
    setActiveCaseId(id);
    localStorage.setItem(caseKey(id), JSON.stringify({}));
    renderCases();
    openCase(id);
    toast("נוצר תיק חדש");
  }

  function escapeHtmlSafe(s){
    try{ if(typeof window.escapeHtml === "function") return window.escapeHtml(s); }catch(_){}
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  async function maybeRegisterSW(){
    try{ if(!("serviceWorker" in navigator)) return; await navigator.serviceWorker.register("./sw.js"); }catch(_){}
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("btnNewCase")?.addEventListener("click", createNewCase);
    $("dashNewCase")?.addEventListener("click", createNewCase);
    $("btnDashboard")?.addEventListener("click", () => { setActiveCaseId(""); showDashboard(); renderCases(); });
    $("btnToggleSide")?.addEventListener("click", () => $("proSide")?.classList.toggle("open"));
    $("btnNext")?.addEventListener("click", stepNext);
    $("btnPrev")?.addEventListener("click", stepPrev);

    $("btnExportCase")?.addEventListener("click", () => { const id = getActiveCaseId(); if(id) exportCase(id); });
    $("btnDeleteCase")?.addEventListener("click", () => {
      const id = getActiveCaseId();
      if(!id) return;
      if(confirm("למחוק את התיק הפעיל? זה בלתי הפיך.")){
        deleteCase(id);
        toast("תיק נמחק");
        renderCases();
        showDashboard();
      }
    });

    const fm = localStorage.getItem(LS_FIELD_MODE) === "1";
    setFieldMode(fm);
    $("toggleFieldMode")?.addEventListener("change", (e) => setFieldMode(!!e.target.checked));

    document.addEventListener("change", () => {
      clearTimeout(renameCaseFromForm._t);
      renameCaseFromForm._t = setTimeout(renameCaseFromForm, 900);
    }, { capture:true });

    renderCases();

    const active = getActiveCaseId();
    if(active) showCase(active);
    else showDashboard();

    maybeRegisterSW();
  });

})();

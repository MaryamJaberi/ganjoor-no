const API = "https://api.ganjoor.net/api/ganjoor";
const root = document.querySelector("#content");
const bar = document.querySelector("#bar");
const foot = document.querySelector("#foot");
const mobile = document.querySelector("#mobile");
const menuBtn = document.querySelector("#menu");
const form = document.querySelector("#search-form");
const input = document.querySelector("#q");
const cache = new Map();
let renderToken = 0;
let audioNode = null;

const store = {
  key: "ganjoor-no-read",
  get() {
    try {
      const data = JSON.parse(localStorage.getItem(this.key) || "{}");
      data.marks = data.marks || [];
      data.notes = data.notes || {};
      data.history = data.history || [];
      return data;
    } catch {
      return { marks: [], notes: {}, history: [] };
    }
  },
  set(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },
  toggle(id) {
    const data = this.get();
    data.marks = data.marks.includes(id) ? data.marks.filter((item) => item !== id) : [id, ...data.marks];
    this.set(data);
  },
  note(id, text) {
    const data = this.get();
    data.notes[id] = text;
    this.set(data);
  },
  visit(id) {
    const data = this.get();
    data.history = [id, ...data.history.filter((item) => item !== id)].slice(0, 24);
    this.set(data);
  },
};

function esc(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(value ?? "").replace(/[&<>"]/g, (ch) => map[ch]);
}

function centuryOf(year) {
  if (!year) return 0;
  return Math.floor((year - 1) / 100) + 1;
}

async function api(path) {
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json();
  const total = Number(response.headers.get("items-count") || 0);
  const packed = { data, total };
  cache.set(path, packed);
  return packed;
}

function paint(title, html, quiet = false) {
  document.title = `${title} — گنجور نو`;
  document.body.classList.toggle("quiet", quiet);
  bar.hidden = quiet;
  foot.hidden = quiet;
  root.innerHTML = `<div class="sheet">${html}</div>`;
  window.scrollTo(0, 0);
}

function loading(title) {
  paint(title, `<p class="muted">در حال آوردن از گنجور…</p>`);
}

function failed(error) {
  paint("خطا", `<h1>ارتباط برقرار نشد</h1><p>گنجور الان جواب نداد. اتصال را بررسی کن و دوباره باز کن.</p><p class="muted">${esc(error.message)}</p>`);
}

function poetFace(poet) {
  const letter = esc((poet.nickname || poet.name || "؟").slice(0, 1));
  const img = poet.imageUrl ? `<img alt="" src="https://api.ganjoor.net${esc(poet.imageUrl)}" onerror="this.remove()" />` : "";
  const years = poet.birthYearInLHijri ? `${poet.birthYearInLHijri}–${poet.deathYearInLHijri || "؟"}` : "";
  return `<a class="face" href="#/poet/${poet.id}"><span class="medal">${img}<b>${letter}</b></span><strong>${esc(poet.nickname || poet.name)}</strong><small>${esc(poet.birthPlace || "")}${years ? " · " + years : ""}</small></a>`;
}

async function home() {
  loading("خانه");
  const { data: poets } = await api("/poets");
  const pinned = [...poets].filter((poet) => poet.pinOrder).sort((a, b) => a.pinOrder - b.pinOrder).slice(0, 10);
  const centuries = [...new Set(poets.map((poet) => centuryOf(poet.birthYearInLHijri)).filter(Boolean))].sort((a, b) => a - b);
  paint(
    "خانه",
    `<section class="welcome">
       <div>
         <p class="kicker">خواندن شعر فارسی</p>
         <h1>به جهان شعر پارسی خوش آمدید</h1>
         <p class="lead">همه شاعران و شعرهای منتشرشده گنجور اینجاست. متن را بخوان، صوت را بشنو، و نشان را برای خودت نگه دار.</p>
         <form class="big-search" id="home-search">
           <input name="q" placeholder="بیت، واژه یا نام شاعر…" aria-label="جستجو" />
           <button class="btn primary" type="submit">جستجو</button>
         </form>
         <p class="chips">
           <a class="chip" href="#/poets">همه شاعران</a>
           <a class="chip" href="#/map">نقشه هم‌عصران</a>
           <button class="chip" id="random" type="button">یک شعر تصادفی</button>
         </p>
       </div>
       <a class="calligraphy" href="#/poet/2">حافظ</a>
     </section>
     <h2 class="section">شاعران برجسته</h2>
     <div class="faces">${pinned.map(poetFace).join("")}</div>
     <h2 class="section">پیمایش بر اساس قرن</h2>
     <div class="cents">${centuries.map((item) => `<a class="cent" href="#/poets?c=${item}">قرن ${item}</a>`).join("")}</div>
     <p class="note">متن و صوت از <a href="https://ganjoor.net" rel="noreferrer">گنجور</a> می‌آید. این سایت رسمی گنجور نیست؛ طراحی و ساختش با مریم جابری است.</p>`,
  );
  document.querySelector("#home-search").onsubmit = (event) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q") || "";
    location.hash = `#/search?q=${encodeURIComponent(String(q).trim())}`;
  };
  document.querySelector("#random").onclick = async () => {
    document.querySelector("#random").textContent = "می‌آورم…";
    try {
    const response = await fetch(`${API}/poem/random`);
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    location.hash = `#/poem/${data.id}`;
    } catch (error) {
      failed(error);
    }
  };
}

async function poetsPage(query) {
  loading("شاعران");
  const { data: poets } = await api("/poets");
  const century = Number(query.get("c") || 0);
  const centuries = [...new Set(poets.map((poet) => centuryOf(poet.birthYearInLHijri)).filter(Boolean))].sort((a, b) => a - b);
  paint(
    "شاعران",
    `<h1>شاعران</h1>
     <p class="lead">${poets.length} شاعر منتشرشده.</p>
     <div class="cents">${[`<a class="cent ${century ? "" : "on"}" href="#/poets">همه</a>`].concat(centuries.map((item) => `<a class="cent ${century === item ? "on" : ""}" href="#/poets?c=${item}">قرن ${item}</a>`)).join("")}</div>
     <form class="big-search" id="poet-filter"><input id="poet-q" placeholder="نام را بنویس" aria-label="پالایش نام" /></form>
     <div class="faces" id="poet-list"></div>`,
  );
  const box = document.querySelector("#poet-q");
  const list = document.querySelector("#poet-list");
  const draw = () => {
    const q = box.value.trim();
    const shown = poets.filter((poet) => {
      const yearOk = !century || centuryOf(poet.birthYearInLHijri) === century;
      const text = `${poet.name} ${poet.nickname} ${poet.birthPlace || ""}`;
      return yearOk && (!q || text.includes(q));
    });
    list.innerHTML = shown.length ? shown.map(poetFace).join("") : `<p class="muted">کسی با این نام در این قرن نیست.</p>`;
  };
  box.oninput = draw;
  draw();
}

async function poetPage(id) {
  loading("شاعر");
  const { data } = await api(`/poet/${id}`);
  const poet = data.poet;
  const cat = data.cat || {};
  const children = cat.children || [];
  const poems = cat.poems || [];
  const books = children
    .map((book, index) => `<a class="cover c${index % 4}" href="#/cat/${book.id}"><small>بخش</small><strong>${esc(book.title)}</strong></a>`)
    .join("");
  const loose = poems
    .map((poem) => `<a class="hit" href="#/poem/${poem.id}"><strong>${esc(poem.title)}</strong><p>${esc(poem.excerpt || "")}</p></a>`)
    .join("");
  paint(
    poet.nickname || poet.name,
    `<p class="crumb"><a href="#/poets">شاعران</a></p>
     <p class="kicker">${esc(poet.birthPlace || "")} · ${poet.birthYearInLHijri || "؟"} تا ${poet.deathYearInLHijri || "؟"}</p>
     <h1>${esc(poet.name)}</h1>
     <div class="bio" id="bio">${esc(poet.description || "")}</div>
     <button class="btn" id="more" type="button">ادامه شرح</button>
     <p class="chips">
       <a class="chip" href="https://ganjoor.net${esc(poet.fullUrl)}" rel="noreferrer">در گنجور</a>
       ${poet.birthPlaceLatitude ? `<a class="chip" href="#/map?y=${poet.birthYearInLHijri || 700}">روی نقشه</a>` : ""}
     </p>
     ${books ? `<h2 class="section">آثار</h2><div class="covers">${books}</div>` : ""}
     ${loose ? `<h2 class="section">شعرها</h2><div class="grid">${loose}</div>` : ""}`,
  );
  document.querySelector("#more").onclick = () => document.querySelector("#bio").classList.toggle("open");
}

async function catPage(id, query) {
  loading("فهرست");
  const { data } = await api(`/cat/${id}?poems=true&mainSections=false`);
  const cat = data.cat || data;
  const pageNo = Math.max(1, Number(query.get("p") || 1));
  const size = 24;
  const poems = cat.poems || [];
  const slice = poems.slice((pageNo - 1) * size, pageNo * size);
  const pages = Math.ceil(poems.length / size);
  const children = (cat.children || [])
    .map((book, index) => `<a class="cover c${index % 4}" href="#/cat/${book.id}"><strong>${esc(book.title)}</strong></a>`)
    .join("");
  const crumbs = [`<a href="#/poets">شاعران</a>`]
    .concat((cat.ancestors || []).map((item) => `<a href="#/cat/${item.id}">${esc(item.title)}</a>`))
    .join(" / ");
  paint(
    cat.title,
    `<p class="crumb">${crumbs}</p>
     <h1>${esc(cat.title)}</h1>
     <p class="muted">${poems.length ? `${poems.length} شعر` : ""}</p>
     ${children ? `<div class="covers">${children}</div>` : ""}
     <div class="grid">${slice.map((poem) => `<a class="hit" href="#/poem/${poem.id}"><strong>${esc(poem.title)}</strong><p>${esc(poem.excerpt || "")}</p></a>`).join("")}</div>
     ${pages > 1 ? `<p class="chips">${pageNo > 1 ? `<a class="chip" href="#/cat/${id}?p=${pageNo - 1}">قبلی</a>` : ""}<span class="chip">صفحه ${pageNo} از ${pages}</span>${pageNo < pages ? `<a class="chip" href="#/cat/${id}?p=${pageNo + 1}">بعدی</a>` : ""}</p>` : ""}`,
  );
}

function linesOf(poem) {
  const verses = [...(poem.verses || [])].sort((a, b) => a.vOrder - b.vOrder);
  if (verses.length) return verses.map((verse) => ({ order: verse.vOrder, text: verse.text, end: verse.versePosition === 1 || verse.versePosition === 3 }));
  return String(poem.plainText || "")
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ order: index, text, end: index % 2 === 1 }));
}

function words(text) {
  return String(text)
    .split(/(\s+)/)
    .map((part) => (part.trim() ? `<button class="word" type="button">${esc(part)}</button>` : esc(part)))
    .join("");
}

async function poemPage(id, query) {
  loading("شعر");
  const { data: poem } = await api(
    `/poem/${id}?catInfo=true&navigation=true&recitations=true&verseDetails=true&comments=false&images=false&songs=false`,
  );
  store.visit(poem.id);
  const saved = store.get();
  const marked = saved.marks.includes(poem.id);
  const cat = poem.category?.cat || {};
  const poet = poem.category?.poet || {};
  const recitations = poem.recitations || [];
  const lines = linesOf(poem);
  const quiet = query.get("quiet") === "1";
  paint(
    poem.title,
    `<article class="read stage">
       <aside class="rail">
         ${poet.id ? `<a href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>` : ""}
         ${cat.id ? `<a href="#/cat/${cat.id}">فهرست ${esc(cat.title || "")}</a>` : ""}
         <a href="https://ganjoor.net${esc(poem.fullUrl)}" rel="noreferrer">متن در گنجور</a>
         ${poem.previous ? `<a href="#/poem/${poem.previous.id}">قبلی</a>` : ""}
         ${poem.next ? `<a href="#/poem/${poem.next.id}">بعدی</a>` : ""}
       </aside>
       <div class="parchment">
         <p class="crumb">${poet.id ? `<a href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>` : ""} ${cat.id ? `/ <a href="#/cat/${cat.id}">${esc(cat.title)}</a>` : ""}</p>
         <h1>${esc(poem.title)}</h1>
         <div class="ornament" aria-hidden="true"></div>
         <p class="byline">${esc(poet.name || "")}</p>
         <div class="poem" id="verses">${lines.map((line) => `<p class="verse ${line.end ? "end" : ""}" data-order="${line.order}">${words(line.text)}</p>`).join("")}</div>
         <div class="dock">
           <button class="btn" id="mark" type="button">${marked ? "نشان شد" : "نشان"}</button>
           <button class="btn primary" id="quiet" type="button">${quiet ? "بازگشت" : "اتاق خلوت"}</button>
           ${poem.previous ? `<a class="btn" href="#/poem/${poem.previous.id}">قبلی</a>` : ""}
           ${poem.next ? `<a class="btn" href="#/poem/${poem.next.id}">بعدی</a>` : ""}
         </div>
         ${
           recitations.length
             ? `<div class="panel player">
                  <label>خوانش <select id="reciter">${recitations.map((item, index) => `<option value="${index}">${esc(item.audioArtist || "خوانش")}</option>`).join("")}</select></label>
                  <audio id="player" controls preload="none" src="${esc(recitations[0].mp3Url)}"></audio>
                  <p class="muted" id="sync-note"></p>
                </div>`
             : `<p class="muted">برای این شعر در گنجور خوانش ثبت نشده.</p>`
         }
         <label class="panel block">یادداشت من <textarea id="note" rows="4">${esc(saved.notes[poem.id] || "")}</textarea></label>
       </div>
     </article>`,
    quiet,
  );
  document.querySelector("#verses").onclick = (event) => {
    const word = event.target.closest(".word");
    if (!word) return;
    location.hash = `#/search?q=${encodeURIComponent(word.textContent || "")}`;
  };
  document.querySelector("#mark").onclick = (event) => {
    store.toggle(poem.id);
    event.currentTarget.textContent = store.get().marks.includes(poem.id) ? "نشان شد" : "نشان";
  };
  document.querySelector("#quiet").onclick = () => {
    location.hash = quiet ? `#/poem/${poem.id}` : `#/poem/${poem.id}?quiet=1`;
  };
  document.querySelector("#note").onchange = (event) => store.note(poem.id, event.target.value);
  const player = document.querySelector("#player");
  const picker = document.querySelector("#reciter");
  if (player && picker) {
    audioNode = player;
    let times = [];
    async function loadSync(rec) {
      times = [];
      const note = document.querySelector("#sync-note");
      if (!rec.inSyncWithText || !rec.xmlText) {
        if (note) note.textContent = rec.audioArtist ? `خوانش ${rec.audioArtist}` : "";
        return;
      }
      try {
        const xml = await fetch(rec.xmlText.startsWith("http") ? rec.xmlText : `https://api.ganjoor.net${rec.xmlText}`).then((response) => response.text());
        times = [...xml.matchAll(/<VerseOrder>(\d+)<\/VerseOrder>\s*<AudioMiliseconds>(\d+)/g)].map((match) => ({
          order: Number(match[1]),
          at: Number(match[2]),
        }));
        if (note) note.textContent = "بیت با صدای خواننده پیش می‌رود.";
      } catch {
        if (note) note.textContent = "صوت هست؛ هم‌زمانی بیت‌ها نیامد.";
      }
    }
    picker.onchange = () => {
      const rec = recitations[Number(picker.value)];
      player.src = rec.mp3Url;
      loadSync(rec);
    };
    player.ontimeupdate = () => {
      if (!times.length) return;
      const now = player.currentTime * 1000;
      let order = times[0].order;
      for (const mark of times) if (mark.at <= now) order = mark.order;
      document.querySelectorAll(".verse").forEach((node) => node.classList.toggle("on", Number(node.dataset.order) === order));
    };
    loadSync(recitations[0]);
  }
}

async function searchPage(query) {
  const q = (query.get("q") || "").trim();
  const pageNo = Math.max(1, Number(query.get("p") || 1));
  if (!q) {
    paint("جستجو", `<h1>جستجو</h1><p class="lead">یک واژه یا تکه‌ای از بیت را بنویس.</p>`);
    if (input) input.value = "";
    return;
  }
  loading("جستجو");
  const { data, total } = await api(`/poems/search?term=${encodeURIComponent(q)}&pageNumber=${pageNo}&pageSize=8`);
  const rows = (Array.isArray(data) ? data : [])
    .map((poem) => {
      const first = String(poem.plainText || "").split(/\r?\n/).find((line) => line.trim()) || "";
      const poet = poem.category?.poet;
      return `<a class="hit" href="#/poem/${poem.id}"><div class="kicker">${esc(poet?.nickname || poet?.name || "")}</div><strong>${esc(poem.fullTitle || poem.title)}</strong><p>${esc(first)}</p></a>`;
    })
    .join("");
  const pages = total ? Math.ceil(total / 8) : 0;
  paint(
    "جستجو",
    `<h1>جستجو</h1>
     <p class="lead">نتیجه «${esc(q)}»${total ? ` · ${total} شعر` : ""}</p>
     ${rows ? `<div class="grid">${rows}</div>` : `<p>چیزی پیدا نشد.</p>`}
     ${pages > 1 ? `<p class="chips">${pageNo > 1 ? `<a class="chip" href="#/search?q=${encodeURIComponent(q)}&p=${pageNo - 1}">قبلی</a>` : ""}<span class="chip">${pageNo} از ${pages}</span>${pageNo < pages ? `<a class="chip" href="#/search?q=${encodeURIComponent(q)}&p=${pageNo + 1}">بعدی</a>` : ""}</p>` : ""}`,
  );
  if (input) input.value = q;
}

async function mapPage(query) {
  loading("نقشه");
  const { data: poets } = await api("/poets");
  const placed = poets.filter((poet) => poet.birthPlaceLatitude && poet.birthPlaceLongitude && poet.birthYearInLHijri && poet.deathYearInLHijri);
  const min = Math.min(...placed.map((poet) => poet.birthYearInLHijri));
  const max = Math.max(...placed.map((poet) => poet.deathYearInLHijri));
  let year = Number(query.get("y") || 750);
  if (year < min) year = min;
  if (year > max) year = max;
  const alive = placed.filter((poet) => poet.birthYearInLHijri <= year && poet.deathYearInLHijri >= year);
  const minLat = 24;
  const maxLat = 42;
  const minLon = 44;
  const maxLon = 68;
  const dots = alive
    .map((poet) => {
      const x = ((poet.birthPlaceLongitude - minLon) / (maxLon - minLon)) * 100;
      const y = ((maxLat - poet.birthPlaceLatitude) / (maxLat - minLat)) * 100;
      if (x < -5 || x > 105 || y < -5 || y > 105) return "";
      return `<a class="dot" style="left:${x}%;top:${y}%" href="#/poet/${poet.id}" title="${esc(poet.birthPlace || "")}">${esc(poet.nickname || poet.name)}</a>`;
    })
    .join("");
  paint(
    "نقشه",
    `<h1>هم‌عصران</h1>
     <p class="lead">سال را جابه‌جا کن. نقطه، زادگاه شاعر است؛ کسانی که آن سال زنده‌اند.</p>
     <div class="year"><label for="year">سال ${year} هجری</label><input id="year" type="range" min="${min}" max="${max}" value="${year}" /></div>
     <div class="atlas">${dots || `<p class="muted">در این سال کسی با زادگاه ثبت‌شده نیست.</p>`}</div>
     <p class="muted">${alive.length} شاعر در این سال.</p>
     <div class="chips">${alive.slice(0, 18).map((poet) => `<a class="chip" href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>`).join("")}</div>`,
  );
  const slider = document.querySelector("#year");
  slider.oninput = () => {
    slider.previousElementSibling.textContent = `سال ${slider.value} هجری`;
  };
  slider.onchange = () => {
    location.hash = `#/map?y=${slider.value}`;
  };
}

async function libraryPage() {
  const data = store.get();
  const block = async (ids, empty) => {
    if (!ids.length) return `<p class="muted">${empty}</p>`;
    const cards = [];
    for (const id of ids.slice(0, 12)) {
      try {
        const { data: poem } = await api(`/poem/${id}?catInfo=true&verseDetails=false&recitations=false&navigation=false&comments=false&images=false&songs=false`);
        const poet = poem.category?.poet;
        cards.push(`<a class="card" href="#/poem/${id}"><strong>${esc(poem.title)}</strong><div class="muted">${esc(poet?.nickname || "")}</div></a>`);
      } catch {
        cards.push("");
      }
    }
    return `<div class="grid">${cards.join("")}</div>`;
  };
  loading("کتابخانه");
  const notes = Object.entries(data.notes).filter(([, text]) => String(text).trim());
  const marksHtml = await block(data.marks, "هنوز شعری را نشان نکرده‌ای.");
  const historyHtml = await block(data.history, "هنوز شعری نخوانده‌ای.");
  const noteHtml = notes.length
    ? `<div class="grid">${notes
        .slice(0, 12)
        .map(([id, text]) => `<article class="card"><a href="#/poem/${id}">یادداشت شعر</a><p class="muted">${esc(text)}</p></article>`)
        .join("")}</div>`
    : `<p class="muted">یادداشتی نیست.</p>`;
  paint(
    "کتابخانه",
    `<h1>کتابخانه من</h1>
     <p class="lead">نشان و یادداشت فقط روی همین دستگاه می‌ماند.</p>
     <div class="stats"><div class="stat"><b>${data.marks.length}</b>نشان</div><div class="stat"><b>${notes.length}</b>یادداشت</div><div class="stat"><b>${data.history.length}</b>خوانده‌شده</div></div>
     <h2 class="section">نشان‌ها</h2>${marksHtml}
     <h2 class="section">یادداشت‌ها</h2>${noteHtml}
     <h2 class="section">اخیراً</h2>${historyHtml}`,
  );
}

function aboutPage() {
  paint(
    "درباره",
    `<h1>درباره گنجور نو</h1>
     <p class="lead">این یک خوانش‌خانه است: شعر را از رابط گنجور می‌گیرد و با چیدمان خودش نشان می‌دهد.</p>
     <p>متن، فهرست و فایل صوتی مال گنجور است و همان‌جا می‌ماند. نشان، یادداشت و اتاق خلوت روی دستگاه تو ذخیره می‌شود و به جایی فرستاده نمی‌شود.</p>
     <p><a href="https://ganjoor.net">گنجور</a></p>
     <p class="muted">طراحی و ساخت: مریم جابری</p>`,
  );
}

async function render() {
  if (audioNode) {
    audioNode.pause();
    audioNode = null;
  }
  const mine = ++renderToken;
  const hash = location.hash || "#/";
  const [pathPart, queryPart] = hash.split("?");
  const query = new URLSearchParams(queryPart || "");
  const parts = pathPart.replace(/^#\/?/, "").split("/").filter(Boolean);
  const path = `#/${parts.join("/")}`;
  mobile.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".desk a, .mobile a, .footlinks a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const on = href === path || (href !== "#/" && path.startsWith(href));
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  try {
    if (!parts.length) await home();
    else if (parts[0] === "poets") await poetsPage(query);
    else if (parts[0] === "poet" && parts[1]) await poetPage(parts[1]);
    else if (parts[0] === "cat" && parts[1]) await catPage(parts[1], query);
    else if (parts[0] === "poem" && parts[1]) await poemPage(parts[1], query);
    else if (parts[0] === "search") await searchPage(query);
    else if (parts[0] === "map") await mapPage(query);
    else if (parts[0] === "library") await libraryPage();
    else if (parts[0] === "about") aboutPage();
    else paint("نیست", `<h1>این صفحه نیست</h1><p><a href="#/">خانه</a></p>`);
  } catch (error) {
    if (mine === renderToken) failed(error);
  }
}

menuBtn.addEventListener("click", () => {
  const open = mobile.hidden;
  mobile.hidden = !open;
  menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
});
mobile.addEventListener("click", () => {
  mobile.hidden = true;
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  mobile.hidden = true;
  location.hash = `#/search?q=${encodeURIComponent(input.value.trim())}`;
});
window.addEventListener("hashchange", render);
render();

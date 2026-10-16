const API = "https://api.ganjoor.net/api/ganjoor";
const REALM = { minLon: 43, maxLon: 73.5, minLat: 23, maxLat: 47.6 };

function project(lon, lat) {
  return {
    x: ((lon - REALM.minLon) / (REALM.maxLon - REALM.minLon)) * 100,
    y: ((REALM.maxLat - lat) / (REALM.maxLat - REALM.minLat)) * 100,
  };
}

function cityOf(poet) {
  const place = poet.birthPlace || "نامشخص";
  const name = `${poet.name || ""} ${poet.nickname || ""}`;
  if (place === "مشهد" && /توس|طوس|فردوسی/.test(name)) return "توس";
  return place;
}
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

function bare(text) {
  return String(text).replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

const files = new Map();
async function fileJson(name) {
  if (files.has(name)) return files.get(name);
  const response = await fetch(`https://cdn.jsdelivr.net/gh/ganjoor/ganjoor-data@main/${name}`);
  if (!response.ok) throw new Error(name);
  const data = await response.json();
  files.set(name, data);
  return data;
}

async function placesOnVerses(poet) {
  const slug = String(poet.fullUrl || "").replace(/^\//, "");
  if (!slug) return [];
  const [geo, locations] = await Promise.all([fileJson("geotags.json"), fileJson("locations.json")]);
  const dated = geo.filter((item) => item.LunarYear);
  const buckets = [...new Set(dated.map((item) => Math.floor(item.PoemId / 2000)))];
  const index = {};
  for (const bucket of buckets) Object.assign(index, await fileJson(`index/poems-by-id/${bucket}.json`));
  const byId = new Map(locations.map((item) => [item.Id, item]));
  const seen = new Set();
  const stops = [];
  for (const item of dated) {
    const url = index[String(item.PoemId)] || "";
    if (!url.startsWith(`/${slug}/`)) continue;
    const place = byId.get(item.LocationId);
    if (!place) continue;
    const key = `${item.LunarYear}-${place.Name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stops.push({
      year: item.LunarYear,
      place: place.Name,
      poemId: item.PoemId,
      lat: place.Latitude,
      lon: place.Longitude,
      verified: Boolean(item.VerifiedDate),
    });
  }
  return stops.sort((a, b) => a.year - b.year);
}

function lifeBlock(poet) {
  const birth = poet.birthYearInLHijri;
  const death = poet.deathYearInLHijri;
  const img = poet.imageUrl
    ? `<img src="https://api.ganjoor.net${esc(poet.imageUrl)}" alt="">`
    : `<span class="medal t1">${esc((poet.nickname || poet.name || "؟").slice(0, 1))}</span>`;
  if (!birth || !death || death <= birth) {
    return `<figure class="ageshot mid">${img}<figcaption>چهره ثبت‌شده در گنجور</figcaption></figure>`;
  }
  const span = death - birth;
  const start = Math.round(span / 2);
  return `<section class="life">
    <figure class="ageshot mid" id="shot">${img}<figcaption id="stage-name">میانسالی</figcaption></figure>
    <div class="year">
      <div class="year-top"><span>سن حدودی</span><strong id="age-label">حدود ${start} سالگی</strong></div>
      <input id="age" type="range" min="0" max="${span}" value="${start}" />
    </div>
    <p class="muted">چهره همان عکس گنجور است. جوانی و کهنسالی فقط با رنگ تقریبی است، نقاشی تاریخی نیست. گنجور سال سرودن هر شعر را ندارد.</p>
    <p class="muted" id="journey"></p>
    <div class="atlas realm trail" id="trail" hidden></div>
    <div class="chips" id="stops"></div>
  </section>`;
}

function bindLife(poet, age) {
  const birth = poet.birthYearInLHijri;
  const span = poet.deathYearInLHijri - birth;
  const shot = document.querySelector("#shot");
  const stage = document.querySelector("#stage-name");
  const label = document.querySelector("#age-label");
  const names = { young: "جوانی", mid: "میانسالی", old: "کهنسالی" };
  const paintAge = () => {
    const years = Number(age.value);
    const key = years < span / 3 ? "young" : years < (span * 2) / 3 ? "mid" : "old";
    shot.className = `ageshot ${key}`;
    stage.textContent = names[key];
    label.textContent = `حدود ${years} سالگی · سال ${birth + years}`;
    document.querySelectorAll("#stops .stop").forEach((node) => {
      const from = Number(node.dataset.from);
      const to = Number(node.dataset.to);
      node.classList.toggle("on", birth + years >= from && birth + years <= to);
    });
  };
  age.oninput = paintAge;
  paintAge();
  const journey = document.querySelector("#journey");
  const same = poet.birthPlace && poet.birthPlace === poet.deathPlace;
  journey.textContent = same
    ? `زاد و درگذشت هر دو در ${poet.birthPlace} ثبت شده. مسیر سفری در گنجور نیست.`
    : `گنجور زادگاه را ${poet.birthPlace || "نامشخص"} و محل درگذشت را ${poet.deathPlace || "نامشخص"} نوشته. ایستگاه‌های بین راه را ندارد.`;
  placesOnVerses(poet)
    .then((stops) => {
      if (!document.body.contains(age)) return;
      const box = document.querySelector("#stops");
      if (!stops.length || !box) return;
      const inside = stops.filter((stop) => stop.year >= birth && stop.year <= poet.deathYearInLHijri);
      const outside = stops.filter((stop) => stop.year < birth || stop.year > poet.deathYearInLHijri);
      const groups = new Map();
      for (const stop of inside) {
        const group = groups.get(stop.place) || { place: stop.place, years: [], poemId: stop.poemId, lat: stop.lat, lon: stop.lon };
        group.years.push(stop.year);
        groups.set(stop.place, group);
      }
      box.innerHTML =
        [...groups.values()]
          .map((group) => {
            const years = [...new Set(group.years)].sort((a, b) => a - b);
            const span = years.length > 2 ? `${years[0]} تا ${years[years.length - 1]}` : years.join("، ");
            return `<a class="chip stop" data-from="${years[0]}" data-to="${years[years.length - 1]}" href="#/poem/${group.poemId}">${esc(group.place)} · ${span}</a>`;
          })
          .join("") +
        (outside.length ? `<p class="muted">سال‌هایی روی بیت هست که بیرون عمر ثبت‌شده است و اینجا به‌عنوان سفر حساب نشد.</p>` : "");
      journey.textContent = "این سال‌ها و شهرها برچسب گنجور روی بیت است، نه سفرنامه کامل. منبع هر کدام همان شعر است.";
      const trail = document.querySelector("#trail");
      const spots = [...groups.values()].filter((group) => group.lat && group.lon);
      if (trail && spots.length) {
        const minLon = REALM.minLon;
        const maxLon = REALM.maxLon;
        const minLat = REALM.minLat;
        const maxLat = REALM.maxLat;
        trail.hidden = false;
        trail.innerHTML = spots
          .map((group) => {
            const x = ((group.lon - minLon) / (maxLon - minLon)) * 100;
            const y = ((maxLat - group.lat) / (maxLat - minLat)) * 100;
            if (x < 0 || x > 100 || y < 0 || y > 100) return "";
            return `<a class="pin" style="left:${x}%;top:${y}%" href="#/poem/${group.poemId}"><span>${esc(group.place)}</span><i></i></a>`;
          })
          .join("");
      }
      paintAge();
    })
    .catch(() => {});
}

function pickSpread(list, count) {
  if (list.length <= count) return list;
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(list[Math.round((i * (list.length - 1)) / (count - 1))]);
  return out;
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

function opening(poem) {
  if (!poem?.id) return "";
  const lines = String(poem.plainText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (!lines.length) return "";
  const poet = poem.category?.poet;
  return `<h2 class="section">برای شروع</h2><a class="opening" href="#/poem/${poem.id}"><div class="kicker">${esc(poet?.nickname || poet?.name || "")}</div>${lines.map((line) => `<p>${esc(line)}</p>`).join("")}<span class="muted">${esc(poem.title || "")}</span></a>`;
}

function poetFace(poet) {
  const letter = esc((poet.nickname || poet.name || "؟").slice(0, 1));
  const img = poet.imageUrl ? `<img alt="" src="https://api.ganjoor.net${esc(poet.imageUrl)}" onerror="this.remove()" />` : "";
  const years = poet.birthYearInLHijri ? `<bdi dir="ltr">${poet.birthYearInLHijri}–${poet.deathYearInLHijri || "؟"}</bdi>` : "";
  return `<a class="face" href="#/poet/${poet.id}"><span class="medal">${img}<b>${letter}</b></span><strong>${esc(poet.nickname || poet.name)}</strong><small>${esc(poet.birthPlace || "")}${years ? " · " + years : ""}</small></a>`;
}

async function home() {
  loading("خانه");
  const [{ data: poets }, bit] = await Promise.all([
    api("/poets"),
    fetch(`${API}/poem/random?poetId=2`).then((response) => (response.ok ? response.json() : null)).catch(() => null),
  ]);
  const pinned = [...poets].filter((poet) => poet.pinOrder).sort((a, b) => a.pinOrder - b.pinOrder);
  const pinnedIds = new Set(pinned.map((poet) => poet.id));
  const everyone = pinned.concat(
    poets
      .filter((poet) => !pinnedIds.has(poet.id))
      .sort((a, b) => (a.birthYearInLHijri || 9999) - (b.birthYearInLHijri || 9999) || (a.nickname || "").localeCompare(b.nickname || "", "fa")),
  );
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
           <a class="chip" href="#/tree">درخت شاعران</a>
           <a class="chip" href="#/discover">کشف</a>
           <button class="chip" id="random" type="button">یک شعر تصادفی</button>
         </p>
       </div>
       <a class="calligraphy" href="#/poet/2">حافظ</a>
     </section>
     <h2 class="section">همه شاعران · ${everyone.length}</h2>
     <div class="faces">${everyone.map(poetFace).join("")}</div>
     ${opening(bit)}
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
     <p class="kicker">${esc(poet.birthPlace || "")} · <bdi dir="ltr">${poet.birthYearInLHijri || "؟"}–${poet.deathYearInLHijri || "؟"}</bdi></p>
     <h1>${esc(poet.name)}</h1>
     ${lifeBlock(poet)}
     <ol class="ribbon">
       <li class="seg s0"><strong>${poet.birthYearInLHijri || "؟"}</strong><span>زاده ${esc(poet.birthPlace || "جای نامشخص")}</span></li>
       <li class="seg s1"><strong>${poet.deathYearInLHijri && poet.birthYearInLHijri ? poet.deathYearInLHijri - poet.birthYearInLHijri : "؟"} سال</strong><span>فاصله زادروز تا درگذشت</span></li>
       <li class="seg s2"><strong>${poet.deathYearInLHijri || "؟"}</strong><span>درگذشت ${esc(poet.deathPlace || poet.birthPlace || "")}</span></li>
     </ol>
     <div class="bio" id="bio">${esc(poet.description || "")}</div>
     ${(poet.description || "").length > 320 ? `<button class="btn" id="more" type="button">ادامه شرح</button>` : ""}
     <p class="chips">
       ${children[0] ? `<a class="btn primary" href="#/cat/${children[0].id}">شروع از ${esc(children[0].title)}</a>` : ""}
       <a class="chip" href="https://ganjoor.net${esc(poet.fullUrl)}" rel="noreferrer">در گنجور</a>
       ${poet.birthYearInLHijri ? `<a class="chip" href="#/map?y=${Math.round(((poet.birthYearInLHijri || 0) + (poet.deathYearInLHijri || poet.birthYearInLHijri)) / 2)}">هم‌عصران این سال‌ها</a>` : ""}
       <a class="chip" href="#/bridges/${poet.id}">پل‌های ثبت‌شده</a>
     </p>
     ${books ? `<h2 class="section">آثار</h2><div class="covers">${books}</div>` : ""}
     ${loose ? `<h2 class="section">شعرها</h2><div class="grid">${loose}</div>` : ""}`,
  );
  document.querySelector("#more")?.addEventListener("click", () => document.querySelector("#bio").classList.toggle("open"));
  const age = document.querySelector("#age");
  if (age) bindLife(poet, age);
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
  if (verses.length) {
    return verses.map((verse) => ({
      order: verse.vOrder,
      text: verse.text,
      end: verse.versePosition === 1 || verse.versePosition === 3,
      couplet: verse.coupletIndex,
      summary: verse.coupletSummary || "",
    }));
  }
  return String(poem.plainText || "")
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ order: index, text, end: index % 2 === 1, couplet: Math.floor(index / 2), summary: "" }));
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
  const section = (poem.sections || [])[0] || {};
  const metre = section.ganjoorMetre;
  const rhyme = section.rhymeLetters || "";
  const quotes = (poem.top6QuotedPoems || []).filter((item) => item.published !== false && item.relatedPoemId);
  const related = section.top6RelatedSections || [];
  const quiet = query.get("quiet") === "1";
  const count = section.coupletsCount || poem.coupletsCount;
  const brief = String(poem.poemSummary || "");
  paint(
    poem.title,
    `<article class="read stage">
       <div class="parchment">
         <p class="crumb">${poet.id ? `<a href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>` : ""} ${cat.id ? `/ <a href="#/cat/${cat.id}">${esc(cat.title)}</a>` : ""}</p>
         <h1>${esc(poem.title)}</h1>
         <div class="ornament" aria-hidden="true"></div>
         <p class="byline">${esc(poet.name || "")}</p>
         <p class="chips">
           ${count ? `<span class="chip">${count} بیت</span>` : ""}
           ${metre ? `<a class="chip" href="#/vazn?id=${metre.id}">${esc(metre.rhythm)}</a>` : ""}
           ${rhyme ? `<span class="chip">قافیه ${esc(rhyme)}</span>` : ""}
           ${poem.sourceName ? `<span class="chip">منبع: ${esc(poem.sourceName)}</span>` : ""}
         </p>
         ${brief ? `<p class="lead summary">${esc(brief.length > 220 ? `${brief.slice(0, 220)}…` : brief)}</p>` : ""}
         <div class="poem" id="verses">${lines
           .map(
             (line) =>
               `<p class="verse ${line.end ? "end" : ""}" data-order="${line.order}" data-couplet="${line.couplet}">${words(line.text)}</p>`,
           )
           .join("")}</div>
         <p class="muted">روی بیت بزن تا شرح همان بیت بیاید. روی واژه بزن تا در شعرهای دیگر پیدا شود.</p>
         <div class="dock">
           <button class="btn" id="mark" type="button">${marked ? "نشان شد" : "نشان"}</button>
           <button class="btn primary" id="quiet" type="button">${quiet ? "بازگشت" : "اتاق خلوت"}</button>
           ${poem.previous ? `<a class="btn" href="#/poem/${poem.previous.id}">قبلی</a>` : ""}
           ${poem.next ? `<a class="btn" href="#/poem/${poem.next.id}">بعدی</a>` : ""}
         </div>
       </div>
       <aside class="tools">
         <nav class="rail">
           ${poet.id ? `<a href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>` : ""}
           ${cat.id ? `<a href="#/cat/${cat.id}">فهرست ${esc(cat.title || "")}</a>` : ""}
           <a href="https://ganjoor.net${esc(poem.fullUrl)}" rel="noreferrer">متن در گنجور</a>
           ${poem.previous ? `<a href="#/poem/${poem.previous.id}">قبلی</a>` : ""}
           ${poem.next ? `<a href="#/poem/${poem.next.id}">بعدی</a>` : ""}
         </nav>
         <div class="panel" id="side">
           <div class="tabs" id="tabs">
             <button class="chip on" type="button" data-tab="mean">معنی</button>
             <button class="chip" type="button" data-tab="quote">تضمین${quotes.length + related.length ? ` ${quotes.length + related.length}` : ""}</button>
             <button class="chip" type="button" data-tab="music">موسیقی</button>
             <button class="chip" type="button" data-tab="margin">حاشیه</button>
             <button class="chip" type="button" data-tab="mirror">آینه</button>
           </div>
           <div id="pane"></div>
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
       </aside>
     </article>`,
    quiet,
  );
  let tab = "mean";
  let activeCouplet = lines[0]?.couplet ?? 0;
  const pane = document.querySelector("#pane");
  function markCouplet() {
    document.querySelectorAll(".verse").forEach((node) => node.classList.toggle("pick", Number(node.dataset.couplet) === activeCouplet));
  }
  function summaryOf(index) {
    return lines.find((line) => line.couplet === index && line.summary)?.summary || "";
  }
  async function renderPane() {
    document.querySelectorAll("#tabs .chip").forEach((node) => node.classList.toggle("on", node.dataset.tab === tab));
    if (tab === "mean") {
      pane.innerHTML = `<p>${esc(summaryOf(activeCouplet) || poem.poemSummary || "شرح این بیت در گنجور ثبت نشده.")}</p>`;
      return;
    }
    if (tab === "quote") {
      const blocks = quotes
        .map(
          (item) =>
            `<a class="hit" href="#/poem/${item.relatedPoemId}"><div class="kicker">${esc(item.cachedRelatedPoemPoetName || "")}</div><strong>${esc(item.relatedCoupletVerse2 || item.cachedRelatedPoemFullTitle || "")}</strong><p>${esc(item.coupletVerse1 || "")}</p></a>`,
        )
        .concat(
          related.map(
            (item) =>
              `<a class="hit" href="#/poem/${item.targetPoemId}"><div class="kicker">استقبال · ${esc(item.poetName || "")}</div><strong>${esc(item.fullTitle || "")}</strong></a>`,
          ),
        );
      pane.innerHTML = blocks.length ? blocks.join("") : `<p class="muted">تضمین یا استقبالی برای این شعر ثبت نشده.</p>`;
      return;
    }
    if (tab === "mirror") {
      pane.innerHTML = `<p class="muted">یک واژه از شعر را بزن.</p>`;
      return;
    }
    pane.innerHTML = `<p class="muted">می‌آورم…</p>`;
    try {
      if (tab === "music") {
        const { data } = await api(`/poem/${poem.id}?songs=true&verseDetails=false&recitations=false&comments=false&images=false&navigation=false&catInfo=false`);
        const songs = data.songs || [];
        pane.innerHTML = songs.length
          ? songs
              .slice(0, 8)
              .map(
                (song) =>
                  `<p><a href="${esc(song.trackUrl)}" rel="noreferrer">${esc(song.artistName || "قطعه")} — ${esc(song.trackName || song.albumName || "")}</a></p>`,
              )
              .join("")
          : `<p class="muted">قطعه موسیقی ثبت نشده.</p>`;
      }
      if (tab === "margin") {
        const { data } = await api(`/poem/${poem.id}?comments=true&verseDetails=false&recitations=false&songs=false&images=false&navigation=false&catInfo=false`);
        const comments = (data.comments || [])
          .filter((item) => item.coupletIndex === -1 || item.coupletIndex === activeCouplet)
          .slice(0, 6);
        const rows = comments
          .map((item) => {
            const box = document.createElement("div");
            box.innerHTML = item.htmlComment || "";
            return `<article class="card"><div class="kicker">${esc(item.authorName || "خواننده")}</div><p>${esc(box.textContent || "")}</p></article>`;
          })
          .join("");
        pane.innerHTML =
          (rows || `<p class="muted">حاشیه‌ای برای این بیت نیست.</p>`) +
          `<p><a href="https://ganjoor.net${esc(poem.fullUrl)}" rel="noreferrer">نوشتن حاشیه در گنجور</a></p>`;
      }
    } catch (error) {
      pane.innerHTML = `<p class="muted">این بخش نیامد. ${esc(error.message)}</p>`;
    }
  }
  document.querySelector("#tabs").onclick = (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    tab = button.dataset.tab;
    renderPane();
  };
  document.querySelector("#verses").onclick = async (event) => {
    const word = event.target.closest(".word");
    const verse = event.target.closest(".verse");
    if (!verse) return;
    activeCouplet = Number(verse.dataset.couplet);
    markCouplet();
    if (word) {
      tab = "mirror";
      const term = bare(word.textContent || "");
      pane.innerHTML = `<p class="muted">می‌گردم…</p>`;
      document.querySelectorAll("#tabs .chip").forEach((node) => node.classList.toggle("on", node.dataset.tab === "mirror"));
      try {
        const poetFilter = poet.id ? `&poetId=${poet.id}` : "";
        const { data, total } = await api(`/poems/search?term=${encodeURIComponent(term)}&pageNumber=1&pageSize=5${poetFilter}`);
        const hits = (Array.isArray(data) ? data : [])
          .map((item) => {
            const first = String(item.plainText || "").split(/\r?\n/).find((line) => line.trim()) || "";
            return `<a class="hit" href="#/poem/${item.id}"><strong>${esc(item.title)}</strong><p>${esc(first)}</p></a>`;
          })
          .join("");
        pane.innerHTML = `<p>واژه «${esc(term)}» در آثار ${esc(poet.nickname || poet.name || "این شاعر")}${total ? `، ${total} شعر` : ""}</p>${hits || `<p class="muted">در آثار همین شاعر نیامد.</p>`}<p><a href="#/search?q=${encodeURIComponent(term)}">در همه گنجور</a></p>`;
      } catch (error) {
        pane.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
      }
      return;
    }
    tab = "mean";
    renderPane();
  };
  markCouplet();
  renderPane();
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
      document.querySelectorAll(".verse").forEach((node) => {
        const on = Number(node.dataset.order) === order;
        if (on && !node.classList.contains("on")) node.scrollIntoView({ block: "nearest" });
        node.classList.toggle("on", on);
      });
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
      const first = String(poem.plainText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ");
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
  const groups = new Map();
  const far = [];
  for (const poet of alive) {
    const point = project(poet.birthPlaceLongitude, poet.birthPlaceLatitude);
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
      far.push(poet);
      continue;
    }
    const city = cityOf(poet);
    const group = groups.get(city) || { city, x: point.x, y: point.y, poets: [], noted: city === "توس" };
    group.poets.push(poet);
    groups.set(city, group);
  }
  const showName = groups.size <= 18;
  const dots = [...groups.values()]
    .map((group, index) => {
      const people = group.poets.map((poet) => poet.nickname || poet.name).join("، ");
      const note = group.noted ? " — گنجور مشهد نوشته" : "";
      return `<a class="pin" data-city="${index}" style="left:${group.x}%;top:${group.y}%" href="#/map?y=${year}" title="${esc(group.city)}: ${esc(people)}${esc(note)}">${showName ? `<span>${esc(group.city)}</span>` : ""}<i></i></a>`;
    })
    .join("");
  const cityList = [...groups.values()]
    .map(
      (group, index) =>
        `<article class="card" id="city-${index}"><strong>${esc(group.city)}</strong>${group.noted ? `<p class="muted">گنجور این زادگاه را مشهد نوشته. در روزگار این شاعران شهر توس بوده، کنار همان نقطه.</p>` : ""}<p class="chips">${group.poets
          .map((poet) => `<a class="chip" href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a>`)
          .join("")}</p></article>`,
    )
    .join("");
  const ticks = [];
  for (let mark = Math.ceil(min / 100) * 100; mark < max; mark += 100) ticks.push(mark);
  paint(
    "نقشه",
    `<h1>هم‌عصران</h1>
     <p class="lead">مرز امروز ایران اینجا نیست. سبز خشکی است و لکه روشن دریای خزر. نام شهر، زادگاه ثبت‌شده در گنجور است: از گنجه و تبریز تا هرات، بلخ، بخارا و غزنه.</p>
     <div class="year">
       <div class="year-top"><span>سفر در زمان</span><strong id="year-label">سال ${year} هجری</strong></div>
     <div class="scale">
       <input id="year" type="range" min="${min}" max="${max}" value="${year}" />
       <div class="ticks">${ticks.map((mark) => `<span style="left:${((mark - min) / (max - min)) * 100}%">${mark}</span>`).join("")}</div>
     </div>
     </div>
     <div class="atlas realm" aria-label="گستره شهرهای شعر فارسی">${dots || `<p class="muted empty-map">در این سال کسی در این گستره نیست.</p>`}</div>
     <p class="muted">${alive.length} شاعر در این سال، در ${groups.size} شهر این گستره.</p>
     <div class="grid">${cityList}</div>
     ${far.length ? `<p class="muted">زادگاه این‌ها دورتر است، در هند یا آناتولی یا شام، و روی این صفحه جا نشده:</p><div class="chips">${far.map((poet) => `<a class="chip" href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)} · ${esc(poet.birthPlace || "")}</a>`).join("")}</div>` : ""}`,
  );
  const slider = document.querySelector("#year");
  const label = document.querySelector("#year-label");
  slider.oninput = () => {
    label.textContent = `سال ${slider.value} هجری`;
  };
  slider.onchange = () => {
    location.hash = `#/map?y=${slider.value}`;
  };
  document.querySelectorAll(".pin[data-city]").forEach((pin) => {
    pin.onclick = (event) => {
      event.preventDefault();
      document.getElementById(`city-${pin.dataset.city}`)?.scrollIntoView({ block: "nearest" });
    };
  });
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
     <h2 class="section">خاطره‌نگار</h2>${historyHtml}`,
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

async function bridgesPage(id) {
  loading("پل‌ها");
  const { data } = await api(`/poet/${id}`);
  const poet = data.poet;
  const cat = data.cat || {};
  let poems = cat.poems || [];
  if (!poems.length && (cat.children || []).length) {
    const { data: child } = await api(`/cat/${cat.children[0].id}?poems=true&mainSections=false`);
    poems = (child.cat || child).poems || [];
  }
  const sample = pickSpread(poems, 12);
  const links = new Map();
  await Promise.all(
    sample.map(async (poem) => {
      const { data: full } = await api(
        `/poem/${poem.id}?verseDetails=false&recitations=false&comments=false&songs=false&images=false&navigation=false&catInfo=false`,
      );
      for (const item of full.top6QuotedPoems || []) {
        if (!item.relatedPoetId || item.relatedPoetId === poet.id || item.published === false) continue;
        const row = links.get(item.relatedPoetId) || {
          id: item.relatedPoetId,
          name: item.cachedRelatedPoemPoetName || "شاعر",
          n: 0,
          kind: "تضمین",
          poemId: item.relatedPoemId,
          line: item.relatedCoupletVerse2 || item.coupletVerse1 || "",
        };
        row.n += 1;
        links.set(item.relatedPoetId, row);
      }
      for (const item of ((full.sections || [])[0] || {}).top6RelatedSections || []) {
        if (!item.poetId || item.poetId === poet.id) continue;
        const row = links.get(item.poetId) || {
          id: item.poetId,
          name: item.poetName || "شاعر",
          n: 0,
          kind: "استقبال",
          poemId: item.targetPoemId,
          line: item.fullTitle || "",
        };
        row.n += 1;
        links.set(item.poetId, row);
      }
    }),
  );
  const rows = [...links.values()].sort((a, b) => b.n - a.n);
  const ring = rows.slice(0, 6).map((row, index, list) => {
    const angle = (Math.PI * 2 * index) / list.length - Math.PI / 2;
    return { ...row, x: 50 + Math.cos(angle) * 34, y: 48 + Math.sin(angle) * 32 };
  });
  const graph = ring.length
    ? `<div class="graph" aria-hidden="false"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${ring
        .map((row) => `<line x1="50" y1="48" x2="${row.x}" y2="${row.y}" />`)
        .join("")}</svg><a class="node" style="left:50%;top:48%" href="#/poet/${poet.id}"><i></i>${esc(poet.nickname || poet.name)}</a>${ring
        .map((row) => `<a class="node" style="left:${row.x}%;top:${row.y}%" href="#/poem/${row.poemId}"><i></i>${esc(row.name)}</a>`)
        .join("")}</div>`
    : "";
  paint(
    "پل‌ها",
    `<p class="crumb"><a href="#/poet/${poet.id}">${esc(poet.nickname || poet.name)}</a></p>
     <h1>پل‌های ثبت‌شده</h1>
     <p class="lead">خط‌ها تضمین یا استقبال ثبت‌شده در گنجور است، از نمونه‌ای از شعرها. ضخامت یکسان است چون شدت تأثیر در داده نیست. کلیک، شعر منبع را باز می‌کند.</p>
     ${graph}
     ${
       rows.length
         ? `<div class="grid">${rows
             .map(
               (row) =>
                 `<a class="card" href="#/poem/${row.poemId}"><div class="kicker">${esc(row.kind)} · ${row.n} بار در این نمونه</div><strong>${esc(row.name)}</strong><p class="muted">${esc(row.line)}</p></a>`,
             )
             .join("")}</div>`
         : `<p>در این نمونه، تضمین یا استقبالی ثبت نشده.</p>`
     }
     <p><a class="chip" href="#/poet/${poet.id}">بازگشت به شاعر</a></p>`,
  );
}

async function treePage() {
  loading("درخت");
  const { data: poets } = await api("/poets");
  const pick = (name) => poets.find((poet) => `${poet.nickname || ""} ${poet.name || ""}`.includes(name));
  const spots = [
    ["فردوسی", "حماسه", 50, 12, ""],
    ["سعدی", "غزل", 84, 32, "lapis"],
    ["حافظ", "غزل", 84, 56, ""],
    ["عطار", "عرفان", 68, 76, "lapis"],
    ["خیام", "رباعی", 16, 32, ""],
    ["مولانا", "مثنوی", 16, 56, "lapis"],
    ["نظامی", "مثنوی", 32, 76, ""],
    ["رودکی", "ریشه", 50, 92, "lapis"],
  ];
  const leaves = spots
    .map(([name, kind, x, y, tone]) => {
      const poet = pick(name);
      if (!poet) return "";
      return `<a class="leaf ${tone}" style="left:${x}%;top:${y}%" href="#/poet/${poet.id}"><i></i><b>${esc(poet.nickname || poet.name)}</b><small>${kind}</small></a>`;
    })
    .join("");
  const centuries = [...new Set(poets.map((poet) => centuryOf(poet.birthYearInLHijri)).filter(Boolean))].sort((a, b) => a - b);
  const byCentury = (century) =>
    poets
      .filter((poet) => centuryOf(poet.birthYearInLHijri) === century)
      .sort((a, b) => a.birthYearInLHijri - b.birthYearInLHijri);
  const roster = centuries
    .map(
      (century) =>
        `<section class="bough"><h2>قرن ${century}</h2><div class="faces">${byCentury(century).map(poetFace).join("")}</div></section>`,
    )
    .join("");
  const undated = poets.filter((poet) => !centuryOf(poet.birthYearInLHijri));
  paint(
    "درخت",
    `<h1>درخت شاعران</h1>
     <p class="lead">بالا، نقشه خواندن هشت نام آشناست. پایین، همه شاعران منتشرشده گنجور، شاخه به شاخه بر اساس قرن. این خویشاوندی تاریخی نیست.</p>
     <div class="tree">
       <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
         <path class="trunk" d="M50 88 V18"/>
         <path d="M50 34 C40 32, 28 30, 18 32"/>
         <path d="M50 34 C60 32, 72 30, 82 32"/>
         <path d="M50 50 C38 48, 26 50, 16 56"/>
         <path d="M50 50 C62 48, 74 50, 84 56"/>
         <path d="M50 66 C44 68, 38 72, 32 76"/>
         <path d="M50 66 C56 68, 62 72, 68 76"/>
       </svg>
       ${leaves}
     </div>
     <h2 class="section">همه شاعران · ${poets.length}</h2>
     ${roster}
     ${undated.length ? `<section class="bough"><h2>بی‌سال</h2><div class="faces">${undated.map(poetFace).join("")}</div></section>` : ""}`,
  );
}

async function vaznPage(query) {
  loading("وزن");
  const { data } = await api("/rhythms");
  const selected = Number(query.get("id") || 0);
  const rhythms = [...data].sort((a, b) => b.verseCount - a.verseCount);
  const current = rhythms.find((item) => item.id === selected);
  paint(
    "وزن",
    `<h1>وزن‌ها</h1>
     <p class="lead">نام وزن از گنجور است. عدد، شمار مصراع‌های ثبت‌شده در آن وزن است.</p>
     ${current ? `<p class="panel"><strong>${esc(current.rhythm)}</strong><br><span class="muted">${current.verseCount} مصراع</span></p>` : ""}
     <div class="grid">${rhythms
       .slice(0, 24)
       .map(
         (item) =>
           `<a class="card ${item.id === selected ? "soft" : ""}" href="#/vazn?id=${item.id}"><strong>${esc(item.rhythm)}</strong><div class="muted">${item.verseCount} مصراع</div></a>`,
       )
       .join("")}</div>`,
  );
}

function discoverPage() {
  const tools = [
    ["#/map", "نقشه هم‌عصران", "سال را جابه‌جا کن و زادگاه شاعران زنده را ببین."],
    ["#/tree", "درخت شاعران", "شاخه‌های غزل، مثنوی، رباعی، عرفان و حماسه."],
    ["#/vazn", "وزن‌ها", "بحر و شمار مصراع، از خود گنجور."],
    ["#/library", "خاطره‌نگار", "شعرهایی که خوانده‌ای یا نشان کرده‌ای، روی همین دستگاه."],
    ["#/search", "جستجو", "واژه یا تکه‌ای از بیت در همه شعرها."],
    ["#/poets", "شاعران", "فهرست کامل شاعران منتشرشده."],
  ];
  paint(
    "کشف",
    `<h1>کشف</h1>
     <p class="lead">راه‌های دیدن گنجینه، غیر از خواندن خطی.</p>
     <div class="grid cards">${tools.map(([href, title, text]) => `<a class="card" href="${href}"><strong>${title}</strong><div class="muted">${text}</div></a>`).join("")}</div>
     <p class="note">تضمین، استقبال، شرح بیت، حاشیه و موسیقی داخل صفحه هر شعر است. روی بیت یا واژه بزن.</p>`,
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
    else if (parts[0] === "bridges" && parts[1]) await bridgesPage(parts[1]);
    else if (parts[0] === "cat" && parts[1]) await catPage(parts[1], query);
    else if (parts[0] === "poem" && parts[1]) await poemPage(parts[1], query);
    else if (parts[0] === "search") await searchPage(query);
    else if (parts[0] === "map") await mapPage(query);
    else if (parts[0] === "tree" || parts[0] === "sky") await treePage();
    else if (parts[0] === "vazn") await vaznPage(query);
    else if (parts[0] === "discover") discoverPage();
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

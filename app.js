const STORAGE_KEY = "concert-journal-shows";
const SHOWS_TABLE = "concert_shows";

const config = window.CONCERT_JOURNAL_CONFIG || {};
const supabaseReady = Boolean(
  config.supabaseUrl &&
    config.supabaseAnonKey &&
    window.supabase?.createClient,
);
const cloud = supabaseReady
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

const form = document.querySelector("#showForm");
const authForm = document.querySelector("#authForm");
const authPanel = document.querySelector(".auth-panel");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authStatus = document.querySelector("#authStatus");
const accountMenuText = document.querySelector("#accountMenuText");
const loginBtn = document.querySelector("#loginBtn");
const signupBtn = document.querySelector("#signupBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const fields = {
  editingId: document.querySelector("#editingId"),
  title: document.querySelector("#title"),
  artist: document.querySelector("#artist"),
  date: document.querySelector("#date"),
  city: document.querySelector("#city"),
  venue: document.querySelector("#venue"),
  status: document.querySelector("#status"),
  price: document.querySelector("#price"),
  rating: document.querySelector("#rating"),
  companions: document.querySelector("#companions"),
  tags: document.querySelector("#tags"),
  notes: document.querySelector("#notes"),
  setlist: document.querySelector("#setlist"),
};

const showsList = document.querySelector("#showsList");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const exportBtn = document.querySelector("#exportBtn");
const importInput = document.querySelector("#importInput");
const memoDialog = document.querySelector("#memoDialog");
const memoText = document.querySelector("#memoText");
const memoPreview = document.querySelector("#memoPreview");
const importMemoBtn = document.querySelector("#importMemoBtn");
const openMemoImportBtn = document.querySelector("#openMemoImportBtn");
const closeMemoImportBtn = document.querySelector("#closeMemoImportBtn");
const summaryPanel = document.querySelector("#summaryPanel");
const summaryTitle = document.querySelector("#summaryTitle");
const summarySubtitle = document.querySelector("#summarySubtitle");
const summaryBubbles = document.querySelector("#summaryBubbles");
const toggleMoneyBtn = document.querySelector("#toggleMoneyBtn");
const formBody = document.querySelector("#formBody");
const toggleFormBtn = document.querySelector("#toggleFormBtn");
const formTitle = document.querySelector("#formTitle");
const editNotice = document.querySelector("#editNotice");
const ticketViewBtn = document.querySelector("#ticketViewBtn");
const bubbleViewBtn = document.querySelector("#bubbleViewBtn");
const stackViewBtn = document.querySelector("#stackViewBtn");
const mapViewBtn = document.querySelector("#mapViewBtn");
const toolMenus = document.querySelectorAll(".tool-menu");

let shows = loadLocalShows();
let currentUser = null;
let activeSummary = "";
let moneyHidden = localStorage.getItem("concert-journal-hide-money") !== "false";
let ticketView = localStorage.getItem("concert-journal-ticket-view") || "ticket";
let stackSpread = false;

toolMenus.forEach((menu) => {
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    toolMenus.forEach((otherMenu) => {
      if (otherMenu !== menu) otherMenu.open = false;
    });
  });
});

function loadLocalShows() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalShows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
}

async function loadCloudShows() {
  if (!cloud || !currentUser) return;
  const { data, error } = await cloud
    .from(SHOWS_TABLE)
    .select("payload")
    .order("updated_at", { ascending: false });
  if (error) {
    setStatus(`读取云端数据失败：${error.message}`);
    return;
  }
  shows = (data || []).map((row) => row.payload).filter(Boolean);
  saveLocalShows();
  render();
}

async function saveShowToCloud(show) {
  if (!cloud || !currentUser) return;
  const { error } = await cloud.from(SHOWS_TABLE).upsert({
    id: show.id,
    user_id: currentUser.id,
    payload: show,
    updated_at: new Date().toISOString(),
  });
  if (error) setStatus(`保存到云端失败：${error.message}`);
}

async function saveManyToCloud(items) {
  if (!cloud || !currentUser || !items.length) return;
  const rows = items.map((show) => ({
    id: show.id,
    user_id: currentUser.id,
    payload: show,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await cloud.from(SHOWS_TABLE).upsert(rows);
  if (error) setStatus(`批量保存到云端失败：${error.message}`);
}

async function deleteShowFromCloud(id) {
  if (!cloud || !currentUser) return;
  const { error } = await cloud.from(SHOWS_TABLE).delete().eq("id", id);
  if (error) setStatus(`云端删除失败：${error.message}`);
}

function setStatus(message) {
  authStatus.textContent = message;
}

function renderAuth() {
  if (!cloud) {
    authForm.classList.remove("signed-in");
    authPanel.classList.remove("signed-in-panel");
    document.body.classList.remove("signed-in");
    accountMenuText.textContent = "账户";
    setStatus("当前是本地单人模式。配置 Supabase 后可登录并跨设备同步。");
    return;
  }

  if (currentUser) {
    setStatus(`已登录：${currentUser.email}`);
    accountMenuText.textContent = "已登录";
    authForm.classList.add("signed-in");
    authPanel.classList.add("signed-in-panel");
    document.body.classList.add("signed-in");
    authEmail.hidden = true;
    authPassword.hidden = true;
    loginBtn.hidden = true;
    signupBtn.hidden = true;
    logoutBtn.hidden = false;
    return;
  }

  setStatus("请登录或注册。登录后，每个用户只能看到自己的演出记录。");
  accountMenuText.textContent = "账户";
  authForm.classList.remove("signed-in");
  authPanel.classList.remove("signed-in-panel");
  document.body.classList.remove("signed-in");
  authEmail.hidden = false;
  authPassword.hidden = false;
  loginBtn.hidden = false;
  signupBtn.hidden = false;
  logoutBtn.hidden = true;
}

function splitList(value = "") {
  return value
    .split(/[,，、/|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items) {
  return Array.isArray(items) ? items.join(", ") : "";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeDate(value) {
  const match = value.match(/(20\d{2})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeCity(value = "") {
  const city = String(value).trim();
  const cityRoots = [
    "首尔", "釜山", "香港", "澳门", "光州", "北京", "上海", "广州", "深圳",
    "成都", "重庆", "杭州", "南京", "武汉", "西安", "长沙", "苏州", "天津",
    "青岛", "厦门", "郑州", "宁波", "合肥", "佛山", "台北", "新加坡", "东京", "首尔",
  ];
  return cityRoots.find((root) => city.includes(root)) || city;
}

const cityPoints = {
  首尔: { x: 69, y: 34 },
  光州: { x: 66, y: 43 },
  釜山: { x: 70, y: 45 },
  香港: { x: 54, y: 68 },
  澳门: { x: 52, y: 70 },
  北京: { x: 52, y: 36 },
  上海: { x: 58, y: 52 },
  广州: { x: 52, y: 66 },
  深圳: { x: 54, y: 67 },
  成都: { x: 40, y: 54 },
  台北: { x: 63, y: 64 },
  东京: { x: 82, y: 46 },
  大阪: { x: 78, y: 52 },
  曼谷: { x: 44, y: 82 },
  新加坡: { x: 45, y: 95 },
  吉隆坡: { x: 43, y: 91 },
};

function getCityPoint(city = "") {
  const normalized = normalizeCity(city);
  if (cityPoints[normalized]) return cityPoints[normalized];
  const seed = Array.from(normalized).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    x: 38 + (seed % 38),
    y: 34 + (seed % 48),
  };
}

function normalizeArtist(value = "") {
  const artist = String(value).trim();
  const key = artist.toLowerCase().replace(/\s+/g, "");
  const aliases = {
    day6: "DAY6",
    svt: "SEVENTEEN",
    seventeen: "SEVENTEEN",
    세븐틴: "SEVENTEEN",
    kisslife: "Kiss of Life",
    kissoflife: "Kiss of Life",
    kiof: "Kiss of Life",
    hw: "HW",
    ds: "DS",
    idle: "i-dle",
    gidle: "i-dle",
    "g-idle": "i-dle",
    여자아이들: "i-dle",
  };
  return aliases[key] || artist;
}

function getFormShow() {
  return {
    id: fields.editingId.value || crypto.randomUUID(),
    title: fields.title.value.trim(),
    artist: fields.artist.value.trim(),
    date: fields.date.value,
    city: normalizeCity(fields.city.value),
    venue: fields.venue.value.trim(),
    status: fields.status.value.trim(),
    price: fields.price.value.trim(),
    rating: fields.rating.value ? Number(fields.rating.value) : null,
    companions: splitList(fields.companions.value),
    tags: splitList(fields.tags.value),
    notes: fields.notes.value.trim(),
    setlist: fields.setlist.value
      .split("\n")
      .map((song) => song.trim())
      .filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}

function resetForm() {
  form.reset();
  fields.editingId.value = "";
  cancelEditBtn.hidden = true;
  formTitle.textContent = "新增记录";
  editNotice.hidden = true;
  form.classList.add("collapsed");
  document.body.classList.remove("form-expanded");
  document.body.classList.remove("editing-record");
  toggleFormBtn.textContent = "新增";
}

function setFormExpanded(expanded) {
  formBody.hidden = !expanded;
  form.classList.toggle("collapsed", !expanded);
  document.body.classList.toggle("form-expanded", expanded);
  toggleFormBtn.textContent = expanded ? "收起" : "新增";
}

function enterEditMode() {
  setFormExpanded(true);
  formTitle.textContent = "编辑记录";
  editNotice.hidden = false;
  cancelEditBtn.hidden = false;
  document.body.classList.add("editing-record");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode() {
  resetForm();
  setFormExpanded(false);
}

function renderStats() {
  const artists = new Set(shows.map((show) => normalizeArtist(show.artist)).filter(Boolean));
  const cities = new Set(shows.map((show) => normalizeCity(show.city)).filter(Boolean));
  const spend = summarizeSpend(shows);

  document.querySelector("#totalCount").textContent = shows.length;
  document.querySelector("#artistCount").textContent = artists.size;
  document.querySelector("#cityCount").textContent = cities.size;
  document.querySelector("#totalSpend").textContent = formatSpendSummary(spend);
}

function summarizeSpend(items) {
  return items.reduce((totals, show) => {
    const price = parsePriceAmount(show.price);
    if (!price) return totals;
    totals[price.currency] = (totals[price.currency] || 0) + price.amount;
    return totals;
  }, {});
}

function formatSpendSummary(spend) {
  const entries = Object.entries(spend);
  if (!entries.length) return "-";
  if (moneyHidden) return "🤫 ••••";
  return entries.map(([currency, amount]) => `${currency}${formatAmount(amount)}`).join(" / ");
}

function formatAmount(amount) {
  return Math.round(amount).toLocaleString("zh-CN");
}

function getVisibleShows() {
  const keyword = searchInput.value.trim().toLowerCase();
  const visible = shows.filter((show) => {
    const haystack = [
      show.title,
      show.artist,
      normalizeArtist(show.artist),
      show.city,
      show.venue,
      show.status,
      show.price,
      show.notes,
      ...(show.companions || []),
      ...(show.tags || []),
      ...(show.setlist || []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });

  return visible.sort((a, b) => {
    if (sortSelect.value === "dateAsc") return (a.date || "").localeCompare(b.date || "");
    if (sortSelect.value === "ratingDesc") return (b.rating || 0) - (a.rating || 0);
    return (b.date || "").localeCompare(a.date || "");
  });
}

function renderShows() {
  const visibleShows = getVisibleShows();
  showsList.innerHTML = "";
  showsList.classList.toggle("bubble-view", ticketView === "bubble");
  showsList.classList.toggle("stack-view", ticketView === "stack");
  showsList.classList.toggle("spread", ticketView === "stack" && stackSpread);
  showsList.classList.toggle("map-view", ticketView === "map");
  ticketViewBtn.classList.toggle("active", ticketView === "ticket");
  bubbleViewBtn.classList.toggle("active", ticketView === "bubble");
  stackViewBtn.classList.toggle("active", ticketView === "stack");
  mapViewBtn.classList.toggle("active", ticketView === "map");

  if (!visibleShows.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有匹配的演出记录";
    showsList.append(empty);
    return;
  }

  if (ticketView === "map") {
    renderMapCalendar(visibleShows);
    return;
  }

  visibleShows.forEach((show, index) => {
    const item = document.createElement("article");
    item.className = "show-item";
    item.style.setProperty("--i", index);
    item.style.setProperty("--stack-x", `${(index % 5) * 7}px`);
    item.style.setProperty("--stack-y", `${(index % 5) * 5}px`);
    item.style.setProperty("--stack-rot", `${-4 + (index % 7) * 1.4}deg`);
    item.style.setProperty("--spread-rot", `${-1.2 + (index % 5) * 0.6}deg`);
    item.style.setProperty("--ticket-delay", `${Math.min(index, 10) * 32}ms`);
    item.style.setProperty("--drop-delay", `${Math.min(index, 10) * 42}ms`);

    const rating = show.rating ? ` · ${show.rating}/5` : "";
    const place = [show.city, show.venue].filter(Boolean).join(" · ");
    const title = show.title || show.artist || "未命名演出";
    const secondary = show.title && show.artist ? show.title : "";
    const statusPrice = [show.status, show.price].filter(Boolean).join(" · ");
    const companions = show.companions?.length
      ? ` · 同行：${joinList(show.companions)}`
      : "";
    const setlist = show.setlist?.length
      ? `<p class="show-setlist">歌单：${show.setlist.map(escapeHtml).join(" / ")}</p>`
      : "";
    const notes = show.notes
      ? `<p class="show-notes">${escapeHtml(show.notes)}</p>`
      : "";
    const tags = show.tags?.length
      ? `<div class="show-tags">${show.tags
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join("")}</div>`
      : "";

    item.innerHTML = `
      <div class="show-head">
        <div>
          <h2 class="show-title">${escapeHtml(show.artist || title)}</h2>
          <p class="show-meta">${escapeHtml([secondary, formatDate(show.date), statusPrice].filter(Boolean).join(" · "))}${rating}</p>
          <p class="show-meta">${escapeHtml(place || "未填写地点")}${escapeHtml(companions)}</p>
        </div>
      </div>
      ${notes}
      ${setlist}
      ${tags}
      <div class="show-actions">
        <button class="ghost" type="button" data-action="edit" data-id="${show.id}">编辑</button>
        <button class="danger" type="button" data-action="delete" data-id="${show.id}">删除</button>
      </div>
    `;

    showsList.append(item);
  });
}

function renderMapCalendar(visibleShows) {
  const datedShows = visibleShows.filter((show) => show.date);
  const showsByDate = countBy(datedShows, (show) => show.date);
  const years = [...new Set(datedShows.map((show) => show.date.slice(0, 4)))].sort();
  const calendarYears = years.length ? years : [String(new Date().getFullYear())];
  const maxDayCount = Math.max(1, ...Object.values(showsByDate));
  const cities = countBy(
    visibleShows.filter((show) => show.city),
    (show) => normalizeCity(show.city),
  );

  const board = document.createElement("article");
  board.className = "map-calendar-board";
  board.innerHTML = `
    <section class="calendar-card">
      <div class="visual-head">
        <div>
          <h3>演出日历</h3>
          <p>有颜色的日期，就是去现场的日子。</p>
        </div>
        <span>${datedShows.length} 天</span>
      </div>
      <div class="calendar-years">
        ${calendarYears.map((year) => renderCalendarYear(year, showsByDate, visibleShows, maxDayCount)).join("")}
      </div>
      <div class="calendar-events">${renderCalendarEvents(datedShows)}</div>
    </section>
    <section class="map-card">
      <div class="visual-head">
        <div>
          <h3>亚洲现场地图</h3>
          <p>按城市落点，气泡越大代表场次越多。</p>
        </div>
        <span>${Object.keys(cities).length} 城</span>
      </div>
      <div class="asia-map" aria-label="亚洲演出城市分布">
        <div class="map-land land-east"></div>
        <div class="map-land land-south"></div>
        <div class="map-land land-islands"></div>
        ${renderCityDots(cities)}
      </div>
      <div class="city-legend">${renderCityLegend(cities)}</div>
    </section>
  `;
  showsList.append(board);
}

function renderCalendarEvents(datedShows) {
  if (!datedShows.length) return `<span>还没有填写日期的演出</span>`;
  return datedShows
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((show) => `
      <span>
        <strong>${formatDate(show.date)}</strong>
        ${escapeHtml(show.city || "未填写城市")} · ${escapeHtml(show.artist || "未命名")}
      </span>
    `)
    .join("");
}

function renderCalendarYear(year, showsByDate, visibleShows, maxDayCount) {
  const months = Array.from({ length: 12 }, (_, month) => {
    const firstDay = new Date(Number(year), month, 1).getDay();
    const daysInMonth = new Date(Number(year), month + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay }, () => `<span class="calendar-day blank"></span>`).join("");
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const count = showsByDate[date] || 0;
      const level = count ? Math.ceil((count / maxDayCount) * 4) : 0;
      const details = visibleShows
        .filter((show) => show.date === date)
        .map((show) => `${show.artist || "未命名"} · ${show.city || "未填写城市"}`)
        .join(" / ");
      return `<span class="calendar-day level-${level}" title="${escapeHtml(details)}">${day}</span>`;
    }).join("");
    return `
      <div class="calendar-month">
        <strong>${month + 1}月</strong>
        <div class="calendar-days">${blanks}${days}</div>
      </div>
    `;
  }).join("");
  return `
    <div class="calendar-year">
      <h4>${year}</h4>
      <div class="calendar-months">${months}</div>
    </div>
  `;
}

function renderCityDots(cities) {
  const entries = Object.entries(cities).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...entries.map(([, count]) => count));
  return entries
    .map(([city, count]) => {
      const point = getCityPoint(city);
      const size = 18 + Math.round((count / maxCount) * 22);
      return `
        <span
          class="map-dot"
          style="left:${point.x}%; top:${point.y}%; width:${size}px; height:${size}px;"
          title="${escapeHtml(city)} · ${count} 场"
        >
          <i>${count}</i>
          <em>${escapeHtml(city)}</em>
        </span>
      `;
    })
    .join("");
}

function renderCityLegend(cities) {
  const entries = Object.entries(cities).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `<span>还没有城市记录</span>`;
  return entries
    .map(([city, count]) => `<span><strong>${escapeHtml(city)}</strong>${count} 场</span>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseMemoBlock(block) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const text = lines.join(" ");
  const show = {
    id: crypto.randomUUID(),
    title: "",
    artist: "",
    date: normalizeDate(text),
    city: "",
    venue: "",
    status: "",
    price: "",
    rating: null,
    companions: [],
    tags: [],
    notes: "",
    setlist: [],
    updatedAt: new Date().toISOString(),
  };

  const cityNames = [
    "北京", "上海", "广州", "深圳", "成都", "重庆", "杭州", "南京", "武汉", "西安",
    "长沙", "苏州", "天津", "青岛", "厦门", "郑州", "宁波", "合肥", "佛山", "澳门",
    "香港", "台北", "新加坡", "东京", "首尔",
  ];

  for (const line of lines) {
    const field = line.match(/^(.{1,6})[:：]\s*(.+)$/);
    if (!field) continue;
    const key = field[1].trim();
    const value = field[2].trim();
    if (/艺人|歌手|乐队/.test(key)) show.artist = value;
    else if (/演出|标题|名称|主题/.test(key)) show.title = value;
    else if (/日期|时间/.test(key)) show.date = normalizeDate(value) || show.date;
    else if (/城市|地点/.test(key)) show.city = normalizeCity(value);
    else if (/场馆|场地/.test(key)) show.venue = value;
    else if (/状态/.test(key)) show.status = value;
    else if (/票价|价格|金额/.test(key)) show.price = parsePrice(value) || value;
    else if (/评分|打分/.test(key)) show.rating = parseRating(value);
    else if (/同行/.test(key)) show.companions = splitList(value);
    else if (/标签|关键词/.test(key)) show.tags = splitList(value);
    else if (/歌单|曲目/.test(key)) show.setlist = splitList(value);
    else if (/备注|感想/.test(key)) show.notes = value;
  }

  show.rating = show.rating || parseRating(text);
  show.price = show.price || parsePrice(text);
  show.city = normalizeCity(show.city || cityNames.find((city) => text.includes(city)) || "");

  if (!show.title || !show.artist) {
    const cleaned = text
      .replace(/(20\d{2})[.\-/年]\d{1,2}[.\-/月]\d{1,2}[日号]?/g, "")
      .replace(/评分\s*[:：]?\s*\d/g, "")
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    show.artist = show.artist || parts[0] || "未识别艺人";
    show.title = show.title || parts.slice(1, 4).join(" ") || `${show.artist} 演出`;
  }

  if (!show.notes) {
    const fieldLines = lines.filter((line) => !/^.{1,6}[:：]/.test(line));
    show.notes = fieldLines.slice(1).join("\n");
  }

  return show;
}

function parseRating(value) {
  const match = String(value).match(/(?:评分|打分)?\s*[:：]?\s*([1-5])(?:\s*分|\s*\/\s*5)?/);
  return match ? Number(match[1]) : null;
}

function parsePrice(value) {
  const match = String(value).match(/(?:票价|价格|金额)?\s*[:：]?\s*((?:¥|￥|₩|KRW|RMB|CNY)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:元|韩元|人民币))/i);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function parsePriceAmount(value) {
  const text = String(value || "").replace(/\s+/g, "");
  const amountMatch = text.match(/[\d,]+(?:\.\d+)?/);
  if (!amountMatch) return null;

  let currency = "";
  if (/₩|KRW|韩元/i.test(text)) currency = "₩";
  else if (/¥|￥|RMB|CNY|元|人民币/i.test(text)) currency = "¥";
  else return null;

  return {
    currency,
    amount: Number(amountMatch[0].replace(/,/g, "")),
  };
}

function parseTableRows(value) {
  const lines = value
    .split("\n")
    .filter((line) => line.trim())
    .filter((line) => !/^🎫|^concert list$/i.test(line.trim()))
    .filter((line) => !/^日期\s+艺人\s+城市/.test(line.trim()));

  return lines
    .map((line) =>
      (line.includes("\t") ? line.split("\t") : line.trim().split(/\s{2,}/)).map((cell) =>
        cell.trim(),
      ),
    )
    .filter((cells) => cells.length >= 3 && normalizeDate(cells[0]))
    .map((cells) => {
      let [date, artist, city, status = "", price = "", ...detailParts] = cells;
      if (!price && parsePrice(status)) {
        price = status;
        status = "";
      }
      const notes = detailParts.join(" ").trim();
      return {
        id: crypto.randomUUID(),
        title: "",
        artist,
        date: normalizeDate(date),
        city: normalizeCity(city),
        venue: "",
        status,
        price: parsePrice(price) || price,
        rating: null,
        companions: [],
        tags: [],
        notes,
        setlist: [],
        updatedAt: new Date().toISOString(),
      };
    });
}

function parseMemoText(value) {
  const tableRows = parseTableRows(value);
  if (tableRows.length) return tableRows;

  return value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseMemoBlock)
    .filter((show) => show.title || show.artist);
}

function updateMemoPreview() {
  const parsed = parseMemoText(memoText.value);
  memoPreview.textContent = parsed.length
    ? `已识别 ${parsed.length} 场，将追加到当前票夹。`
    : "粘贴后会自动识别日期、艺人、城市、状态、票价、详情和备注。";
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function renderSummary(type = activeSummary) {
  activeSummary = type;
  document
    .querySelectorAll(".metric")
    .forEach((metric) => metric.classList.toggle("active", metric.dataset.summary === type));

  if (!type) {
    summaryPanel.hidden = true;
    return;
  }

  summaryPanel.hidden = false;
  toggleMoneyBtn.hidden = type !== "spend";
  toggleMoneyBtn.textContent = moneyHidden ? "👁 显示金额" : "🙈 隐藏金额";

  const renderCountBubbles = (counts) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .map(
        ([label, count]) =>
          `<span class="summary-bubble"><strong>${escapeHtml(label)}</strong><small>${count} 场</small></span>`,
      )
      .join("");

  if (type === "shows") {
    summaryTitle.textContent = "演出时间线";
    summarySubtitle.textContent = "按日期查看每场记录。";
    summaryBubbles.innerHTML = shows
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(
        (show) =>
          `<span class="summary-bubble"><strong>${escapeHtml(show.artist || "未命名")}</strong><small>${formatDate(show.date)} · ${escapeHtml(show.city || "未填写城市")}</small></span>`,
      )
      .join("");
  } else if (type === "artists") {
    summaryTitle.textContent = "艺人汇总";
    summarySubtitle.textContent = "看过最多的艺人会排在前面。";
    summaryBubbles.innerHTML = renderCountBubbles(countBy(shows, (show) => normalizeArtist(show.artist)));
  } else if (type === "cities") {
    summaryTitle.textContent = "城市汇总";
    summarySubtitle.textContent = "按城市统计演出次数。";
    summaryBubbles.innerHTML = renderCountBubbles(countBy(shows, (show) => normalizeCity(show.city)));
  } else if (type === "spend") {
    summaryTitle.textContent = "票价汇总";
    summarySubtitle.textContent = moneyHidden ? "🤫 金额已隐藏。" : "按币种分别汇总已填写的票价。";
    const spend = summarizeSpend(shows);
    summaryBubbles.innerHTML = Object.entries(spend).length
      ? Object.entries(spend)
          .map(
            ([currency, amount]) =>
              `<span class="summary-bubble"><strong>${currency}</strong><small>${moneyHidden ? "🤫 ••••" : formatAmount(amount)}</small></span>`,
          )
          .join("")
      : `<span class="summary-bubble"><strong>暂无票价</strong><small>导入或填写票价后显示</small></span>`;
  }
}

function render() {
  renderAuth();
  renderStats();
  renderShows();
  renderSummary();
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

loginBtn.addEventListener("click", async () => {
  if (!cloud) {
    setStatus("还没有配置 Supabase，当前只能本地使用。");
    return;
  }
  const { data, error } = await cloud.auth.signInWithPassword({
    email: authEmail.value.trim(),
    password: authPassword.value,
  });
  if (error) {
    setStatus(`登录失败：${error.message}`);
    return;
  }
  currentUser = data.user;
  await loadCloudShows();
  render();
});

signupBtn.addEventListener("click", async () => {
  if (!cloud) {
    setStatus("还没有配置 Supabase，当前只能本地使用。");
    return;
  }
  const { data, error } = await cloud.auth.signUp({
    email: authEmail.value.trim(),
    password: authPassword.value,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) {
    setStatus(`注册失败：${error.message}`);
    return;
  }
  currentUser = data.user;
  setStatus("注册成功。如果 Supabase 开启了邮箱确认，请先去邮箱点确认链接。");
  await loadCloudShows();
  render();
});

logoutBtn.addEventListener("click", async () => {
  if (cloud) await cloud.auth.signOut();
  currentUser = null;
  shows = loadLocalShows();
  resetForm();
  render();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const show = getFormShow();
  const existingIndex = shows.findIndex((item) => item.id === show.id);

  if (existingIndex >= 0) {
    shows[existingIndex] = show;
  } else {
    shows.unshift(show);
  }

  saveLocalShows();
  await saveShowToCloud(show);
  exitEditMode();
  render();
});

showsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const show = shows.find((item) => item.id === button.dataset.id);
  if (!show) return;

  if (button.dataset.action === "delete") {
    shows = shows.filter((item) => item.id !== show.id);
    saveLocalShows();
    await deleteShowFromCloud(show.id);
    render();
    return;
  }

  fields.editingId.value = show.id;
  fields.title.value = show.title || "";
  fields.artist.value = show.artist || "";
  fields.date.value = show.date || "";
  fields.city.value = show.city || "";
  fields.venue.value = show.venue || "";
  fields.status.value = show.status || "";
  fields.price.value = show.price || "";
  fields.rating.value = show.rating || "";
  fields.companions.value = joinList(show.companions);
  fields.tags.value = joinList(show.tags);
  fields.notes.value = show.notes || "";
  fields.setlist.value = Array.isArray(show.setlist) ? show.setlist.join("\n") : "";
  enterEditMode();
});

cancelEditBtn.addEventListener("click", exitEditMode);
toggleFormBtn.addEventListener("click", () => {
  setFormExpanded(formBody.hidden);
});
searchInput.addEventListener("input", renderShows);
sortSelect.addEventListener("change", renderShows);
memoText.addEventListener("input", updateMemoPreview);

document.querySelectorAll(".metric").forEach((metric) => {
  metric.addEventListener("click", () => {
    renderSummary(activeSummary === metric.dataset.summary ? "" : metric.dataset.summary);
  });
});

toggleMoneyBtn.addEventListener("click", () => {
  moneyHidden = !moneyHidden;
  localStorage.setItem("concert-journal-hide-money", String(moneyHidden));
  renderStats();
  renderSummary("spend");
});

ticketViewBtn.addEventListener("click", () => {
  ticketView = "ticket";
  stackSpread = false;
  localStorage.setItem("concert-journal-ticket-view", ticketView);
  renderShows();
});

bubbleViewBtn.addEventListener("click", () => {
  ticketView = "bubble";
  stackSpread = false;
  localStorage.setItem("concert-journal-ticket-view", ticketView);
  renderShows();
});

stackViewBtn.addEventListener("click", () => {
  ticketView = "stack";
  stackSpread = false;
  localStorage.setItem("concert-journal-ticket-view", ticketView);
  renderShows();
});

mapViewBtn.addEventListener("click", () => {
  ticketView = "map";
  stackSpread = false;
  localStorage.setItem("concert-journal-ticket-view", ticketView);
  renderShows();
});

showsList.addEventListener("click", (event) => {
  if (ticketView !== "stack" || event.target.closest("button[data-action]")) return;
  stackSpread = !stackSpread;
  renderShows();
});

openMemoImportBtn.addEventListener("click", () => {
  memoDialog.showModal();
  memoText.focus();
});

closeMemoImportBtn.addEventListener("click", () => {
  memoDialog.close();
});

importMemoBtn.addEventListener("click", async () => {
  const imported = parseMemoText(memoText.value);
  if (!imported.length) {
    memoPreview.textContent = "没有识别到可导入的记录，请检查文本格式。";
    return;
  }

  shows = [...imported, ...shows];
  saveLocalShows();
  await saveManyToCloud(imported);
  memoText.value = "";
  updateMemoPreview();
  memoDialog.close();
  render();
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(shows, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "concert-journal.json";
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid file");
    shows = imported;
    saveLocalShows();
    await saveManyToCloud(imported);
    resetForm();
    render();
  } catch {
    alert("导入失败，请选择之前导出的 JSON 文件。");
  } finally {
    importInput.value = "";
  }
});

async function init() {
  setFormExpanded(false);
  const authParams = new URLSearchParams(window.location.hash.slice(1));
  const authError = authParams.get("error_description");
  if (authError) setStatus(`邮箱确认失败：${authError}`);

  if (cloud) {
    const { data } = await cloud.auth.getSession();
    currentUser = data.session?.user || null;
    if (currentUser) await loadCloudShows();
  }
  render();
}

init();

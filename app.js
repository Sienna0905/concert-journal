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
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authStatus = document.querySelector("#authStatus");
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

let shows = loadLocalShows();
let currentUser = null;

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
    setStatus("当前是本地单人模式。配置 Supabase 后可登录并跨设备同步。");
    return;
  }

  if (currentUser) {
    setStatus(`已登录：${currentUser.email}`);
    authEmail.hidden = true;
    authPassword.hidden = true;
    loginBtn.hidden = true;
    signupBtn.hidden = true;
    logoutBtn.hidden = false;
    return;
  }

  setStatus("请登录或注册。登录后，每个用户只能看到自己的演出记录。");
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

function getFormShow() {
  return {
    id: fields.editingId.value || crypto.randomUUID(),
    title: fields.title.value.trim(),
    artist: fields.artist.value.trim(),
    date: fields.date.value,
    city: fields.city.value.trim(),
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
}

function renderStats() {
  const artists = new Set(shows.map((show) => show.artist).filter(Boolean));
  const cities = new Set(shows.map((show) => show.city).filter(Boolean));
  const ratings = shows
    .map((show) => show.rating)
    .filter((rating) => Number.isFinite(rating));

  document.querySelector("#totalCount").textContent = shows.length;
  document.querySelector("#artistCount").textContent = artists.size;
  document.querySelector("#cityCount").textContent = cities.size;
  document.querySelector("#avgRating").textContent = ratings.length
    ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)
    : "-";
}

function getVisibleShows() {
  const keyword = searchInput.value.trim().toLowerCase();
  const visible = shows.filter((show) => {
    const haystack = [
      show.title,
      show.artist,
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

  if (!visibleShows.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有匹配的演出记录";
    showsList.append(empty);
    return;
  }

  for (const show of visibleShows) {
    const item = document.createElement("article");
    item.className = "show-item";

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
  }
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
    else if (/城市|地点/.test(key)) show.city = value;
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
  show.city = show.city || cityNames.find((city) => text.includes(city)) || "";

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
        city,
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

function render() {
  renderAuth();
  renderStats();
  renderShows();
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
  resetForm();
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
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

cancelEditBtn.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderShows);
sortSelect.addEventListener("change", renderShows);
memoText.addEventListener("input", updateMemoPreview);

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

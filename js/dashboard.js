import { db } from "./firebase.js";
import { ref, get, update, runTransaction, remove } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* ======================
   🔹 NAVIGATION
====================== */
const navDashboard = document.getElementById("navDashboard");
const navBossList = document.getElementById("navBossList");
const dashboardSection = document.getElementById("dashboardSection");
const bossListContainer = document.getElementById("bossListContainer");
const dashboardCards = document.getElementById("dashboardCards");

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

navToggle.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});

let isAuthorized = false;

navDashboard.addEventListener("click", () => {
  navDashboard.classList.add("active");
  navBossList.classList.remove("active");
  dashboardSection.style.display = "block";
  bossListContainer.style.display = "none";
  fetchAndRenderBosses();
});

navBossList.addEventListener("click", async () => {
  if (!isAuthorized) {
    const entered = prompt("Enter admin access token:");
    if (!entered) return alert("❌ Invalid token");
    try {
      const snap = await get(ref(db, "tokens/" + entered.trim()));
      if (!snap.exists() || snap.val() !== true) return alert("❌ Invalid token");
      isAuthorized = true;
      alert("✅ Access granted!");
    } catch (err) {
      console.error(err);
      return alert("❌ Token check failed");
    }
  }

  navBossList.classList.add("active");
  navDashboard.classList.remove("active");
  dashboardSection.style.display = "none";
  bossListContainer.style.display = "block";

  if (!document.getElementById("bossListSection")) {
    const html = await (await fetch("bosslist.html")).text();
    bossListContainer.innerHTML = html;
    const { initBossList } = await import("./bosslist.js");
    initBossList();
  }
});

/* ======================
   🔹 CONSTANTS
====================== */

const TEN_MIN = 10 * 60000;
const FIVE_MIN = 5 * 60000;

const countdownTimers = new Map();


/* ======================
   🔹 DISCORD
====================== */

let _webhookUrl = null;
let _webhookLoading = null;

async function getWebhookUrl() {
  if (_webhookUrl !== null) return _webhookUrl;
  if (_webhookLoading) return _webhookLoading;
  _webhookLoading = (async () => {
    try {
      const snap = await get(ref(db, "config/discordWebhook"));
      _webhookUrl = snap.val() || "";
    } catch {
      _webhookUrl = "";
    }
    return _webhookUrl;
  })();
  return _webhookLoading;
}

// Track sent pings to prevent duplicates across re-renders
const _sentPings = new Set();
const _pingCooldown = new Map();

function markPingSent(key) {
  _sentPings.add(key);
  sessionStorage.setItem("dp_" + key, "1");
}

function wasPingSent(key) {
  if (_sentPings.has(key)) return true;
  if (sessionStorage.getItem("dp_" + key)) {
    _sentPings.add(key);
    return true;
  }
  return false;
}

// Extra guard: boss-name cooldown to prevent duplicate-entried bosses
function markBossNamePinged(name) {
  _pingCooldown.set(name, Date.now());
}
function wasBossNamePingedRecently(name) {
  const t = _pingCooldown.get(name);
  return t && (Date.now() - t) < 60 * 60 * 1000;
}

// Prevent double-delete of the same boss entry
const _deletingKeys = new Set();

async function sendDiscordMessage(msg) {
  const url = await getWebhookUrl();
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg })
  });
}

function discordTemplate(title, status, lvl, guild) {
  return (
`📢 @everyone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                 🐦‍🔥 **${title}** 🐦‍🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lvl}
${guild}
${status}
📆 Time: <t:${Math.floor(Date.now()/1000)}:F>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}

/* ======================
   🔹 TIMEZONE
====================== */

let displayOffset = 8;
const timezoneSelect = document.getElementById("timezoneSelect");

function formatWithTimezone(date) {
  if (!date) return "N/A";

  if (displayOffset === "local") {
    return date.toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
      hour12: true,
    });
  }

  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const adjusted = new Date(utc + displayOffset * 3600000);

  return adjusted.toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
    hour12: true,
  });
}

function getDisplayDate(date) {
  if (displayOffset === "local") {
    return new Date(date.getTime());
  }
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const adjusted = new Date(utc + displayOffset * 3600000);
  return adjusted;
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "00 hrs : 00 mns : 00 secs";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return `${h.toString().padStart(2,"0")} hrs : ${m.toString().padStart(2,"0")} mns : ${s.toString().padStart(2,"0")} secs`;
}

/* ======================
   🔹 SCHEDULE LOGIC
====================== */

function getNextScheduledSpawn(scheduleStr) {
  if (!scheduleStr) return null;

  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const entries = scheduleStr.split(",").map(e => e.trim());

  let soonest = null;

  for (const entry of entries) {
    const [dayStr, timeStr] = entry.split(" ");
    const dayIndex = days.findIndex(d => d.toLowerCase() === dayStr.toLowerCase());
    if (dayIndex === -1 || !timeStr) continue;

    const [hour, minute] = timeStr.split(":").map(Number);

    let candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);

    const diffDays = (dayIndex - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + diffDays);

    if (candidate < now) candidate.setDate(candidate.getDate() + 7);
    if (!soonest || candidate < soonest) soonest = candidate;
  }

  return soonest;
}

/* ======================
   🔹 FETCH & RENDER
====================== */

async function fetchAndRenderBosses() {

  countdownTimers.forEach(clearInterval);
  countdownTimers.clear();

  const dashboardCards = document.getElementById("dashboardCards");

  try {
    const snapshot = await get(ref(db, "bosses"));
    if (!snapshot.exists()) {
      dashboardCards.innerHTML = "<p>No bosses found</p>";
      return;
    }

    const now = new Date();
    const displayNow = getDisplayDate(now);
    const today = { y: displayNow.getFullYear(), m: displayNow.getMonth(), d: displayNow.getDate() };
    const tomorrowDisplay = new Date(displayNow);
    tomorrowDisplay.setDate(tomorrowDisplay.getDate() + 1);
    const tomorrow = { y: tomorrowDisplay.getFullYear(), m: tomorrowDisplay.getMonth(), d: tomorrowDisplay.getDate() };

    const bosses = [];

    snapshot.forEach(child => {
      const b = child.val();
      b._key = child.key;

      let ts = Date.parse(b.nextSpawn);

      if (b.bossSchedule && !b.bossHour) {
        const next = getNextScheduledSpawn(b.bossSchedule);
        ts = next ? next.getTime() : Infinity;
      }

      b._ts = isNaN(ts) ? Infinity : ts;
      bosses.push(b);
    });

    bosses.sort((a,b)=>a._ts - b._ts);

    const groups = { soon: [], passed: [], today: [], tomorrow: [], later: [] };

    bosses.forEach(b => {
      const nextDate = new Date(b._ts);
      const displayNext = getDisplayDate(nextDate);
      const diff = b._ts - Date.now();

      if (diff <= TEN_MIN && diff > -FIVE_MIN) groups.soon.push(b);
      else if (diff <= -FIVE_MIN) groups.passed.push(b);
      else if (displayNext.getFullYear() === today.y && displayNext.getMonth() === today.m && displayNext.getDate() === today.d) groups.today.push(b);
      else if (displayNext.getFullYear() === tomorrow.y && displayNext.getMonth() === tomorrow.m && displayNext.getDate() === tomorrow.d) groups.tomorrow.push(b);
      else groups.later.push(b);
    });

    dashboardCards.innerHTML = "";

    const sections = [
      { label: "🕑 Spawning", color: "#66ff00ff", data: groups.soon },
      { label: "🌞 Today", color: "#007bff", data: groups.today },
      { label: "🌙 Tomorrow", color: "#6f42c1", data: groups.tomorrow },
      { label: "🌅 Coming Soon", color: "#e98e07ff", data: groups.later },
      { label: "💀 Terminated", color: "#888888", data: groups.passed },
    ];

    sections.forEach(section => {
      if (section.data.length === 0) return;

      const sectionContainer = document.createElement("div");
      sectionContainer.style.marginBottom = "2rem";

      const header = document.createElement("h2");
      header.textContent = section.label;
      header.style.color = section.color;
      header.style.fontWeight = "800";
      header.style.fontSize = "1.3rem";
      header.style.margin = "10px 0";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.cursor = "pointer";
      header.style.padding = "8px 12px";
      header.style.borderBottom = `2px solid ${section.color}`;
      header.style.background = "rgba(0,0,0,0.05)";
      header.style.borderRadius = "6px";

      const toggle = document.createElement("span");
      toggle.textContent = "▼";
      header.appendChild(toggle);

      const grid = document.createElement("div");
      grid.className = "boss-grid";
      grid.style.margin = "10px auto";
      grid.style.padding = "0 10px";
      grid.style.overflow = "hidden";
      grid.style.transition = "max-height 0.4s ease, opacity 0.4s ease";

      // Apply staggered fade-in effect to boss cards
section.data.filter(b => b.bossName).forEach((b, index) => {
  const card = createBossCard(b, section.color);
  card.style.animationDelay = `${index * 0.1}s`;
  grid.appendChild(card);
});

      header.addEventListener("click", () => {
        const collapsed = grid.classList.toggle("collapsed");
        grid.style.display = collapsed ? "none" : "grid";
        toggle.style.transform = collapsed ? "rotate(-90deg)" : "rotate(0deg)";
      });

      sectionContainer.append(header, grid);
      dashboardCards.appendChild(sectionContainer);
    });

  } catch (err) {
    console.error(err);
    dashboardCards.innerHTML = "<p>Error loading bosses</p>";
  }
}

/* ======================
   🔹 CARD
====================== */

function createBossCard(b, sectionColor) {

  const card = document.createElement("div");
  card.className = "boss-tile fade-in";
  card.style.borderLeft = `6px solid ${sectionColor}`;

  // Remove old mouseenter/mouseleave handlers as we're using CSS hover
  // card.addEventListener("mouseenter", () => (card.style.transform = "scale(1.03)"));
  // card.addEventListener("mouseleave", () => (card.style.transform = "scale(1)"));

  const bossImageMap = {
    VENATUS: "img/venatus.png",
    VIORENT: "img/viorent.png",
    VIOREN: "img/viorent.png",
    EGO: "img/ego.png",
    LIVERA: "img/livera_fool.png",
    ARANEO: "img/araneo.png",
    NEUTRO: "img/neutro_fool.png",
    SAPHIRUS: "img/saphirus.png",
    THYMELE: "img/thymele.png",
    UNDOMIEL: "img/undomiel.png",
    WANNITAS: "img/wannitas.png",
    DUPLICAN: "img/duplican.png",
    METUS: "img/metus_fool.png",
    AMENTIS: "img/amentis.png",
    CLEMANTIS: "img/clemantis.png",
    TITORE: "img/titore.png",
    GARETH: "img/gareth.png",
    LADYDALIA: "img/lady_dalia.png",
    GENAQULUES: "img/gen_aquleus.png",
    GENERALAQULES: "img/gen_aquleus.png",
    GENAQULEUS: "img/gen_aquleus.png",
    GENERALAQULEUS: "img/gen_aquleus.png",
    AURAQ: "img/auraq_fool.png",
    MILAVY: "img/milavy.png",
    CHAIFLOCK: "img/chaiflock.png",
    RODERICK: "img/roderick_fool.png",
    RINGOR: "img/ringor_fool.png",
    BENJI: "img/benji_fool.png",
    SHULIAR: "img/shuliar.png",
    LARBA: "img/larba_fool.png",
    BARON: "img/baron_fool.png",
    BARONBRAUDMORE: "img/baron_fool.png",
    CATENA: "img/catena.png",
    CETENA: "img/catena.png",
    ORDO: "img/ordo.png",
    SECRETA: "img/secreta.png",
    SUPORE: "img/supore.png",
    ASTA: "img/asta.png",
    LIBITINA: "img/libitina.png",
    RAKAJETH: "img/rakajeth.png",
    TUMIER: "img/tumier.png",
    TUMIA: "img/tumier.png",
  };

  const normalizedName =
    b.bossName?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";

  const imgSrc = bossImageMap[normalizedName] || "img/default.png";

  const img = document.createElement("img");
  img.src = imgSrc;
  img.alt = b.bossName;
  img.className = "boss-tile-img";
  card.appendChild(img);

  const info = document.createElement("div");
  info.className = "boss-tile-info";
  card.appendChild(info);

  const guild = b.guild || "FACTION";

  const guildTag = document.createElement("span");
  guildTag.textContent = "🜲 " + guild;
  guildTag.className = `guild-badge ${guild}`;
  info.appendChild(guildTag);

  const bossTypeTag = document.createElement("span");
  bossTypeTag.textContent =
    b.bossHour && b.bossHour !== "null" ? "Respawnable" : "Scheduled";
  bossTypeTag.className = `guild-badge ${guild}`;
  info.appendChild(bossTypeTag);

  const nameRow = document.createElement("div");
  nameRow.className = "boss-name-row";

  const title = document.createElement("h3");
  title.textContent = b.bossName || "Unknown";
  nameRow.appendChild(title);

  const lvlTag = document.createElement("span");
  lvlTag.textContent = "Lv. " + (b.lvl || "0");
  lvlTag.className = `level-badge ${guild}`;
  nameRow.appendChild(lvlTag);

  info.appendChild(nameRow);

  const countdown = document.createElement("span");
  countdown.className = "countdown";
  info.appendChild(countdown);

  const spawnInfo = document.createElement("p");
  spawnInfo.innerHTML =
    `<span style="color:#666;font-weight:bold">Spawn:</span> 
     <strong>${formatWithTimezone(new Date(b._ts))}</strong>`;
  info.appendChild(spawnInfo);

  /* ======================
     🔹 COUNTDOWN + DISCORD + NOTIFICATION
  ====================== */

  const interval = setInterval(async () => {

    const now = Date.now();
    const diff = b._ts - now;
    const estMinutes = b.est || 5;
    const isHourBoss = b.bossHour && b.bossHour !== "null";
    const isScheduleBoss = b.bossSchedule && b.bossSchedule !== "null";

    // Discord 10-min warning (narrow 2s window at the 10min mark)
    if (diff > 0 && diff <= TEN_MIN && diff > (TEN_MIN - 2000)) {
      const warnRef = ref(db, `bosses/${b._key}/warned10m`);
      const result = await runTransaction(warnRef, cur => cur === true ? undefined : true);
      if (result.committed && !wasPingSent(`warn_${b._key}`) && !wasBossNamePingedRecently(b.bossName)) {
        markPingSent(`warn_${b._key}`);
        markBossNamePinged(b.bossName);
        sendDiscordMessage(discordTemplate(
          b.bossName,
          "⏳ Status: **Spawning in approximately 10 minutes!**",
          "🎖️ Level: " +"**"+ b.lvl +"**",
          "👑 Guild: " +"**"+ b.guild +"**"
        ));
      }
    }

    // Discord spawn ping
    if (diff <= 0 && diff > -1000) {
      const spawnRef = ref(db, `bosses/${b._key}/spawnedPinged`);
      const result = await runTransaction(spawnRef, cur => cur === true ? undefined : true);
      if (result.committed && !wasPingSent(`spawn_${b._key}`) && !wasBossNamePingedRecently(b.bossName)) {
        markPingSent(`spawn_${b._key}`);
        markBossNamePinged(b.bossName);
        sendDiscordMessage(discordTemplate(
          b.bossName,
          "🔥 Status: **SPAWNED!**",
          "🎖️ Level: " +"**"+ b.lvl +"**",
          "👑 Guild: " +"**"+ b.guild +"**"
        ));
      }
    }

    // Browser notification at 10-min mark (narrow 2s window)
    if (diff > (TEN_MIN - 2000) && diff <= TEN_MIN && notificationsEnabled && Notification.permission === "granted") {
      const nKey = `n_${b._key}`;
      if (!sessionStorage.getItem(nKey)) {
        new Notification(`⏳ ${b.bossName}`, {
          body: `Spawning in ~10 min • Lv.${b.lvl} • ${b.guild}`,
          icon: imgSrc
        });
        sessionStorage.setItem(nKey, "1");
      }
    }

    // Auto-delete at spawn time
    if (diff <= 0 && diff > -3000 && !_deletingKeys.has(b._key)) {
      _deletingKeys.add(b._key);
      remove(ref(db, `bosses/${b._key}`));
      card.style.transition = "opacity 0.5s";
      card.style.opacity = "0";
      setTimeout(() => { card.remove(); clearInterval(interval); }, 500);
    }

    if (diff <= 0 && diff > -FIVE_MIN) {
      countdown.textContent = "SPAWNING NOW!";
      countdown.style.color = "red";
      card.style.borderLeftColor = "red";
    }
    else if (diff > 0) {
      countdown.textContent = formatCountdown(b._ts);
      card.style.borderLeftColor = sectionColor;
    }
    else {
      countdown.textContent = "💀 TERMINATED";
      countdown.style.color = "#999";
      card.style.borderLeftColor = "#888";
    }

  }, 1000);

  countdownTimers.set(b._key, interval);

  return card;
}


/* ======================
   🔹 NOTIFICATION TOGGLE
====================== */

let notificationsEnabled = localStorage.getItem("notifEnabled") === "true";
const notifToggle = document.getElementById("notifToggle");

if (notifToggle) {
  notifToggle.checked = notificationsEnabled;
  notifToggle.addEventListener("change", () => {
    notificationsEnabled = notifToggle.checked;
    localStorage.setItem("notifEnabled", notificationsEnabled);
    if (notificationsEnabled && Notification.permission === "default") {
      Notification.requestPermission();
    }
  });
}

/* ======================
   🔹 INIT
====================== */

window.addEventListener("DOMContentLoaded", fetchAndRenderBosses);

timezoneSelect.addEventListener("change", () => {
  const val = timezoneSelect.value;
  displayOffset = val === "local" ? "local" : parseFloat(val);
  localStorage.setItem("displayOffset", val);
  fetchAndRenderBosses();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchAndRenderBosses();
});


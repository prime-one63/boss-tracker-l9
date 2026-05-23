import { db } from "./firebase.js";
import {
    ref,
    push,
    set,
    update,
    remove,
    get,
    onChildAdded,
    onChildChanged,
    onChildRemoved
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function initBossList() {

    let bossCache = {};
    const processedBosses = new Map();

    const bossForm = document.getElementById("bossForm");
    const bossTable = document.querySelector("#bossTable tbody");
    const bossModal = new bootstrap.Modal(document.getElementById("bossModal"));

    const bossName = document.getElementById("bossName");
    const bossHour = document.getElementById("bossHour");
    const lastKilled = document.getElementById("lastKilled");
    const lastKilledField = document.getElementById("lastKilledField");
    const nextSpawn = document.getElementById("nextSpawn");
    const editKey = document.getElementById("editKey");

    const hourGroup = document.getElementById("hourGroup");
    const scheduleGroup = document.getElementById("scheduleGroup");
    const bossSchedule = document.getElementById("bossSchedule");

    const spawnHourType = document.getElementById("spawnHourType");
    const spawnScheduleType = document.getElementById("spawnScheduleType");

    const estimatedDeath = document.getElementById("estimatedDeath");
    const bossLevel = document.getElementById("bossLevel");

    const btnRepopulate = document.getElementById("btnRepopulate");

    const bossImageMap = {
        VENATUS: "img/venatus.png",
        VIORENT: "img/viorent.png",
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
        ORDO: "img/ordo.png",
        SECRETA: "img/secreta.png",
        SUPORE: "img/supore.png",
        ASTA: "img/asta.png",
        LIBITINA: "img/libitina.png",
        RAKAJETH: "img/rakajeth.png",
        TUMIER: "img/tumier.png"
    };

    const fixedScheduleBosses = [
        { bossName: "CLEMANTIS", guild: "Faction", bossSchedule: "Monday 11:30, Thursday 19:00", lvl: "70", est: "2" },
        { bossName: "LIBITINA", guild: "Faction", bossSchedule: "Monday 21:00, Saturday 21:00", lvl: "130", est: "2" },
        { bossName: "RAKAJETH", guild: "Faction", bossSchedule: "Tuesday 22:00, Sunday 19:00", lvl: "130", est: "2" },
        { bossName: "SAPHIRUS", guild: "Faction", bossSchedule: "Sunday 17:00, Tuesday 11:30", lvl: "80", est: "2" },
        { bossName: "NEUTRO", guild: "Faction", bossSchedule: "Tuesday 19:00, Thursday 11:30", lvl: "80", est: "2" },
        { bossName: "THYMELE", guild: "Faction", bossSchedule: "Monday 19:00, Wednesday 11:30", lvl: "85", est: "2" },
        { bossName: "MILAVY", guild: "Faction", bossSchedule: "Saturday 15:00", lvl: "90", est: "2" },
        { bossName: "RINGOR", guild: "Faction", bossSchedule: "Saturday 17:00", lvl: "95", est: "2" },
        { bossName: "RODERICK", guild: "Faction", bossSchedule: "Friday 19:00", lvl: "95", est: "2" },
        { bossName: "AURAQ", guild: "Faction", bossSchedule: "Friday 22:00, Wednesday 21:00", lvl: "100", est: "2" },
        { bossName: "CHAIFLOCK", guild: "Faction", bossSchedule: "Saturday 22:00", lvl: "120", est: "2" },
        { bossName: "BENJI", guild: "Faction", bossSchedule: "Sunday 21:00", lvl: "120", est: "2" },
        { bossName: "TUMIER", guild: "Faction", bossSchedule: "Sunday 19:00", lvl: "140", est: "2" }
    ];

    function toISO(dateStr) {
        if (!dateStr) return "";
        return new Date(dateStr).toISOString();
    }

    function toDatetimeLocalInput(stored) {
        if (!stored) return "";

        const d = new Date(stored);
        if (isNaN(d)) return "";

        const pad = n => String(n).padStart(2, "0");

        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function isSameWeek(date) {

        const now = new Date();

        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(now.getDate() - now.getDay());

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        return date >= start && date <= end;
    }

    function getNextScheduledSpawn(scheduleStr) {

        if (!scheduleStr) return null;

        const now = new Date();
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const schedules = scheduleStr.split(",").map(s => s.trim());

        let soonest = null;

        for (const entry of schedules) {

            const [dayStr, timeStr] = entry.split(" ");
            if (!dayStr || !timeStr) continue;

            const dayIndex = days.findIndex(d => d.toLowerCase() === dayStr.toLowerCase());
            if (dayIndex === -1) continue;

            const [hour, minute] = timeStr.split(":").map(Number);

            let candidate = new Date(now);
            candidate.setHours(hour, minute, 0, 0);

            const diff = (dayIndex - candidate.getDay() + 7) % 7;
            candidate.setDate(candidate.getDate() + diff);

            if (candidate < now) candidate.setDate(candidate.getDate() + 7);

            if (!soonest || candidate < soonest) soonest = candidate;
        }

        return soonest;
    }

    function calcNextSpawn() {

        const isHourBased = spawnHourType.checked;
        const isScheduleBased = spawnScheduleType.checked;

        if (isHourBased) {

            const hours = parseFloat(bossHour.value);
            const killed = lastKilled.value;

            if (hours && killed) {

                const d = new Date(killed);
                d.setHours(d.getHours() + hours);

                nextSpawn.value = toDatetimeLocalInput(d);
            }

        } else if (isScheduleBased) {

            const schedule = bossSchedule.value;

            if (schedule) {

                const next = getNextScheduledSpawn(schedule);
                if (next) nextSpawn.value = toDatetimeLocalInput(next);
            }
        }
    }

    const bossesRef = ref(db, "bosses");

    onChildAdded(bossesRef, (snapshot) => {

        const b = snapshot.val();
        b._key = snapshot.key;

        bossCache[b._key] = b;

        renderBossCards(Object.values(bossCache));
    });

    onChildChanged(bossesRef, (snapshot) => {

        const b = snapshot.val();
        b._key = snapshot.key;

        bossCache[b._key] = b;

        renderBossCards(Object.values(bossCache));
    });

    onChildRemoved(bossesRef, (snapshot) => {

        delete bossCache[snapshot.key];

        renderBossCards(Object.values(bossCache));
    });

    function renderBossCards(bosses) {

        const grid = document.getElementById("bossGrid");
        grid.innerHTML = "";

        bosses.sort((a, b) => {
            const ta = Date.parse(a.nextSpawn) || Infinity;
            const tb = Date.parse(b.nextSpawn) || Infinity;
            return ta - tb;
        });

        bosses.forEach(b => {
            const normalizedName =
                b.bossName?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
            const bossImg = bossImageMap[normalizedName] || "img/default.png";
            const card = document.createElement("div");
            card.className = "tracker-card";

            card.innerHTML = `
                <div class="tracker-header">

                    <img src="${bossImg}" class="boss-img">

                    <div class="boss-info">
                        <div class="tracker-title">${b.bossName || "Unknown"}</div>
                        <div class="boss-level">Level ${b.lvl || "--"}</div>
                    </div>

                </div>

                <div>Guild: ${b.guild || "Faction"}</div>
                <div>Spawn: ${b.bossHour ? b.bossHour + "h" : b.bossSchedule}</div>

                <div>Next Spawn:</div>
                <div>${b.nextSpawn || "--"}</div>

                <div class="tracker-actions">
                    <button class="btn btn-info btn-sm edit-btn" data-key="${b._key}">Edit</button>
                    <button class="btn btn-warning btn-sm reset-btn" data-key="${b._key}">Reset</button>
                    <button class="btn btn-danger btn-sm delete-btn" data-key="${b._key}">Delete</button>
                </div>
            `;

            grid.appendChild(card);

        });

    }

    document.addEventListener("click", async e => {

        if (e.target.classList.contains("delete-btn")) {

            const key = e.target.dataset.key;
            if (!confirm("Delete this boss?")) return;

            await remove(ref(db, "bosses/" + key));
        }

        if (e.target.classList.contains("reset-btn")) {

            const key = e.target.dataset.key;

            const snap = await get(ref(db, "bosses/" + key));
            if (!snap.exists()) return;

            const entry = snap.val();

            if (!confirm(`Reset ${entry.bossName}?`)) return;

            const now = new Date();
            const nextSpawnTime = new Date(now.getTime() + entry.bossHour * 60 * 60 * 1000);
            await update(ref(db, "bosses/" + key), {
                lastKilled: now.toISOString(),
                nextSpawn: nextSpawnTime.toISOString(),
                warned10m: false,
                spawnedPinged: false
            });
        }

        if (e.target.classList.contains("edit-btn")) {

            const key = e.target.dataset.key;

            const snap = await get(ref(db, "bosses/" + key));
            if (!snap.exists()) return;

            const b = snap.val();

            editKey.value = key;

            bossName.value = b.bossName || "";
            bossLevel.value = b.lvl || "";
            estimatedDeath.value = b.est || "";

            document.getElementById("guild").value = b.guild || "Faction";

            spawnHourType.checked = b.bossHour && b.bossHour !== "null";
            spawnScheduleType.checked = !spawnHourType.checked;

            bossHour.value = b.bossHour !== "null" ? b.bossHour : "";
            bossSchedule.value = b.bossSchedule !== "null" ? b.bossSchedule : "";

            lastKilled.value = toDatetimeLocalInput(b.lastKilled);
            nextSpawn.value = toDatetimeLocalInput(b.nextSpawn);

            updateSpawnTypeUI();

            bossModal.show();
        }
    });

    bossForm.addEventListener("submit", async e => {

        e.preventDefault();

        const entry = {

            bossName: bossName.value.trim().toUpperCase(),

            bossHour: spawnHourType.checked ? bossHour.value : "null",
            bossSchedule: spawnScheduleType.checked ? bossSchedule.value : "null",

            lastKilled: toISO(lastKilled.value),
            nextSpawn: toISO(nextSpawn.value),

            est: estimatedDeath.value,
            lvl: bossLevel.value,
            guild: document.getElementById("guild").value
        };

        const key = editKey.value;

        if (key) {
            await update(ref(db, "bosses/" + key), entry);
        } else {
            await set(push(ref(db, "bosses")), entry);
        }

        bossForm.reset();
        editKey.value = "";
        bossModal.hide();
    });

    function monitorBosses() {

        const now = Date.now();

        for (const key in bossCache) {

            const boss = bossCache[key];

            const nextTime = Date.parse(boss.nextSpawn);
            if (isNaN(nextTime)) continue;
        }
    }

    setInterval(monitorBosses, 5000);

    async function handleRepopulate() {

        if (!confirm("♻ Repopulate weekly bosses?")) return;

        btnRepopulate.disabled = true;

        try {

            const bossesRef = ref(db, "bosses");
            const snapshot = await get(bossesRef);

            const existing = new Set();

            if (snapshot.exists()) {

                snapshot.forEach(child => {

                    const b = child.val();

                    if (b.nextSpawn) {
                        existing.add(`${b.bossName}_${b.nextSpawn}`);
                    }
                });
            }

            let added = 0;

            for (const b of fixedScheduleBosses) {

                const schedules = b.bossSchedule.split(",").map(s => s.trim());

                for (const scheduleEntry of schedules) {

                    const nextSpawn = getNextScheduledSpawn(scheduleEntry);
                    if (!nextSpawn) continue;

                    if (!isSameWeek(nextSpawn)) continue;

                    const key = `${b.bossName}_${nextSpawn.toISOString()}`;

                    if (!existing.has(key)) {

                        await push(bossesRef, {

                            bossName: b.bossName,
                            guild: b.guild,
                            lvl: b.lvl,
                            est: b.est,

                            bossSchedule: scheduleEntry,
                            nextSpawn: nextSpawn.toISOString(),

                            bossHour: "null",
                            lastKilled: "",

                            warned10m: false,
                            spawnedPinged: false,
                            cycleReset: false
                        });

                        existing.add(key);
                        added++;
                    }
                }
            }

            alert(`${added} bosses added`);

        } catch (err) {

            console.error(err);
            alert("Repopulate error");
        }

        btnRepopulate.disabled = false;
    }

    if (btnRepopulate) {
        btnRepopulate.addEventListener("click", handleRepopulate);
    }

    const btnBulkImport = document.getElementById("btnBulkImport");
    const bulkImportForm = document.getElementById("bulkImportForm");
    const bulkImportData = document.getElementById("bulkImportData");
    const bulkImportModal = document.getElementById("bulkImportModal");

    if (bulkImportForm) {
        bulkImportForm.addEventListener("submit", async e => {
            e.preventDefault();
            const data = bulkImportData.value;
            const dateInput = document.getElementById("bulkImportDate").value;

            if (!data.trim()) return alert("Please paste boss data");
            if (!dateInput) return alert("Please select a date");

            const bossesRef = ref(db, "bosses");
            const results = handleBulkImport(data, dateInput);
            let added = 0;

            for (const entry of results) {
                await push(bossesRef, entry);
                added++;
            }

            alert(`${added} bosses imported`);
            bulkImportData.value = "";
            document.getElementById("bulkImportDate").value = "";
            const modal = bootstrap.Modal.getInstance(bulkImportModal);
            if (modal) modal.hide();
            renderBossCards(Object.values(bossCache));
        });
    }

    function parseBulkImportData(data) {
        const bossTimes = {};
        const lines = data.trim().split("\n");

        for (const line of lines) {
            const match = line.match(/•\s*(\d{2}:\d{2})\s*[-—–]\s*([A-Za-z][A-Za-z\s]*?)(?:\s*[-—–]|$)/);
            if (!match) continue;

            const [_, timeStr, bossNameRaw] = match;
            const bossName = bossNameRaw.trim().toUpperCase();
            const [hour, minute] = timeStr.split(":").map(Number);
            const totalMinutes = hour * 60 + minute;

            if (!bossTimes[bossName]) bossTimes[bossName] = [];
            bossTimes[bossName].push(totalMinutes);
        }

        const results = [];
        for (const [bossName, times] of Object.entries(bossTimes)) {
            times.sort((a, b) => a - b);

            let hours = 10;

            if (times.length > 1) {
                const intervals = [];
                for (let i = 1; i < times.length; i++) {
                    intervals.push(times[i] - times[i - 1]);
                }
                if (intervals.length > 0) {
                    const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
                    hours = Math.max(1, Math.min(24, Math.round(avgInterval / 60)));
                }
            }

            const latestTime = times[times.length - 1];
            results.push({
                bossName,
                bossHour: String(hours),
                latestTimeMinutes: latestTime
            });
        }

        return results;
    }

    function handleBulkImport(bossData, dateInput) {
        const parsed = parseBulkImportData(bossData);

        // Parse selected date (YYYY-MM-DD)
        const [year, month, day] = dateInput.split("-").map(Number);

        const timestamp = Date.now();
        const results = [];

        for (const entry of parsed) {
            const { bossName, bossHour, latestTimeMinutes } = entry;

            // Input times are in +7, convert to +8 by adding 60 minutes
            const adjustedMinutes = latestTimeMinutes + 60;
            const hours = Math.floor(adjustedMinutes / 60) % 24;
            const minutes = adjustedMinutes % 60;
            const dayOffset = Math.floor(adjustedMinutes / (24 * 60));

            // Create date in local timezone (+8) — this is the spawn time
            const spawnDate = new Date(year, month - 1, day + dayOffset, hours, minutes, 0, 0);

            const hoursInterval = parseInt(bossHour);

            results.push({
                id: `bulk_${timestamp}_${bossName}`,
                bossName: bossName,
                guild: "Faction",
                lvl: "70",
                est: "2",
                bossHour: String(hoursInterval),
                bossSchedule: "null",
                lastKilled: "",
                nextSpawn: spawnDate.toISOString(),
                warned10m: false,
                spawnedPinged: false,
                cycleReset: false
            });
        }

        return results;
    }

    function updateSpawnTypeUI() {

        hourGroup.style.display = spawnHourType.checked ? "block" : "none";
        lastKilledField.style.display = spawnHourType.checked ? "block" : "none";
        scheduleGroup.style.display = spawnScheduleType.checked ? "block" : "none";
    }

    bossHour.addEventListener("input", calcNextSpawn);
    bossSchedule.addEventListener("input", calcNextSpawn);
    lastKilled.addEventListener("input", calcNextSpawn);

    spawnHourType.addEventListener("change", () => {
        updateSpawnTypeUI();
        calcNextSpawn();
    });

    spawnScheduleType.addEventListener("change", () => {
        updateSpawnTypeUI();
        calcNextSpawn();
    });

    updateSpawnTypeUI();

    window.addEventListener("load", handleRepopulate);
}


// =========================================================
// FREON AI — FOUNDER-ONLY MULTIMODAL TRAINER + HIGH-DETAIL ANIME VIDEO CALL + ALL WORD FONTS
// =========================================================
const FIREBASE_CANDIDATES = [
  "https://freon-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://freon-ai-default-rtdb.firebaseio.com",
  "https://freon-ai-default-rtdb.europe-west1.firebasedatabase.app"
];
let FIREBASE_DB_URL = FIREBASE_CANDIDATES[0];

const API_URL = "https://api.vikey.ai/v1/chat/completions";
const API_KEY = "vk-119ba6a1-753f-4dd3-ad7a-c03b511630ee";
const DEFAULT_FOUNDER_ADMIN = { username: "Franky", password: "123", isFounder: true, isPrimaryFounder: true };
const MAX_PRIMARY_FOUNDERS = 5;
const DEFAULT_WA_NUMBER = "62881010962506";

const MS_WORD_FONTS = [
  "Times New Roman", "Calibri", "Arial", "Cambria", "Georgia", "Garamond",
  "Tahoma", "Verdana", "Trebuchet MS", "Segoe UI", "Palatino Linotype",
  "Book Antiqua", "Century Gothic", "Courier New", "Consolas",
  "Lucida Sans", "Impact", "Comic Sans MS"
];

let selectedWordFont = localStorage.getItem("freon_word_font") || "Times New Roman";

function onDocFontChange() {
  const sel = document.getElementById("docFontSelect");
  if (!sel) return;
  selectedWordFont = sel.value || "Times New Roman";
  localStorage.setItem("freon_word_font", selectedWordFont);
  const footerLbl = document.getElementById("activeFontFooterLabel");
  if (footerLbl) footerLbl.textContent = selectedWordFont;
  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
}

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const main = document.getElementById("mainApp");
  if (sidebar && main && !document.getElementById("appShellRow")) {
    const wrapper = document.createElement("div");
    wrapper.id = "appShellRow";
    wrapper.className = "app-shell-row";
    sidebar.parentNode.insertBefore(wrapper, sidebar);
    wrapper.appendChild(sidebar);
    wrapper.appendChild(main);
  }
  const fontSel = document.getElementById("docFontSelect");
  if (fontSel) {
    fontSel.value = selectedWordFont;
    const footerLbl = document.getElementById("activeFontFooterLabel");
    if (footerLbl) footerLbl.textContent = selectedWordFont;
  }
});

// ==========================================
// 1. KONEKSI FIREBASE & GENERATOR UID / USERNAME ACAK
// ==========================================
async function resolveFirebaseUrl() {
  for (const url of FIREBASE_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${url}/config.json`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) { FIREBASE_DB_URL = url; return url; }
    } catch {}
  }
  return FIREBASE_DB_URL;
}

async function dbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error("Gagal membaca database cloud");
  return await res.json();
}

async function dbSet(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Gagal menyimpan ke database cloud");
  return await res.json();
}

async function dbPatch(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Gagal update database cloud");
  return await res.json();
}

async function dbDelete(path) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "DELETE" });
}

function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `FREON-${suffix}`;
}

function generateRandomCustomerUsername(fullName) {
  const base = String(fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "member";
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `frn_${base}${randNum}`;
}

function generateSystemUID() {
  const year = new Date().getFullYear();
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `UID-${year}-${part1}${part2}`;
}

function normalizeWaNumber(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  return digits || DEFAULT_WA_NUMBER;
}

let adminWhatsAppNumber = DEFAULT_WA_NUMBER;

async function initCloudDatabase() {
  try {
    await resolveFirebaseUrl();
    const code = await dbGet("config/activationCode");
    if (!code) await dbSet("config/activationCode", "FREON-2026");

    const waNum = await dbGet("config/whatsappNumber");
    if (waNum) adminWhatsAppNumber = normalizeWaNumber(waNum);
    else await dbSet("config/whatsappNumber", DEFAULT_WA_NUMBER);

    const admins = await dbGet("admins");
    const hasFounder = admins && Object.values(admins).some(a => a && a.isFounder);
    if (!admins || !hasFounder) await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN);

    const customers = await dbGet("customers");
    if (!customers) {
      await dbSet("customers/frn_demo1001", {
        fullName: "Demo Customer FREON", username: "frn_demo1001", uid: "UID-2026-10010001",
        password: "123", quota: 20000, status: "active", banReason: "", warningMessage: "",
        exclusiveUnlocked: false, premiumUnlocked: false
      });
    }

    await syncFounderBroadcast();
  } catch (err) {
    console.warn("Firebase init info:", err.message);
  }
}

// ==========================================
// 1B. FOUNDER GLOBAL BROADCAST & INFO UPDATE LINK KE SEMUA AKUN
// ==========================================
let lastDismissedBroadcastId = "";

async function syncFounderBroadcast() {
  try {
    const info = await dbGet("config/founderBroadcast");
    const mainBanner = document.getElementById("globalBroadcastBanner");
    const mainMsg = document.getElementById("globalBroadcastMessage");
    const mainLink = document.getElementById("globalBroadcastLinkBtn");

    const authBox = document.getElementById("authBroadcastBox");
    const authText = document.getElementById("authBroadcastText");
    const authLink = document.getElementById("authBroadcastLink");

    if (!info || !info.message) {
      if (mainBanner) mainBanner.style.display = "none";
      if (authBox) authBox.style.display = "none";
      return;
    }

    if (authBox && authText) {
      authBox.style.display = "block";
      authText.textContent = info.message;
      if (authLink) {
        if (info.url) { authLink.href = info.url; authLink.style.display = "inline-block"; }
        else authLink.style.display = "none";
      }
    }

    if (mainBanner && mainMsg && lastDismissedBroadcastId !== String(info.updatedAt)) {
      mainBanner.style.display = "flex";
      mainMsg.textContent = info.message;
      if (mainLink) {
        if (info.url) { mainLink.href = info.url; mainLink.style.display = "inline-block"; }
        else mainLink.style.display = "none";
      }
    }
  } catch {}
}

function dismissBroadcastBanner() {
  const banner = document.getElementById("globalBroadcastBanner");
  if (banner) banner.style.display = "none";
  lastDismissedBroadcastId = String(Date.now());
}

document.getElementById("founderBroadcastForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!isCurrentUserFounder()) {
    alert("🔒 Hanya Founder Utama yang dapat menyiarkan pengumuman global.");
    return;
  }
  const msg = document.getElementById("broadcastMsgInput").value.trim();
  const url = document.getElementById("broadcastUrlInput").value.trim();
  if (!msg) return alert("Isi pesan pengumuman terlebih dahulu!");

  lastDismissedBroadcastId = "";
  await dbSet("config/founderBroadcast", {
    message: msg, url: url || "", author: activeUser.username, updatedAt: Date.now()
  });

  await syncFounderBroadcast();
  alert("📢 Pengumuman & info link baru berhasil disiarkan ke SEMUA akun (Customer, Co-Founder, dan Founder)!");
});

async function clearFounderBroadcast() {
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat menghapus pengumuman.");
  await dbDelete("config/founderBroadcast");
  document.getElementById("broadcastMsgInput").value = "";
  document.getElementById("broadcastUrlInput").value = "";
  await syncFounderBroadcast();
  alert("🗑️ Pengumuman global berhasil dihapus.");
}

// ==========================================
// 2. VIDEO CALL ANIMASI HIGH-DETAIL NARUTO & HINATA (SESUAI REFERENSI)
// ==========================================
let vcIsOpen = false;
let vcAnimFrameId = null;
let vcLocalStream = null;
let vcIsMuted = false;
let vcIsCameraOff = false;
let vcSpeakerMode = "both";
let vcSpeakingChar = null;
let vcMouthOpenAmount = 0;
let vcLipSyncTimer = null;
let vcRecognition = null;
let vcBlinkTimer = 0;
let vcAutoLoop = true;
let vcCallHistory = [];

// Partikel salju malam romantis seperti pada gambar referensi
const vcSnowflakes = Array.from({ length: 55 }, () => ({
  x: Math.random() * 760,
  y: Math.random() * 430,
  r: 1.2 + Math.random() * 3.2,
  vy: 0.45 + Math.random() * 1.1,
  vx: -0.3 + Math.random() * 0.6,
  alpha: 0.35 + Math.random() * 0.6
}));

if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function toggleCallAutoLoop() {
  vcAutoLoop = !vcAutoLoop;
  const btn = document.getElementById("vcAutoLoopBtn");
  if (btn) {
    btn.classList.toggle("active", vcAutoLoop);
    btn.textContent = vcAutoLoop ? "🔄 Obrolan Otomatis: ON" : "⏸️ Obrolan Otomatis: OFF";
  }
  if (vcAutoLoop && vcIsOpen && !vcIsMuted && !vcSpeakingChar) startVoiceTalkInCall(false);
}

function captureLocalCallFrame() {
  const videoEl = document.getElementById("vcLocalVideo");
  if (!videoEl || vcIsCameraOff || !vcLocalStream || videoEl.readyState < 2) return null;
  try {
    const c = document.createElement("canvas");
    c.width = 480; c.height = 360;
    c.getContext("2d").drawImage(videoEl, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } catch { return null; }
}

async function openAnimeVideoCall() {
  closeMobileSidebar();
  vcIsOpen = true;
  vcIsMuted = false;
  vcIsCameraOff = false;
  vcSpeakingChar = null;
  vcMouthOpenAmount = 0;
  vcCallHistory = [];

  document.getElementById("vcMuteBtn").classList.remove("active-off");
  document.getElementById("vcMuteIcon").textContent = "🎤";
  document.getElementById("vcMuteText").textContent = "Mute";
  document.getElementById("vcCamBtn").classList.remove("active-off");
  document.getElementById("vcCamIcon").textContent = "📹";
  document.getElementById("vcCamText").textContent = "Matikan Kamera";
  document.getElementById("vcCamOffOverlay").classList.remove("show");
  document.getElementById("vcPipUserLabel").textContent = activeUser ? (activeUser.fullName || activeUser.username) : "Anda";

  document.getElementById("videoCallModalOverlay").classList.add("show");
  await startLocalCallCamera();
  startAnimeCanvasLoop();

  const greetName = activeUser ? (activeUser.fullName || activeUser.username) : "Teman";
  const greetMsg = `Halo ${greetName}! Aku Naruto dan ini Hinata. Senang sekali bisa video call denganmu di malam bersalju ini! Silakan langsung bicara saja, kami mendengarkanmu!`;
  setVcSubtitle(`🍥 Naruto: "${greetMsg}"`);
  await speakWithLipSync(greetMsg, "naruto");

  if (vcIsOpen && vcAutoLoop && !vcIsMuted) startVoiceTalkInCall(false);
}

function closeAnimeVideoCall() {
  vcIsOpen = false;
  vcSpeakingChar = null;
  vcMouthOpenAmount = 0;
  window.speechSynthesis?.cancel();
  if (vcLipSyncTimer) clearInterval(vcLipSyncTimer);
  if (vcAnimFrameId) cancelAnimationFrame(vcAnimFrameId);
  if (vcRecognition) { try { vcRecognition.abort(); } catch {} vcRecognition = null; }
  if (vcLocalStream) { vcLocalStream.getTracks().forEach(t => t.stop()); vcLocalStream = null; }
  document.getElementById("videoCallModalOverlay").classList.remove("show");
}

async function startLocalCallCamera() {
  const videoEl = document.getElementById("vcLocalVideo");
  const offOverlay = document.getElementById("vcCamOffOverlay");
  try {
    vcLocalStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    videoEl.srcObject = vcLocalStream;
    videoEl.muted = true;
    await videoEl.play();
    offOverlay.classList.remove("show");
  } catch {
    offOverlay.innerHTML = "<span>📷 Kamera Simulasi<br>(Izin browser nonaktif)</span>";
    offOverlay.classList.add("show");
  }
}

function toggleCallMute() {
  vcIsMuted = !vcIsMuted;
  const btn = document.getElementById("vcMuteBtn");
  const icon = document.getElementById("vcMuteIcon");
  const text = document.getElementById("vcMuteText");
  if (vcLocalStream) vcLocalStream.getAudioTracks().forEach(track => { track.enabled = !vcIsMuted; });

  if (vcIsMuted) {
    btn.classList.add("active-off"); icon.textContent = "🔇"; text.textContent = "Unmute";
    if (vcRecognition) { try { vcRecognition.abort(); } catch {} }
    setVcSubtitle("🔇 Mikrofon Anda sedang di-mute.");
  } else {
    btn.classList.remove("active-off"); icon.textContent = "🎤"; text.textContent = "Mute";
    setVcSubtitle("🎤 Mikrofon aktif kembali. Silakan bicara...");
    if (vcIsOpen && vcAutoLoop && !vcSpeakingChar) startVoiceTalkInCall(false);
  }
}

function toggleCallCamera() {
  vcIsCameraOff = !vcIsCameraOff;
  const btn = document.getElementById("vcCamBtn");
  const icon = document.getElementById("vcCamIcon");
  const text = document.getElementById("vcCamText");
  const offOverlay = document.getElementById("vcCamOffOverlay");
  if (vcLocalStream) vcLocalStream.getVideoTracks().forEach(track => { track.enabled = !vcIsCameraOff; });

  if (vcIsCameraOff) {
    btn.classList.add("active-off"); icon.textContent = "🚫"; text.textContent = "Nyalakan Kamera";
    offOverlay.innerHTML = "<span>📷 Kamera Dinonaktifkan</span>"; offOverlay.classList.add("show");
  } else {
    btn.classList.remove("active-off"); icon.textContent = "📹"; text.textContent = "Matikan Kamera";
    if (vcLocalStream && vcLocalStream.getVideoTracks().length > 0) offOverlay.classList.remove("show");
  }
}

function setActiveCallSpeaker(mode) {
  vcSpeakerMode = mode;
  document.getElementById("vcSelectBoth").classList.toggle("active", mode === "both");
  document.getElementById("vcSelectNaruto").classList.toggle("active", mode === "naruto");
  document.getElementById("vcSelectHinata").classList.toggle("active", mode === "hinata");
}

function setVcSubtitle(text) {
  const el = document.getElementById("vcSubtitleBar");
  if (el) el.textContent = text;
}

function speakWithLipSync(text, character = "naruto") {
  return new Promise((resolve) => {
    if (!vcIsOpen) { resolve(); return; }
    window.speechSynthesis?.cancel();
    if (vcLipSyncTimer) clearInterval(vcLipSyncTimer);

    vcSpeakingChar = character;
    const cleanText = String(text).replace(/```[\s\S]*?```/g, " kode program ").replace(/[*#_`~>-]/g, "").replace(/\s+/g, " ").trim();
    if (!cleanText || !("speechSynthesis" in window)) {
      vcSpeakingChar = null; vcMouthOpenAmount = 0; resolve(); return;
    }

    let charIndex = 0;
    let finished = false;
    const finishSpeaking = () => {
      if (finished) return;
      finished = true; vcSpeakingChar = null; vcMouthOpenAmount = 0;
      if (vcLipSyncTimer) clearInterval(vcLipSyncTimer);
      clearTimeout(safetyTimer);
      resolve();
    };

    const startSyllablePulse = () => {
      if (vcLipSyncTimer) clearInterval(vcLipSyncTimer);
      vcLipSyncTimer = setInterval(() => {
        if (!vcSpeakingChar || finished) { vcMouthOpenAmount = 0; clearInterval(vcLipSyncTimer); return; }
        const ch = cleanText[charIndex % Math.max(1, cleanText.length)] || "a";
        charIndex++;
        if ("aiueoAIUEO".includes(ch)) vcMouthOpenAmount = 0.72 + Math.random() * 0.28;
        else if (" .,!?".includes(ch)) vcMouthOpenAmount = 0.08;
        else vcMouthOpenAmount = 0.35 + Math.random() * 0.3;
      }, 80);
    };

    const safetyTimer = setTimeout(finishSpeaking, Math.min(14000, Math.max(2200, cleanText.length * 68)));
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = "id-ID";
    utter.rate = character === "naruto" ? 1.06 : 0.98;
    utter.pitch = character === "naruto" ? 1.0 : 1.28;
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang && v.lang.toLowerCase().includes("id"));
    if (idVoice) utter.voice = idVoice;

    utter.onboundary = (e) => { if (typeof e.charIndex === "number") charIndex = e.charIndex; vcMouthOpenAmount = 0.85; };
    utter.onstart = () => startSyllablePulse();
    utter.onend = () => finishSpeaking();
    utter.onerror = () => { startSyllablePulse(); setTimeout(finishSpeaking, Math.min(6000, Math.max(1800, cleanText.length * 50))); };

    startSyllablePulse();
    window.speechSynthesis.speak(utter);
  });
}

function startVoiceTalkInCall(isManualClick = true) {
  if (!vcIsOpen) return;
  if (vcIsMuted) {
    if (isManualClick) alert("Mikrofon Anda sedang di-mute! Klik tombol Unmute terlebih dahulu.");
    return;
  }
  if (vcSpeakingChar) { window.speechSynthesis?.cancel(); vcSpeakingChar = null; vcMouthOpenAmount = 0; }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (isManualClick) alert("Browser ini tidak mendukung pengenalan suara otomatis. Gunakan kolom ketik di bawah video call.");
    return;
  }
  if (vcRecognition) { try { vcRecognition.abort(); } catch {} }

  const talkText = document.getElementById("vcTalkText");
  let finalSpoken = "";
  vcRecognition = new SpeechRecognition();
  vcRecognition.lang = "id-ID";
  vcRecognition.continuous = false;
  vcRecognition.interimResults = true;

  vcRecognition.onstart = () => {
    if (talkText) talkText.textContent = "Mendengarkan...";
    setVcSubtitle("🎙️ Mendengarkan suaramu... (Silakan bicara)");
  };

  vcRecognition.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const part = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalSpoken += part;
      else interim += part;
    }
    const preview = (finalSpoken || interim).trim();
    if (preview) setVcSubtitle(`🧑 Anda: "${preview}"`);
  };

  vcRecognition.onerror = (ev) => {
    if (talkText) talkText.textContent = "Bicara Sekarang";
    if (!vcIsOpen || vcIsMuted || vcSpeakingChar) return;
    if ((ev.error === "no-speech" || ev.error === "aborted") && vcAutoLoop) setTimeout(() => startVoiceTalkInCall(false), 350);
  };

  vcRecognition.onend = async () => {
    if (talkText) talkText.textContent = "Bicara Sekarang";
    if (!vcIsOpen) return;
    const cleanSpoken = finalSpoken.trim();
    if (!cleanSpoken) {
      if (vcAutoLoop && !vcIsMuted && !vcSpeakingChar) setTimeout(() => startVoiceTalkInCall(false), 300);
      return;
    }
    setVcSubtitle(`🧑 Anda: "${cleanSpoken}"`);
    await processAnimeCallDialogue(cleanSpoken);
  };

  try { vcRecognition.start(); } catch {}
}

async function sendTextInVideoCall(e) {
  e.preventDefault();
  const inp = document.getElementById("vcTextInput");
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = "";
  if (vcRecognition) { try { vcRecognition.abort(); } catch {} }
  setVcSubtitle(`🧑 Anda: "${msg}"`);
  await processAnimeCallDialogue(msg);
}

async function processAnimeCallDialogue(userMessage) {
  if (!vcIsOpen) return;
  let responder = vcSpeakerMode;
  if (responder === "both") {
    const lower = userMessage.toLowerCase();
    if (lower.includes("hinata")) responder = "hinata";
    else if (lower.includes("naruto")) responder = "naruto";
    else responder = Math.random() > 0.5 ? "naruto" : "hinata";
  }

  const charPersona = responder === "naruto"
    ? "Kamu berperan sebagai Naruto Uzumaki yang bersemangat, ramah, dan suportif (kadang bilang 'Dattebayo!'). Jawab singkat, hangat, dan natural dalam 1-2 kalimat Bahasa Indonesia untuk percakapan video call."
    : "Kamu berperan sebagai Hinata Hyuga yang lembut, sopan, perhatian, dan pintar. Jawab singkat, ramah, dan natural dalam 1-2 kalimat Bahasa Indonesia untuk percakapan video call.";

  setVcSubtitle(`${responder === "naruto" ? "🍥 Naruto" : "💜 Hinata"} sedang menjawab...`);
  const camSnapshot = captureLocalCallFrame();
  vcCallHistory.push({ role: "user", content: userMessage });
  if (vcCallHistory.length > 8) vcCallHistory = vcCallHistory.slice(-8);

  const userPayload = camSnapshot
    ? [{ type: "text", text: userMessage }, { type: "image_url", image_url: { url: camSnapshot } }]
    : userMessage;

  let replyText = "";
  try {
    const res = await callVikeyAPI("deepseek/deepseek-v4-flash", [{ role: "system", content: charPersona }, ...vcCallHistory.slice(0, -1), { role: "user", content: userPayload }], 0.7, null, false);
    const data = await res.json();
    replyText = data.choices?.[0]?.message?.content || "";
  } catch {}

  if (!replyText) {
    replyText = responder === "naruto"
      ? "Aku dengar jelas! Semangat terus ya, aku dan Hinata selalu mendukungmu, Dattebayo!"
      : "Aku mendengarkanmu dengan baik. Ceritakan saja apa yang sedang kamu pikirkan.";
  }

  vcCallHistory.push({ role: "assistant", content: replyText });
  setVcSubtitle(`${responder === "naruto" ? "🍥 Naruto" : "💜 Hinata"}: "${replyText}"`);
  await speakWithLipSync(replyText, responder);
  if (vcIsOpen && vcAutoLoop && !vcIsMuted) startVoiceTalkInCall(false);
}

// RENDER ANIME HIGH-DETAIL (MIRIP REFERENSI: SALJU MALAM, HINATA PONI KILAU + MATA LAVENDER, NARUTO IKAT KEPALA KONOHA)
function startAnimeCanvasLoop() {
  const canvas = document.getElementById("animeCallCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function renderFrame() {
    if (!vcIsOpen) return;
    vcBlinkTimer += 0.03;
    const isBlinking = Math.sin(vcBlinkTimer) > 0.97;
    const floatY = Math.sin(vcBlinkTimer * 1.4) * 2.5;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Latar Belakang Malam Bersalju Bokeh (Sesuai Gambar Referensi)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#101827");
    bgGrad.addColorStop(0.55, "#1e293b");
    bgGrad.addColorStop(1, "#334155");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Cahaya bokeh lembut di belakang
    const bokeh = ctx.createRadialGradient(w * 0.5, h * 0.38, 20, w * 0.5, h * 0.38, 260);
    bokeh.addColorStop(0, "rgba(226, 232, 240, 0.22)");
    bokeh.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = bokeh;
    ctx.fillRect(0, 0, w, h);

    // 2. Render Karakter Anime High-Detail
    if (vcSpeakerMode === "naruto") {
      drawNarutoHighDetail(ctx, w / 2, h * 0.54 + floatY, 1.24, vcSpeakingChar === "naruto" ? vcMouthOpenAmount : 0, isBlinking);
    } else if (vcSpeakerMode === "hinata") {
      drawHinataHighDetail(ctx, w / 2, h * 0.54 + floatY, 1.24, vcSpeakingChar === "hinata" ? vcMouthOpenAmount : 0, isBlinking);
    } else {
      // Posisi bersebelahan akrab seperti di referensi (Hinata kiri, Naruto kanan)
      drawHinataHighDetail(ctx, w * 0.33, h * 0.56 + floatY, 1.05, vcSpeakingChar === "hinata" ? vcMouthOpenAmount : 0, isBlinking);
      drawNarutoHighDetail(ctx, w * 0.67, h * 0.55 - floatY, 1.05, vcSpeakingChar === "naruto" ? vcMouthOpenAmount : 0, isBlinking);
    }

    // 3. Efek Butiran Salju Turun
    vcSnowflakes.forEach(s => {
      s.y += s.vy;
      s.x += s.vx;
      if (s.y > h) { s.y = -5; s.x = Math.random() * w; }
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    vcAnimFrameId = requestAnimationFrame(renderFrame);
  }
  renderFrame();
}

function drawHinataHighDetail(ctx, cx, cy, scale, mouthOpen, blink) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (mouthOpen > 0.05) {
    ctx.strokeStyle = "rgba(216, 180, 254, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -8, 128, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rambut belakang panjang biru-hitam pekat
  const backHairGrad = ctx.createLinearGradient(0, -80, 0, 160);
  backHairGrad.addColorStop(0, "#0f172a");
  backHairGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = backHairGrad;
  ctx.beginPath();
  ctx.moveTo(-74, -20);
  ctx.quadraticCurveTo(-84, 75, -72, 165);
  ctx.lineTo(72, 165);
  ctx.quadraticCurveTo(84, 75, 74, -20);
  ctx.closePath();
  ctx.fill();

  // Jaket krem-putih lembut (sesuai gambar referensi)
  ctx.fillStyle = "#e7e5e4";
  ctx.strokeStyle = "#78716c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-78, 66, 156, 112, 32);
  ctx.fill();
  ctx.stroke();

  // Kerah dalam gelap & detail lipatan
  ctx.fillStyle = "#44403c";
  ctx.beginPath();
  ctx.moveTo(-36, 66);
  ctx.lineTo(0, 102);
  ctx.lineTo(36, 66);
  ctx.closePath();
  ctx.fill();

  // Leher & Wajah anime lembut dengan bayangan dagu
  ctx.fillStyle = "#fde6d8";
  ctx.fillRect(-18, 38, 36, 34);
  ctx.fillStyle = "rgba(225, 175, 150, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 46, 18, 10, 0, 0, Math.PI);
  ctx.fill();

  const skinGrad = ctx.createRadialGradient(0, -10, 10, 0, -5, 65);
  skinGrad.addColorStop(0, "#fff5ee");
  skinGrad.addColorStop(1, "#fbd5c0");
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.moveTo(-54, -22);
  ctx.quadraticCurveTo(-56, 22, -26, 42);
  ctx.quadraticCurveTo(0, 54, 26, 42);
  ctx.quadraticCurveTo(56, 22, 54, -22);
  ctx.quadraticCurveTo(0, -68, -54, -22);
  ctx.fill();

  // Rona pipi merah muda lembut (blush)
  ctx.fillStyle = "rgba(244, 114, 182, 0.24)";
  ctx.beginPath(); ctx.ellipse(-30, 12, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(30, 12, 13, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Mata Byakugan Lavender-Ungu Lembut + Bulu Mata Lentik
  if (blink) {
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-36, -4); ctx.quadraticCurveTo(-24, 2, -12, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -4); ctx.quadraticCurveTo(24, 2, 36, -4); ctx.stroke();
  } else {
    [-24, 24].forEach(ex => {
      // Putih mata
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(ex, -4, 12.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
      // Iris Byakugan lavender
      const eyeGrad = ctx.createRadialGradient(ex, -4, 2, ex, -4, 9);
      eyeGrad.addColorStop(0, "#f5f3ff");
      eyeGrad.addColorStop(0.65, "#ddd6fe");
      eyeGrad.addColorStop(1, "#a78bfa");
      ctx.fillStyle = eyeGrad;
      ctx.beginPath(); ctx.arc(ex, -4, 8.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.2; ctx.stroke();
      // Kilau refleksi mata anime
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(ex - 3, -7, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 3, -2, 1.3, 0, Math.PI * 2); ctx.fill();
      // Garis bulu mata atas lentik
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(ex - 13, -7);
      ctx.quadraticCurveTo(ex, -15, ex + 13, -7);
      ctx.stroke();
    });
  }

  // Alis tipis lembut
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-36, -18); ctx.quadraticCurveTo(-24, -22, -13, -18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -18); ctx.quadraticCurveTo(24, -22, 36, -18); ctx.stroke();

  // Hidung mungil & Senyum manis / Lip-sync
  ctx.fillStyle = "rgba(180, 120, 100, 0.6)";
  ctx.beginPath(); ctx.arc(0, 11, 1.5, 0, Math.PI * 2); ctx.fill();

  if (mouthOpen > 0.08) {
    const openH = 4 + mouthOpen * 13;
    ctx.fillStyle = "#be185d";
    ctx.beginPath(); ctx.ellipse(0, 26, 10, openH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fda4af";
    ctx.beginPath(); ctx.ellipse(0, 26 + openH * 0.35, 6, openH * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "#9d174d";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 22, 10, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // Poni lurus Hinata dengan HELAI SAMPING & KILAU ANIME SHEEN RING (Persis Referensi!)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(-58, -14);
  ctx.quadraticCurveTo(-58, -76, 0, -78);
  ctx.quadraticCurveTo(58, -76, 58, -14);
  // Ujung poni bergerigi halus di atas alis
  ctx.lineTo(42, -16); ctx.lineTo(36, -24); ctx.lineTo(24, -15);
  ctx.lineTo(12, -23); ctx.lineTo(0, -15); ctx.lineTo(-12, -23);
  ctx.lineTo(-24, -15); ctx.lineTo(-36, -24); ctx.lineTo(-42, -16);
  ctx.closePath();
  ctx.fill();

  // Helai rambut samping membingkai pipi
  ctx.beginPath();
  ctx.moveTo(-58, -20); ctx.quadraticCurveTo(-64, 30, -48, 86); ctx.lineTo(-40, 82); ctx.quadraticCurveTo(-50, 25, -48, -16); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, -20); ctx.quadraticCurveTo(64, 30, 48, 86); ctx.lineTo(40, 82); ctx.quadraticCurveTo(50, 25, 48, -16); ctx.fill();

  // Kilau highlight putih khas rambut Hinata di bagian atas poni
  ctx.fillStyle = "rgba(226, 232, 240, 0.78)";
  [-34, -22, -10, 2, 14, 26, 36].forEach((hx, idx) => {
    const hy = -46 + Math.abs(hx) * 0.22;
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 8);
    ctx.lineTo(hx + 3, hy - 8);
    ctx.lineTo(hx + 1, hy + 8);
    ctx.lineTo(hx - 4, hy + 6);
    ctx.closePath();
    ctx.fill();
  });

  // Nameplate
  ctx.fillStyle = "rgba(124, 58, 237, 0.92)";
  ctx.roundRect(-48, 126, 96, 22, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Hinata Hyuga", 0, 141);
  ctx.restore();
}

function drawNarutoHighDetail(ctx, cx, cy, scale, mouthOpen, blink) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (mouthOpen > 0.05) {
    ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -8, 128, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Jaket Oranye & Hitam Shippuden (Sesuai Referensi)
  ctx.fillStyle = "#ea580c";
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-82, 66, 164, 114, 30);
  ctx.fill();
  ctx.stroke();

  // Bagian bahu hitam jaket
  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.roundRect(-82, 66, 164, 42, [30, 30, 8, 8]);
  ctx.fill();

  // Kerah tinggi bergaris (ribbed turtleneck) + ritsleting perak
  ctx.fillStyle = "#27272a";
  ctx.fillRect(-32, 46, 64, 32);
  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = 1.5;
  [-22, -12, 12, 22].forEach(rx => {
    ctx.beginPath(); ctx.moveTo(rx, 48); ctx.lineTo(rx, 76); ctx.stroke();
  });
  ctx.fillStyle = "#d4d4d8";
  ctx.fillRect(-3, 52, 6, 120);

  // Leher & Wajah Naruto
  ctx.fillStyle = "#fed7aa";
  ctx.fillRect(-20, 36, 40, 26);

  const faceGrad = ctx.createRadialGradient(0, -8, 10, 0, -4, 65);
  faceGrad.addColorStop(0, "#ffedd5");
  faceGrad.addColorStop(1, "#fdba74");
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.moveTo(-56, -24);
  ctx.quadraticCurveTo(-56, 20, -26, 40);
  ctx.quadraticCurveTo(0, 52, 26, 40);
  ctx.quadraticCurveTo(56, 20, 56, -24);
  ctx.closePath();
  ctx.fill();

  // Rambut Kuning Runcing Berlapis dengan Shading
  const hairGrad = ctx.createLinearGradient(0, -110, 0, -25);
  hairGrad.addColorStop(0, "#fef08a");
  hairGrad.addColorStop(0.6, "#facc15");
  hairGrad.addColorStop(1, "#eab308");
  ctx.fillStyle = hairGrad;
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-64, -30);
  ctx.lineTo(-80, -74); ctx.lineTo(-48, -62);
  ctx.lineTo(-42, -104); ctx.lineTo(-14, -76);
  ctx.lineTo(4, -112); ctx.lineTo(22, -74);
  ctx.lineTo(54, -98); ctx.lineTo(48, -58);
  ctx.lineTo(78, -68); ctx.lineTo(62, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Poni kuning menyembul di bawah ikat kepala
  ctx.beginPath();
  ctx.moveTo(-48, -28); ctx.lineTo(-34, -14); ctx.lineTo(-20, -27);
  ctx.lineTo(-4, -12); ctx.lineTo(10, -27); ctx.lineTo(28, -14); ctx.lineTo(46, -28);
  ctx.closePath();
  ctx.fill();

  // Ikat Kepala Konoha Hitam + Pelat Logam Mengkilap & Spiral Konoha
  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.roundRect(-59, -48, 118, 22, 6);
  ctx.fill();

  const metalGrad = ctx.createLinearGradient(-32, -45, 32, -29);
  metalGrad.addColorStop(0, "#94a3b8");
  metalGrad.addColorStop(0.5, "#f1f5f9");
  metalGrad.addColorStop(1, "#64748b");
  ctx.fillStyle = metalGrad;
  ctx.beginPath();
  ctx.roundRect(-32, -45, 64, 16, 4);
  ctx.fill();

  // Baut & Logo Spiral Konoha
  ctx.fillStyle = "#475569";
  [-27, 27].forEach(bx => {
    ctx.beginPath(); ctx.arc(bx, -41, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, -33, 1.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -37, 5, 0, Math.PI * 1.75);
  ctx.lineTo(6, -34);
  ctx.stroke();

  // Mata Biru Cerah Naruto
  if (blink) {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-36, -6); ctx.lineTo(-14, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(36, -6); ctx.stroke();
  } else {
    [-25, 25].forEach(ex => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(ex, -6, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
      const blueIris = ctx.createRadialGradient(ex, -6, 2, ex, -6, 8);
      blueIris.addColorStop(0, "#7dd3fc");
      blueIris.addColorStop(0.6, "#0284c7");
      blueIris.addColorStop(1, "#0369a1");
      ctx.fillStyle = blueIris;
      ctx.beginPath(); ctx.arc(ex, -6, 7.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(ex, -6, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(ex - 2.8, -8.5, 2.5, 0, Math.PI * 2); ctx.fill();
      // Alis tegas
      ctx.strokeStyle = "#92400e"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ex - 11, -17); ctx.lineTo(ex + 11, -15); ctx.stroke();
    });
  }

  // 3 Garis Kumis Khas Naruto di Kedua Pipi
  ctx.strokeStyle = "#9a3412";
  ctx.lineWidth = 2;
  [-2, 5, 12].forEach(dy => {
    ctx.beginPath(); ctx.moveTo(-48, dy); ctx.lineTo(-30, dy + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, dy); ctx.lineTo(30, dy + 2); ctx.stroke();
  });

  // Mulut / Lip-Sync
  if (mouthOpen > 0.08) {
    const openH = 5 + mouthOpen * 16;
    ctx.fillStyle = "#991b1b";
    ctx.beginPath(); ctx.ellipse(0, 25, 14, openH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fca5a5";
    ctx.beginPath(); ctx.ellipse(0, 25 + openH * 0.35, 8, openH * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 19, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Nameplate
  ctx.fillStyle = "rgba(234, 88, 12, 0.94)";
  ctx.roundRect(-50, 126, 100, 22, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Naruto Uzumaki", 0, 141);
  ctx.restore();
}

// ==========================================
// 3. FITUR KIRIM TUGAS MENGGUNAKAN VIDEO
// ==========================================
let uploadedVideoObjectUrl = "";

function triggerVideoTaskUpload() {
  document.getElementById("plusPopover")?.classList.remove("show");
  document.getElementById("videoTaskInput").click();
}

function handleVideoTaskUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadedFileName = file.name;
  uploadedVideoObjectUrl = URL.createObjectURL(file);
  uploadedImageBase64 = "";

  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  showAttachment(`🎬 Video Tugas siap dikirim: ${file.name} (${sizeMB} MB) — Mengekstrak frame...`);

  const tempVideo = document.createElement("video");
  tempVideo.src = uploadedVideoObjectUrl;
  tempVideo.muted = true;
  tempVideo.playsInline = true;

  tempVideo.onloadeddata = () => {
    const durationSec = isFinite(tempVideo.duration) ? tempVideo.duration.toFixed(1) : "N/A";
    tempVideo.currentTime = Math.min(1, (tempVideo.duration || 1) * 0.25);
    tempVideo.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = Math.min(640, tempVideo.videoWidth || 640);
        c.height = Math.min(360, tempVideo.videoHeight || 360);
        c.getContext("2d").drawImage(tempVideo, 0, 0, c.width, c.height);
        uploadedImageBase64 = c.toDataURL("image/jpeg", 0.8);
      } catch {}
      uploadedTextContext = `\n\n[LAMPIRAN TUGAS VIDEO]\n• Nama File Video: ${file.name}\n• Ukuran: ${sizeMB} MB\n• Durasi: ${durationSec} detik\nInstruksi: Analisis visual frame video tersebut dan kerjakan atau evaluasi tugasnya secara lengkap.`;
      showAttachment(`🎬 Video Tugas siap dikirim: ${file.name} (${durationSec} dtk, ${sizeMB} MB)`);
      const inp = document.getElementById("userInput");
      if (!inp.value.trim()) inp.value = `Tolong periksa dan kerjakan tugas dari video "${file.name}" ini secara lengkap:`;
      inp.focus();
    };
  };
}

// ==========================================
// 4. BANTUAN WHATSAPP
// ==========================================
async function openWhatsAppHelp() {
  try {
    const cloudWa = await dbGet("config/whatsappNumber");
    if (cloudWa) adminWhatsAppNumber = normalizeWaNumber(cloudWa);
  } catch {}
  const cleanWa = normalizeWaNumber(adminWhatsAppNumber);
  const senderName = activeUser ? `${activeUser.fullName || activeUser.username} (${activeUser.uid || activeUser.username})` : "Pengunjung";
  const text = encodeURIComponent(`Halo Admin FREON AI, saya ${senderName} membutuhkan bantuan terkait akun/layanan FREON AI.`);
  window.open(`https://wa.me/${cleanWa}?text=${text}`, "_blank");
}

async function configureWhatsAppNumber() {
  if (!isCurrentUserFounder()) {
    alert("🔒 Akses Ditolak: Hanya 5 Founder Utama yang diizinkan mengubah nomor WhatsApp Bantuan.");
    return;
  }
  const input = prompt("Masukkan nomor WhatsApp Bantuan:", adminWhatsAppNumber);
  if (input && input.trim()) {
    const clean = normalizeWaNumber(input);
    if (!clean) return alert("Nomor WhatsApp tidak valid!");
    adminWhatsAppNumber = clean;
    await dbSet("config/whatsappNumber", clean);
    const disp = document.getElementById("adminWaDisplay");
    if (disp) disp.textContent = clean;
    alert(`✅ Nomor WhatsApp Bantuan berhasil disimpan: ${clean}`);
  }
}

// ==========================================
// 5. KATALOG 52 FITUR + AI AGENT
// ==========================================
const FEATURES_CATALOG = {
  pintar: {
    label: "🧠 1. AI Pintar & Agent",
    tier: "free",
    items: [
      { title: "0. AI Agent Otonom FREON", desc: "Agen cerdas yang merencanakan & mengeksekusi tugas multi-langkah secara mandiri.", mod: "agent", prompt: "Jalankan AI Agent untuk meriset topik berikut, melakukan perhitungan relevan, dan membuat laporan siap download:\n" },
      { title: "1. Video Call Naruto & Hinata", desc: "Panggilan video animasi interaktif dua arah dengan lip-sync suara.", action: "videocall" },
      { title: "2. Kirim Tugas via Video", desc: "Upload rekaman video tugas untuk dianalisis dan dikerjakan oleh AI.", action: "videotask" },
      { title: "3. AI Voice Assistant", desc: "Bicara langsung lewat mikrofon & dengarkan jawaban suara AI.", action: "voice" },
      { title: "4. AI Membaca Gambar", desc: "Upload foto/screenshot untuk dianalisis isi, teks, maupun objeknya.", action: "upload" },
      { title: "5. AI Membaca PDF & Word", desc: "Upload file .pdf atau .docx untuk diekstrak dan dibaca isinya.", action: "upload" },
      { title: "6. AI Menganalisis Dokumen", desc: "Audit isi kontrak, laporan, atau data teks panjang secara mendalam.", action: "upload" },
      { title: "7. AI Pencarian Internet", desc: "Riset fakta terbaru langsung dari sumber internet real-time.", mod: "research", prompt: "Riset informasi terkini tentang perkembangan teknologi AI tahun 2026" },
      { title: "8. AI Penerjemah Bahasa", desc: "Terjemahan natural multi-bahasa (Indonesia, Inggris, Jepang, Korea, Arab).", mod: "research", prompt: "Terjemahkan teks berikut ke Bahasa Inggris formal dan Bahasa Jepang: " },
      { title: "9. AI Merangkum Teks Panjang", desc: "Padatkan artikel, jurnal, atau dokumen panjang menjadi poin inti.", mod: "research", prompt: "Rangkum teks panjang berikut menjadi poin-poin penting:\n" },
      { title: "10. AI Menjawab Soal Pelajaran", desc: "Pembahasan matematika, fisika, kimia, dan bahasa langkah demi langkah.", mod: "research", prompt: "Jawab dan jelaskan langkah demi langkah soal pelajaran berikut: " },
      { title: "11. AI Mengingat Percakapan", desc: "Menyimpan fakta & preferensi kamu di Cloud Long-Term Memory.", mod: "general", prompt: "Ingat ya, nama saya dan preferensi saya adalah: " }
    ]
  },
  produktivitas: {
    label: "📊 2. Fitur Produktivitas",
    tier: "free",
    items: [
      { title: "1. AI Pembuat Word (Semua Font MS Word)", desc: "Buat dokumen .doc lengkap dengan pilihan 18+ font Microsoft Word.", mod: "office", prompt: "Buatkan dokumen Word (.doc) resmi menggunakan font Times New Roman tentang " },
      { title: "2. AI Pembuat PPT (.pptx Asli)", desc: "Buat presentasi 16:9 lengkap dengan desain slide & catatan pembicara.", mod: "office", prompt: "Buatkan presentasi PowerPoint (.pptx) 8 slide tentang Masa Depan Teknologi AI lengkap dengan catatan pembicara" },
      { title: "3. AI Pembuat Excel", desc: "Generate tabel keuangan/data & langsung download file .xls.", mod: "office", prompt: "Buatkan tabel anggaran bulanan lengkap dengan rumus total dan simpan ke file laporan_keuangan.xls" },
      { title: "4. AI Pembuat CV", desc: "Susun CV profesional ATS-friendly & ekspor ke file dokumen.", mod: "office", prompt: "Buatkan CV profesional modern untuk posisi Web Developer lengkap dengan file cv_profesional.doc" },
      { title: "5. AI Pembuat Surat Resmi", desc: "Surat lamaran kerja, surat izin, undangan, atau kontrak resmi.", mod: "office", prompt: "Buatkan surat resmi permohonan kerja sama bisnis dalam file surat_resmi.doc" },
      { title: "6. AI Pembuat Makalah", desc: "Struktur makalah akademik lengkap (Bab I–III + Daftar Pustaka) dalam file Word.", mod: "office", prompt: "Buatkan makalah akademik lengkap tentang Dampak Kecerdasan Buatan terhadap Pendidikan Modern dan simpan ke makalah.doc" },
      { title: "7. AI Pembuat Jadwal", desc: "Susun jadwal harian, jadwal belajar, atau jadwal kerja teratur.", mod: "finance", prompt: "Buatkan jadwal harian produktif dari jam 06.00 pagi sampai 22.00 malam" },
      { title: "8. AI Manajemen Waktu", desc: "Optimasi waktu dengan metode Pomodoro & Time-Blocking.", mod: "finance", prompt: "Buatkan strategi manajemen waktu harian menggunakan teknik Time-Blocking" },
      { title: "9. AI Pencatat Keuangan", desc: "Catat pemasukan, pengeluaran, tabungan & hitung saldo otomatis.", mod: "finance", prompt: "Catat keuangan saya: Pemasukan Rp 5.000.000, Pengeluaran makan Rp 1.200.000, kost Rp 1.000.000. Hitung sisa saldo & saran tabungan." },
      { title: "10. AI Pembuat To-Do List", desc: "Daftar checklist tugas harian terstruktur berdasarkan urgensi.", mod: "finance", prompt: "Buatkan to-do list harian yang rapi dengan kategori Prioritas Tinggi, Sedang, dan Rendah" }
    ]
  },
  kreatif: {
    label: "🎨 3. Fitur Kreatif",
    tier: "free",
    items: [
      { title: "1. AI Image Generator", desc: "Ubah teks menjadi gambar ilustrasi HD & digital art.", mod: "image", prompt: "Buatkan gambar kota futuristik cyberpunk malam hari dengan lampu neon biru dan hijau" },
      { title: "2. AI Logo Maker", desc: "Desain logo brand, tim esports, atau produk modern.", mod: "image", prompt: "Buatkan gambar desain logo minimalis modern berbentuk perisai cyber untuk brand teknologi" },
      { title: "3. AI Video Generator", desc: "Render klip video bergerak sinematik lengkap dengan tombol download.", mod: "video", prompt: "Buatkan video pesawat luar angkasa melaju melewati galaksi nebula bercahaya" },
      { title: "4. AI Pembuat Animasi", desc: "Buat animasi visual interaktif HTML5 Canvas / SVG bergerak.", mod: "coding", prompt: "Buatkan animasi partikel galaksi interaktif dalam satu file HTML lengkap siap Live Preview" },
      { title: "5. AI Pembuat Website", desc: "Bangun landing page modern lengkap dengan tombol Live Preview.", mod: "coding", prompt: "Buatkan website portofolio modern dark mode lengkap dalam satu file HTML/CSS/JS" },
      { title: "6. AI Coding Assistant", desc: "Tulis, jelaskan, dan optimasi kode berbagai bahasa pemrograman.", mod: "coding", prompt: "Bantu saya menulis kode bersih dan terstruktur untuk fitur: " },
      { title: "7. AI Pembuat Game HTML", desc: "Buat game seru yang langsung bisa dimainkan di Live Preview.", mod: "coding", prompt: "Buatkan game arcade tembak meteor interaktif dalam satu file HTML lengkap dengan skor" },
      { title: "8. AI Pembuat Musik Original", desc: "Komposisi melodi musik original dengan pemutar audio langsung di browser!", mod: "music", prompt: "Buatkan musik original bertema Cyber Chill Synthwave yang menenangkan" },
      { title: "9. AI Desain Poster", desc: "Buat konsep & visual poster acara, promo produk, atau film.", mod: "image", prompt: "Buatkan gambar poster konser musik elektronik futuristik dengan tipografi neon" },
      { title: "10. AI Pembuat Konten TikTok", desc: "Script hook viral, ide konten, caption & hashtag TikTok FYP.", mod: "video", prompt: "Buatkan script video TikTok 30 detik dengan hook viral tentang tips produktif pakai AI" }
    ]
  },
  eksklusif: {
    label: "💎 4. Fitur Eksklusif",
    tier: "exclusive",
    items: [
      { title: "1. AI Agent Tugas Bertahap", desc: "Agen otonom yang memecah tujuan besar & mengeksekusi alat berurutan.", mod: "agent", prompt: "[MODE AI AGENT BERTAHAP] Jalankan riset, buat perhitungan, dan susun laporan lengkap untuk topik: " },
      { title: "2. AI Research Mendalam", desc: "Investigasi topik komprehensif dengan analisis multi-sudut pandang.", mod: "research", prompt: "[DEEP RESEARCH] Lakukan analisis mendalam dan terstruktur mengenai: " },
      { title: "3. AI Belajar Preferensi User", desc: "Menyesuaikan gaya bahasa, format & kebiasaan kerja kamu otomatis.", mod: "general", prompt: "Pelajari dan simpan preferensi gaya kerja saya berikut ke memori permanen: " },
      { title: "4. AI Analisis Bisnis", desc: "Analisis SWOT, model bisnis BMC, proyeksi profit & risiko usaha.", mod: "finance", prompt: "[ANALISIS BISNIS] Buatkan analisis SWOT, Business Model Canvas, dan proyeksi keuangan untuk ide bisnis: " },
      { title: "5. AI Strategi Pemasaran", desc: "Funnel marketing, strategi iklan digital & kampanye pertumbuhan.", mod: "office", prompt: "[STRATEGI PEMASARAN] Susun strategi digital marketing 30 hari untuk meningkatkan penjualan produk: " },
      { title: "6. AI Simulasi Wawancara Kerja", desc: "Latihan interview HRD & user dengan evaluasi jawaban real-time.", mod: "research", prompt: "[SIMULASI INTERVIEW] Bertindaklah sebagai HRD profesional dan mulai simulasi wawancara kerja dengan saya untuk posisi: " },
      { title: "7. AI Career Planner", desc: "Peta jalan karier, skill yang wajib dipelajari & target jangka panjang.", mod: "office", prompt: "[CAREER PLANNER] Buatkan roadmap karier 1 tahun ke depan untuk bidang: " },
      { title: "8. AI Tutor Interaktif", desc: "Bimbingan belajar personal langkah demi langkah dengan latihan soal.", mod: "research", prompt: "[AI TUTOR] Ajari saya dari dasar sampai mahir dengan metode tanya-jawab interaktif tentang: " },
      { title: "9. AI Deteksi Kesalahan Kode", desc: "Temukan bug, celah keamanan, dan perbaiki kode secara otomatis.", mod: "coding", prompt: "[CODE DEBUGGER] Deteksi semua bug, error logika, dan perbaiki kode berikut:\n" },
      { title: "10. AI Analisis Data Otomatis", desc: "Ekstrak pola, statistik, anomali & insight dari dataset kamu.", mod: "finance", prompt: "[AUTO DATA ANALYST] Analisis statistik, tren, dan insight penting dari data berikut:\n" }
    ]
  },
  premium: {
    label: "👑 5. Fitur Premium",
    tier: "premium",
    items: [
      { title: "1. Multi AI Model", desc: "Akses bebas berpindah antar mesin FREON Hybrid, Flash & Sonic 2.1.", mod: "general", prompt: "Gunakan penalaran tingkat tinggi untuk menjawab pertanyaan berikut: " },
      { title: "2. Chat dengan Banyak AI Sekaligus", desc: "Jalankan 3 mesin AI bersamaan (Hybrid + Flash + Sonic) dalam 1 layar!", action: "multi_ai" },
      { title: "3. AI Workspace", desc: "Ruang kerja terpadu untuk menyusun proyek, dokumen & kode sekaligus.", mod: "coding", prompt: "[AI WORKSPACE] Bantu saya merancang struktur proyek aplikasi lengkap dari awal: " },
      { title: "4. Penyimpanan File Pribadi", desc: "Kelola & simpan catatan, draft kode, dan hasil export pribadi.", mod: "office", prompt: "Buatkan file arsip catatan pribadi saya dan siapkan link download-nya: " },
      { title: "5. Custom AI Personality", desc: "Ubah gaya bicara AI (Tegas, Santai, Profesor, CEO, atau Mentor).", action: "custom_persona" },
      { title: "6. AI Memory", desc: "Manajemen ingatan jangka panjang lintas sesi & lintas perangkat.", action: "memory" },
      { title: "7. AI Browser", desc: "Telusuri, rangkum, dan bandingkan informasi web secara otomatis.", mod: "research", prompt: "[AI BROWSER] Telusuri dan bandingkan informasi lengkap dari web tentang: " },
      { title: "8. AI Automation", desc: "Otomatisasi alur kerja berulang menjadi 1 perintah cepat.", mod: "coding", prompt: "[AI AUTOMATION] Buatkan skrip & alur otomatisasi kerja untuk tugas: " },
      { title: "9. AI Live Translation", desc: "Terjemahan dua arah secara instan untuk percakapan lintas bahasa.", mod: "research", prompt: "[LIVE TRANSLATION] Terjemahkan secara instan dan natural percakapan berikut: " },
      { title: "10. AI Dashboard", desc: "Ringkasan statistik sesi, memori & status paket akun.", action: "dashboard" }
    ]
  }
};

let customAIPersonality = "";

function hasTierAccess(tier) {
  if (!activeUser) return false;
  if (activeUser.role === "admin") return true;
  if (tier === "free") return true;
  if (tier === "exclusive") return !!activeUser.exclusiveUnlocked;
  if (tier === "premium") return !!activeUser.premiumUnlocked;
  return false;
}

function updateTierBadgesUI() {
  const exclLock = document.getElementById("sidebarExclLock");
  const premLock = document.getElementById("sidebarPremLock");
  if (exclLock) exclLock.textContent = hasTierAccess("exclusive") ? "✅" : "🔒";
  if (premLock) premLock.textContent = hasTierAccess("premium") ? "✅" : "🔒";
}

function openTierCategory(catKey) { closeMobileSidebar(); openFeaturesModal(catKey); }
function openFeaturesModal(defaultCat = "pintar") { closeMobileSidebar(); document.getElementById("featuresModalOverlay").classList.add("show"); switchFeatureTab(defaultCat); }
function closeFeaturesModal() { document.getElementById("featuresModalOverlay").classList.remove("show"); }

function switchFeatureTab(catKey) {
  const cat = FEATURES_CATALOG[catKey] || FEATURES_CATALOG.pintar;
  document.querySelectorAll(".cat-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.cat === catKey));
  const banner = document.getElementById("tierStatusBanner");
  const unlocked = hasTierAccess(cat.tier);

  if (cat.tier === "exclusive") {
    banner.className = `tier-banner show ${unlocked ? "unlocked" : "locked-excl"}`;
    banner.innerHTML = unlocked
      ? `<span>💎 <strong>Akses Eksklusif AKTIF!</strong> Semua 10 fitur eksklusif siap digunakan.</span>`
      : `<span>🔒 <strong>Paket Eksklusif Terkunci.</strong> Hubungi pengelola untuk mengaktifkan fitur Eksklusif.</span>
         <button type="button" class="tbl-btn excl-on" onclick="openLockPrompt('exclusive')">📩 Minta Aktifkan Eksklusif</button>`;
  } else if (cat.tier === "premium") {
    banner.className = `tier-banner show ${unlocked ? "unlocked" : "locked-prem"}`;
    banner.innerHTML = unlocked
      ? `<span>👑 <strong>Akses Premium AKTIF!</strong> Semua 10 fitur premium siap digunakan.</span>`
      : `<span>🔒 <strong>Paket Premium Terkunci.</strong> Hubungi pengelola untuk mengaktifkan fitur Premium.</span>
         <button type="button" class="tbl-btn prem-on" onclick="openLockPrompt('premium')">📩 Minta Aktifkan Premium</button>`;
  } else {
    banner.className = "tier-banner"; banner.innerHTML = "";
  }

  const grid = document.getElementById("featureCardsGrid");
  grid.innerHTML = cat.items.map((item, idx) => `
    <div class="feat-card ${unlocked ? "" : "is-locked"}" onclick='triggerCatalogFeature(${JSON.stringify(catKey)}, ${idx})'>
      <div class="feat-card-top">
        <span class="feat-card-title">${escapeHtml(item.title)}</span>
        <span style="font-size:11px;">${unlocked ? "▶️" : "🔒"}</span>
      </div>
      <div class="feat-card-desc">${escapeHtml(item.desc)}</div>
    </div>
  `).join("");
}

function triggerCatalogFeature(catKey, idx) {
  const cat = FEATURES_CATALOG[catKey];
  if (!cat) return;
  const item = cat.items[idx];
  if (!item) return;

  if (!hasTierAccess(cat.tier)) { openLockPrompt(cat.tier, item.title); return; }
  closeFeaturesModal();

  if (item.action === "videocall") { openAnimeVideoCall(); return; }
  if (item.action === "videotask") { triggerVideoTaskUpload(); return; }
  if (item.action === "voice") { toggleVoiceInput(); return; }
  if (item.action === "upload") { triggerUpload(); return; }
  if (item.action === "memory") { viewMemories(); return; }
  if (item.action === "multi_ai") {
    document.getElementById("modelSelect").value = "multi_council";
    onEngineChange();
    const inp = document.getElementById("userInput");
    inp.placeholder = "👑 Mode Multi-AI Aktif: Tanya 1 pertanyaan ke 3 model AI sekaligus...";
    inp.focus();
    return;
  }
  if (item.action === "custom_persona") {
    const p = prompt("Masukkan kepribadian AI kustom yang kamu inginkan:", customAIPersonality);
    if (p !== null) {
      customAIPersonality = p.trim();
      chatHistory[0] = buildSystemPrompt();
      alert(customAIPersonality ? `✅ Custom AI Personality aktif: "${customAIPersonality}"` : "Custom AI Personality direset ke default.");
    }
    return;
  }
  if (item.action === "dashboard") {
    const sessCount = Object.keys(sessions).length;
    alert(`📊 FREON AI DASHBOARD\n\n• Nama: ${activeUser?.fullName || activeUser?.username}\n• Username: ${activeUser?.username}\n• UID: ${activeUser?.uid || "-"}\n• Font Dokumen Aktif: ${selectedWordFont}\n• Paket Eksklusif: ${hasTierAccess("exclusive") ? "AKTIF ✅" : "Terkunci 🔒"}\n• Paket Premium: ${hasTierAccess("premium") ? "AKTIF ✅" : "Terkunci 🔒"}\n• Total Sesi Obrolan: ${sessCount}`);
    return;
  }

  if (item.mod) selectModule(item.mod, false);
  const inp = document.getElementById("userInput");
  inp.value = item.prompt || "";
  inp.focus();
}

function openLockPrompt(tier, featureName = "") {
  const isPrem = tier === "premium";
  document.getElementById("lockModalIcon").textContent = isPrem ? "👑" : "💎";
  document.getElementById("lockModalTitle").textContent = isPrem ? "🔒 Fitur Premium Terkunci" : "🔒 Fitur Eksklusif Terkunci";
  document.getElementById("lockModalHeading").textContent = featureName ? `"${featureName}" Memerlukan Akses ${isPrem ? "Premium" : "Eksklusif"}` : `Paket ${isPrem ? "Premium" : "Eksklusif"} Belum Aktif`;
  document.getElementById("lockModalDesc").textContent = `Akses Eksklusif dan Premium dikelola oleh Admin. Klik tombol di bawah untuk mengirim permintaan aktivasi paket ${isPrem ? "Premium" : "Eksklusif"}.`;
  const reqBtn = document.getElementById("btnRequestTierUnlock");
  reqBtn.textContent = `📩 Minta Admin Aktifkan ${isPrem ? "Premium" : "Eksklusif"}`;
  reqBtn.onclick = () => sendUnlockRequestToAdmin(tier);
  document.getElementById("lockModalOverlay").classList.add("show");
}

function closeLockModal() { document.getElementById("lockModalOverlay").classList.remove("show"); }

async function sendUnlockRequestToAdmin(tier) {
  if (!activeUser || activeUser.role !== "customer") return;
  try {
    const field = tier === "premium" ? { requestPremium: true } : { requestExclusive: true };
    await dbPatch(`customers/${activeUser.userKey}`, field);
    closeLockModal();
    alert(`✅ Permintaan aktivasi paket ${tier === "premium" ? "PREMIUM 👑" : "EKSKLUSIF 💎"} berhasil dikirim ke pengelola!`);
  } catch (e) { alert("Gagal mengirim permintaan: " + e.message); }
}

// ==========================================
// 6. AUTENTIKASI
// ==========================================
let currentAuthMode = "customer";
let activeUser = null;
let impersonatedFromAdmin = null;
let quotaSyncInterval = null;
let currentRegisterLiveCode = "";

async function loadLiveActivationCodeForRegister() {
  const codeTextEl = document.getElementById("registerLiveCodeText");
  if (!codeTextEl) return;
  codeTextEl.textContent = "Memuat...";
  try {
    await resolveFirebaseUrl();
    let code = await dbGet("config/activationCode");
    if (!code) { code = "FREON-2026"; await dbSet("config/activationCode", code); }
    currentRegisterLiveCode = String(code).toUpperCase();
    codeTextEl.textContent = currentRegisterLiveCode;
  } catch {
    currentRegisterLiveCode = "FREON-2026";
    codeTextEl.textContent = currentRegisterLiveCode;
  }
}

function fillActivationCodeToInput() {
  if (!currentRegisterLiveCode) return;
  const inp = document.getElementById("authActivationCode");
  if (inp) { inp.value = currentRegisterLiveCode; inp.focus(); }
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const card = document.getElementById("authCard");
  const badge = document.getElementById("authRoleBadge");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const fullNameGroup = document.getElementById("authFullNameGroup");
  const fullNameInput = document.getElementById("authFullName");
  const usernameGroup = document.getElementById("authUsernameGroup");
  const usernameInput = document.getElementById("authUsername");
  const userLabel = document.getElementById("authUserLabel");
  const submitBtn = document.getElementById("authSubmitBtn");
  const activationGroup = document.getElementById("authActivationGroup");
  const activationInput = document.getElementById("authActivationCode");
  const custToggle = document.getElementById("customerRegisterToggle");
  const adminToggle = document.getElementById("adminSwitchToggle");
  const errBox = document.getElementById("authErrorBox");

  errBox.style.display = "none";
  fullNameInput.value = "";
  usernameInput.value = "";
  document.getElementById("authPassword").value = "";
  activationInput.value = "";

  if (mode === "admin") {
    card.classList.add("admin-mode");
    badge.textContent = "FOUNDER & CO-FOUNDER PORTAL";
    title.innerHTML = `Login Pengelola<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Akses kontrol untuk 5 Founder Utama & Co-Founder";
    fullNameGroup.style.display = "none"; fullNameInput.required = false;
    usernameGroup.style.display = "block"; usernameInput.required = true;
    userLabel.textContent = "Username Founder / Co-Founder";
    submitBtn.textContent = "Masuk ke Control Panel";
    activationGroup.style.display = "none"; activationInput.required = false;
    custToggle.style.display = "none";
    adminToggle.innerHTML = `Bukan pengelola? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Kembali ke Login Customer</button>`;
  } else if (mode === "register") {
    card.classList.remove("admin-mode");
    badge.textContent = "PENDAFTARAN CUSTOMER";
    title.innerHTML = `Daftar Akun<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Isi Nama Lengkap, Password & Kode Aktivasi";
    fullNameGroup.style.display = "block"; fullNameInput.required = true;
    usernameGroup.style.display = "none"; usernameInput.required = false;
    submitBtn.textContent = "Aktivasi & Buat Akun Otomatis";
    activationGroup.style.display = "block"; activationInput.required = true;
    loadLiveActivationCodeForRegister();
    custToggle.style.display = "block";
    custToggle.innerHTML = `Sudah punya akun? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Masuk di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Founder / Co-Founder</button>`;
  } else {
    card.classList.remove("admin-mode");
    badge.textContent = "CUSTOMER PORTAL";
    title.innerHTML = `Masuk ke<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Gunakan Username atau UID akun customer Anda";
    fullNameGroup.style.display = "none"; fullNameInput.required = false;
    usernameGroup.style.display = "block"; usernameInput.required = true;
    userLabel.textContent = "Username / UID Customer";
    submitBtn.textContent = "Masuk sebagai Customer";
    activationGroup.style.display = "none"; activationInput.required = false;
    custToggle.style.display = "block";
    custToggle.innerHTML = `Belum punya akun customer? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('register')">Daftar di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Founder / Co-Founder</button>`;
  }
}

function showAuthError(msg) {
  const errBox = document.getElementById("authErrorBox");
  errBox.innerHTML = msg;
  errBox.style.display = "block";
}

document.getElementById("authForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const fullNameVal = document.getElementById("authFullName").value.trim();
  const unameInput = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value.trim();
  const submitBtn = document.getElementById("authSubmitBtn");

  submitBtn.disabled = true;
  const oldText = submitBtn.textContent;
  submitBtn.textContent = "Menghubungkan ke Cloud...";

  try {
    await resolveFirebaseUrl();

    if (currentAuthMode === "admin") {
      if (!unameInput || !pass) { showAuthError("Username dan password wajib diisi!"); return; }
      const userKey = unameInput.toLowerCase().replace(/[.#$/[\]]/g, "_");
      let adminData = await dbGet(`admins/${userKey}`);
      if (!adminData && userKey === "franky") {
        const allAdmins = await dbGet("admins");
        const hasFounder = allAdmins && Object.values(allAdmins).some(a => a && a.isFounder);
        if (!hasFounder) { await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN); adminData = DEFAULT_FOUNDER_ADMIN; }
      }

      if (adminData && adminData.password === pass) {
        await loginSuccess({
          fullName: adminData.username, username: adminData.username, userKey,
          role: "admin", isFounder: !!adminData.isFounder,
          isPrimaryFounder: !!adminData.isPrimaryFounder || userKey === "franky",
          exclusiveUnlocked: true, premiumUnlocked: true
        });
      } else {
        showAuthError("Username atau password Founder / Co-Founder salah!");
      }
      return;
    }

    if (currentAuthMode === "register") {
      if (!fullNameVal || !pass) { showAuthError("Nama Lengkap dan Password wajib diisi!"); return; }
      const inputCode = document.getElementById("authActivationCode").value.trim().toUpperCase();
      const activeCode = await dbGet("config/activationCode");

      if (!activeCode || inputCode !== String(activeCode).toUpperCase()) {
        await loadLiveActivationCodeForRegister();
        showAuthError("Kode Aktivasi salah atau sudah dipakai orang lain!");
        return;
      }

      let randomUsername = generateRandomCustomerUsername(fullNameVal);
      let userKey = randomUsername.toLowerCase();
      while (await dbGet(`customers/${userKey}`)) {
        randomUsername = generateRandomCustomerUsername(fullNameVal);
        userKey = randomUsername.toLowerCase();
      }
      const generatedUID = generateSystemUID();
      const startQuota = 20000;

      await dbSet(`customers/${userKey}`, {
        fullName: fullNameVal, username: randomUsername, uid: generatedUID, password: pass,
        quota: startQuota, status: "active", banReason: "", warningMessage: "",
        exclusiveUnlocked: false, premiumUnlocked: false
      });

      let nextCode = generateRandomCode();
      while (nextCode === activeCode) nextCode = generateRandomCode();
      await dbSet("config/activationCode", nextCode);

      alert(`✅ Pendaftaran Berhasil!\n\n• Nama Lengkap: ${fullNameVal}\n• Username Acak: ${randomUsername}\n• UID Otomatis: ${generatedUID}`);

      await loginSuccess({
        fullName: fullNameVal, username: randomUsername, uid: generatedUID, userKey,
        role: "customer", quota: startQuota, exclusiveUnlocked: false, premiumUnlocked: false
      });
      return;
    }

    if (!unameInput || !pass) { showAuthError("Username / UID dan password wajib diisi!"); return; }
    const cleanLookup = unameInput.toLowerCase().replace(/[.#$/[\]]/g, "_");
    let found = await dbGet(`customers/${cleanLookup}`);
    let foundKey = cleanLookup;

    if (!found) {
      const allCustomers = await dbGet("customers");
      if (allCustomers && typeof allCustomers === "object") {
        for (const [k, val] of Object.entries(allCustomers)) {
          if (val && (String(val.username).toLowerCase() === unameInput.toLowerCase() || String(val.uid).toLowerCase() === unameInput.toLowerCase())) {
            found = val; foundKey = k; break;
          }
        }
      }
    }

    if (!found || found.password !== pass) { showAuthError("Username / UID atau password Customer salah!"); return; }
    if (found.status === "suspended") {
      const reason = found.banReason ? `<br><strong>Alasan:</strong> ${escapeHtml(found.banReason)}` : "";
      showAuthError(`🚫 Akun Anda telah di-BANNED oleh Pengelola.${reason}`);
      return;
    }

    await loginSuccess({
      fullName: found.fullName || found.username, username: found.username, uid: found.uid || "-",
      userKey: foundKey, role: "customer", quota: Number(found.quota || 0),
      exclusiveUnlocked: !!found.exclusiveUnlocked, premiumUnlocked: !!found.premiumUnlocked,
      warningMessage: found.warningMessage || ""
    });
  } catch {
    showAuthError("Gagal koneksi ke Firebase! Pastikan koneksi internet aktif.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
});

async function loginSuccess(userObj) {
  activeUser = userObj;
  sessionStorage.setItem("freon_active_session", JSON.stringify(userObj));
  document.getElementById("authOverlay").classList.add("hidden");
  applyUserUI();
  await syncFounderBroadcast();
  await initWorkspace();
  startLiveQuotaSync();
  if (userObj.role === "customer" && userObj.warningMessage) showWarningPopup(userObj.warningMessage);
}

function logoutUser() {
  activeUser = null;
  impersonatedFromAdmin = null;
  document.getElementById("impersonateBanner").style.display = "none";
  if (quotaSyncInterval) clearInterval(quotaSyncInterval);
  sessionStorage.removeItem("freon_active_session");
  closeMobileSidebar();
  switchAuthMode("customer");
  document.getElementById("authOverlay").classList.remove("hidden");
}

function applyUserUI() {
  if (!activeUser) return;
  const avatar = document.getElementById("sidebarUserAvatar");
  const nameEl = document.getElementById("sidebarUserName");
  const roleEl = document.getElementById("sidebarUserRole");
  const adminTopBtn = document.getElementById("adminPanelTopBtn");
  const founderTrainerBtn = document.getElementById("founderTrainerTopBtn");
  const quotaStrip = document.getElementById("adminOnlyQuotaStrip");

  const displayName = activeUser.fullName || activeUser.username;
  nameEl.textContent = displayName;
  avatar.textContent = displayName.charAt(0).toUpperCase();

  // HANYA 5 FOUNDER UTAMA YANG BISA MELATIH AI
  if (founderTrainerBtn) {
    founderTrainerBtn.style.display = isCurrentUserFounder() ? "inline-flex" : "none";
  }

  if (activeUser.role === "admin" && !impersonatedFromAdmin) {
    avatar.classList.add("admin-avatar");
    roleEl.textContent = activeUser.isFounder ? "👑 Founder Utama" : "🤝 Co-Founder";
    roleEl.classList.add("admin-tag");
    adminTopBtn.style.display = "inline-flex";
    quotaStrip.style.display = "flex";
    document.getElementById("sidebarTokenDisplay").textContent = "∞ Unlimited";
  } else {
    avatar.classList.remove("admin-avatar");
    roleEl.textContent = `${activeUser.username} • ${activeUser.uid || "Customer"}`;
    roleEl.classList.remove("admin-tag");
    adminTopBtn.style.display = impersonatedFromAdmin ? "inline-flex" : "none";
    quotaStrip.style.display = "none";
  }
  updateTierBadgesUI();
}

function showWarningPopup(msg) {
  if (!msg) return;
  document.getElementById("warningMessageContent").innerHTML = escapeHtml(msg).replace(/\n/g, "<br>");
  document.getElementById("warningModalOverlay").classList.add("show");
}

async function acknowledgeAdminWarning() {
  document.getElementById("warningModalOverlay").classList.remove("show");
  if (activeUser && activeUser.role === "customer" && !impersonatedFromAdmin) {
    activeUser.warningMessage = "";
    try { await dbPatch(`customers/${activeUser.userKey}`, { warningMessage: "" }); } catch {}
  }
}

function startLiveQuotaSync() {
  if (quotaSyncInterval) clearInterval(quotaSyncInterval);
  if (!activeUser) return;

  quotaSyncInterval = setInterval(async () => {
    try {
      await syncFounderBroadcast();

      if (activeUser.role === "customer" && !impersonatedFromAdmin) {
        const cust = await dbGet(`customers/${activeUser.userKey}`);
        if (cust) {
          if (cust.status === "suspended") {
            const reason = cust.banReason ? `\nAlasan: ${cust.banReason}` : "";
            alert(`🚫 Akun Anda telah di-BANNED oleh Pengelola.${reason}`);
            logoutUser();
            return;
          }
          if (cust.warningMessage && cust.warningMessage !== activeUser.warningMessage) {
            activeUser.warningMessage = cust.warningMessage;
            showWarningPopup(cust.warningMessage);
          }
          activeUser.quota = Number(cust.quota || 0);
          activeUser.exclusiveUnlocked = !!cust.exclusiveUnlocked;
          activeUser.premiumUnlocked = !!cust.premiumUnlocked;
          sessionStorage.setItem("freon_active_session", JSON.stringify(activeUser));
          updateTierBadgesUI();
        }
      }
      if (currentHistoryTab === "global") await renderGlobalSearchHistory();
    } catch {}
  }, 4500);
}

async function deductCustomerQuotaCloud(tokensUsed) {
  if (!activeUser || activeUser.role !== "customer" || impersonatedFromAdmin) return;
  try {
    const cust = await dbGet(`customers/${activeUser.userKey}`);
    const currentQuota = cust ? Number(cust.quota || 0) : Number(activeUser.quota || 0);
    const updatedQuota = Math.max(0, currentQuota - tokensUsed);
    await dbPatch(`customers/${activeUser.userKey}`, { quota: updatedQuota });
    activeUser.quota = updatedQuota;
    sessionStorage.setItem("freon_active_session", JSON.stringify(activeUser));
  } catch {}
}

// ==========================================
// 7. CONTROL PANEL
// ==========================================
let currentCloudCode = "";

function isCurrentUserFounder() {
  return activeUser && activeUser.role === "admin" && !!activeUser.isFounder && !impersonatedFromAdmin;
}

async function openAdminModal() {
  if (activeUser?.role !== "admin" && !impersonatedFromAdmin) return;
  closeMobileSidebar();
  document.getElementById("adminModalOverlay").classList.add("show");
  await refreshAdminCloudData();
}

function closeAdminModal() { document.getElementById("adminModalOverlay").classList.remove("show"); }
document.getElementById("btnCloseAdminModal").addEventListener("click", closeAdminModal);

async function refreshAdminCloudData() {
  const displayCode = document.getElementById("adminActivationCodeDisplay");
  const adminTbody = document.getElementById("adminTableBody");
  const custTbody = document.getElementById("customerTableBody");
  const btnSetWa = document.getElementById("btnSetWaFounderOnly");
  const waLockNote = document.getElementById("waLockNote");
  const tierSelect = document.getElementById("newAdminTierSelect");

  displayCode.textContent = "Memuat...";
  adminTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Memuat data pengelola...</td></tr>`;
  custTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#94a3b8;">Mengambil data dari Cloud...</td></tr>`;

  const canManageFounderAndWa = isCurrentUserFounder();
  if (btnSetWa) btnSetWa.style.display = canManageFounderAndWa ? "inline-block" : "none";
  if (waLockNote) waLockNote.textContent = canManageFounderAndWa ? "(Akses Founder Aktif)" : "(Hanya 5 Founder Utama yang bisa ubah WA)";

  try {
    const bc = await dbGet("config/founderBroadcast");
    if (bc) {
      document.getElementById("broadcastMsgInput").value = bc.message || "";
      document.getElementById("broadcastUrlInput").value = bc.url || "";
    }

    const code = await dbGet("config/activationCode");
    currentCloudCode = code || "FREON-2026";
    displayCode.textContent = currentCloudCode;

    const waNum = await dbGet("config/whatsappNumber");
    if (waNum) adminWhatsAppNumber = normalizeWaNumber(waNum);
    document.getElementById("adminWaDisplay").textContent = adminWhatsAppNumber;

    const adminsObj = (await dbGet("admins")) || { franky: DEFAULT_FOUNDER_ADMIN };
    const founderCount = Object.values(adminsObj).filter(a => a && a.isFounder).length;
    const slotBadge = document.getElementById("founderSlotBadge");
    if (slotBadge) slotBadge.textContent = `Slot Founder Utama: ${founderCount} / ${MAX_PRIMARY_FOUNDERS}`;

    if (tierSelect) {
      const founderOpt = tierSelect.querySelector('option[value="founder"]');
      if (founderOpt) {
        founderOpt.disabled = !canManageFounderAndWa || founderCount >= MAX_PRIMARY_FOUNDERS;
        founderOpt.textContent = founderCount >= MAX_PRIMARY_FOUNDERS ? "👑 Founder Utama (Penuh 5/5)" : "👑 Founder Utama (Maks 5)";
      }
      if (!canManageFounderAndWa || founderCount >= MAX_PRIMARY_FOUNDERS) tierSelect.value = "cofounder";
    }

    renderAdminTable(adminsObj, founderCount);
    const customersObj = await dbGet("customers");
    renderCustomerTable(customersObj || {});
  } catch (err) {
    alert("Gagal memuat data: " + err.message);
  }
}

async function resetAllCustomerTiers() {
  if (!confirm("Reset status Eksklusif & Premium semua akun customer menjadi TERKUNCI (OFF)?")) return;
  const customers = await dbGet("customers");
  if (customers && typeof customers === "object") {
    for (const key of Object.keys(customers)) {
      if (customers[key]) {
        await dbPatch(`customers/${key}`, { exclusiveUnlocked: false, premiumUnlocked: false, requestExclusive: false, requestPremium: false });
      }
    }
  }
  await refreshAdminCloudData();
  alert("🔄 Semua paket Eksklusif & Premium customer berhasil di-reset!");
}

function renderAdminTable(adminsObj, founderCount) {
  const tbody = document.getElementById("adminTableBody");
  const keys = Object.keys(adminsObj);
  const viewerIsFounder = isCurrentUserFounder();
  tbody.innerHTML = "";

  keys.forEach((key) => {
    const adm = adminsObj[key];
    if (!adm) return;
    const isFounder = !!adm.isFounder;
    const isRootFounder = !!adm.isPrimaryFounder || key === "franky";
    const canEditThisRow = viewerIsFounder || (activeUser && activeUser.userKey === key);

    const roleBadge = isFounder
      ? `<span class="status-badge" style="background:rgba(245,158,11,0.18);color:#fcd34d;border:1px solid rgba(245,158,11,0.4);">👑 FOUNDER UTAMA</span>`
      : `<span class="status-badge" style="background:rgba(56,189,248,0.16);color:#7dd3fc;border:1px solid rgba(56,189,248,0.35);">🤝 CO-FOUNDER</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(adm.username)}</strong></td>
      <td style="font-family:'JetBrains Mono',monospace;color:#fcd34d;">${canEditThisRow ? escapeHtml(adm.password) : "••••••"}</td>
      <td>${roleBadge}</td>
      <td>
        <div class="tbl-actions">
          ${canEditThisRow ? `<button type="button" class="tbl-btn" onclick='adminRenameUsername(${JSON.stringify(key)}, ${JSON.stringify(adm.username)}, ${isFounder})'>✏️ Ubah User</button>` : ""}
          ${canEditThisRow ? `<button type="button" class="tbl-btn" onclick='adminChangeOwnOrMemberPass(${JSON.stringify(key)}, ${JSON.stringify(adm.username)}, ${JSON.stringify(adm.password)})'>🔑 Pass</button>` : ""}
          ${viewerIsFounder && !isFounder && founderCount < MAX_PRIMARY_FOUNDERS ? `<button type="button" class="tbl-btn" style="color:#fcd34d;" onclick='promoteToFounder(${JSON.stringify(key)}, ${JSON.stringify(adm.username)})'>⬆️ Jadikan Founder</button>` : ""}
          ${viewerIsFounder && isFounder && !isRootFounder ? `<button type="button" class="tbl-btn" style="color:#7dd3fc;" onclick='demoteToCoFounder(${JSON.stringify(key)}, ${JSON.stringify(adm.username)})'>⬇️ Turunkan Co-Founder</button>` : ""}
          ${viewerIsFounder && !isRootFounder ? `<button type="button" class="tbl-btn danger" onclick='adminDeleteMember(${JSON.stringify(key)}, ${JSON.stringify(adm.username)})'>Hapus</button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function promoteToFounder(adminKey, username) {
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat mengubah jabatan.");
  const adminsObj = (await dbGet("admins")) || {};
  if (Object.values(adminsObj).filter(a => a && a.isFounder).length >= MAX_PRIMARY_FOUNDERS) return alert(`Slot Founder Utama sudah penuh (${MAX_PRIMARY_FOUNDERS}/${MAX_PRIMARY_FOUNDERS})!`);
  await dbPatch(`admins/${adminKey}`, { isFounder: true });
  await refreshAdminCloudData();
}

async function demoteToCoFounder(adminKey, username) {
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat mengubah jabatan.");
  await dbPatch(`admins/${adminKey}`, { isFounder: false });
  await refreshAdminCloudData();
}

async function adminRenameUsername(oldKey, oldUsername, isFounder) {
  const newUsername = prompt(`Masukkan username baru untuk "${oldUsername}":`, oldUsername);
  if (!newUsername || !newUsername.trim() || newUsername.trim() === oldUsername) return;
  const cleanName = newUsername.trim();
  const newKey = cleanName.toLowerCase().replace(/[.#$/[\]]/g, "_");
  if (newKey !== oldKey) {
    if ((await dbGet(`admins/${newKey}`)) || (await dbGet(`customers/${newKey}`))) return alert("Username tersebut sudah dipakai!");
  }
  const currentData = await dbGet(`admins/${oldKey}`);
  if (!currentData) return;
  await dbSet(`admins/${newKey}`, { ...currentData, username: cleanName, isFounder: !!isFounder });
  if (newKey !== oldKey) await dbDelete(`admins/${oldKey}`);
  if (activeUser && activeUser.userKey === oldKey) {
    activeUser.username = cleanName; activeUser.fullName = cleanName; activeUser.userKey = newKey;
    sessionStorage.setItem("freon_active_session", JSON.stringify(activeUser));
    applyUserUI();
  }
  await refreshAdminCloudData();
}

document.getElementById("addAdminForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const u = document.getElementById("newAdminUser").value.trim();
  const p = document.getElementById("newAdminPass").value.trim();
  const requestedTier = document.getElementById("newAdminTierSelect").value;
  const adminKey = u.toLowerCase().replace(/[.#$/[\]]/g, "_");
  if (!u || !p) return;
  if ((await dbGet(`admins/${adminKey}`)) || (await dbGet(`customers/${adminKey}`))) return alert("Username sudah terpakai!");
  const adminsObj = (await dbGet("admins")) || {};
  const founderCount = Object.values(adminsObj).filter(a => a && a.isFounder).length;
  const makeFounder = requestedTier === "founder" && isCurrentUserFounder() && founderCount < MAX_PRIMARY_FOUNDERS;
  await dbSet(`admins/${adminKey}`, { username: u, password: p, isFounder: makeFounder });
  document.getElementById("newAdminUser").value = ""; document.getElementById("newAdminPass").value = "";
  await refreshAdminCloudData();
});

async function adminChangeOwnOrMemberPass(adminKey, username, currentPass) {
  const val = prompt(`Masukkan password baru untuk "${username}":`, currentPass);
  if (val && val.trim()) { await dbPatch(`admins/${adminKey}`, { password: val.trim() }); await refreshAdminCloudData(); }
}

async function adminDeleteMember(adminKey, username) {
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat menghapus akun pengelola.");
  if (confirm(`Yakin ingin menghapus akun pengelola "${username}"?`)) { await dbDelete(`admins/${adminKey}`); await refreshAdminCloudData(); }
}

function copyActivationCode() { if (currentCloudCode) { navigator.clipboard.writeText(currentCloudCode); alert(`Kode Aktivasi "${currentCloudCode}" disalin!`); } }
async function regenerateNewActivationCode() { const next = generateRandomCode(); await dbSet("config/activationCode", next); currentCloudCode = next; document.getElementById("adminActivationCodeDisplay").textContent = next; }
async function changeActivationCodeManual() { const next = prompt("Masukkan Kode Aktivasi custom:", currentCloudCode); if (next && next.trim()) { const clean = next.trim().toUpperCase(); await dbSet("config/activationCode", clean); currentCloudCode = clean; document.getElementById("adminActivationCodeDisplay").textContent = clean; } }

function renderCustomerTable(customersObj) {
  const tbody = document.getElementById("customerTableBody");
  const keys = Object.keys(customersObj);
  tbody.innerHTML = "";
  if (keys.length === 0) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;">Belum ada akun customer.</td></tr>`; return; }

  keys.forEach((key) => {
    const c = customersObj[key];
    if (!c) return;
    const isExcl = !!c.exclusiveUnlocked;
    const isPrem = !!c.premiumUnlocked;
    const reqExcl = !!c.requestExclusive && !isExcl;
    const reqPrem = !!c.requestPremium && !isPrem;
    const isBanned = c.status === "suspended";
    const fullName = c.fullName || c.username;
    const uidVal = c.uid || "UID-AUTO";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(fullName)}</strong>${c.banReason && isBanned ? `<div style="font-size:10px;color:#f87171;">Alasan: ${escapeHtml(c.banReason)}</div>` : ""}</td>
      <td style="font-family:'JetBrains Mono',monospace;"><div style="color:#38bdf8;font-weight:700;">@${escapeHtml(c.username)}</div><div style="font-size:10.5px;color:#94a3b8;">${escapeHtml(uidVal)}</div></td>
      <td style="font-family:'JetBrains Mono',monospace;color:#94a3b8;">${escapeHtml(c.password)}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:#34d399;font-weight:700;">${Number(c.quota).toLocaleString("id-ID")}</td>
      <td><button type="button" class="tbl-btn ${isExcl ? 'excl-on' : ''}" onclick='adminToggleExclusive(${JSON.stringify(key)}, ${isExcl})'>${isExcl ? '💎 AKTIF' : (reqExcl ? '📩 MINTA AKTIF' : '🔒 OFF')}</button></td>
      <td><button type="button" class="tbl-btn ${isPrem ? 'prem-on' : ''}" onclick='adminTogglePremium(${JSON.stringify(key)}, ${isPrem})'>${isPrem ? '👑 AKTIF' : (reqPrem ? '📩 MINTA AKTIF' : '🔒 OFF')}</button></td>
      <td><span class="status-badge ${!isBanned ? 'status-active' : 'status-suspended'}">${!isBanned ? 'AKTIF' : 'BANNED'}</span></td>
      <td>
        <div class="tbl-actions">
          <button type="button" class="tbl-btn" style="background:rgba(56,189,248,0.2);color:#7dd3fc;" onclick='adminImpersonateCustomer(${JSON.stringify(key)})'>👁️ Buka Akun</button>
          <button type="button" class="tbl-btn" style="color:#e9d5ff;" onclick='adminResetCustomerTiers(${JSON.stringify(key)}, ${JSON.stringify(fullName)})'>🔄 Reset Paket</button>
          <button type="button" class="tbl-btn" style="color:#fcd34d;" onclick='adminSendWarningMessage(${JSON.stringify(key)}, ${JSON.stringify(fullName)})'>⚠️ Peringatan</button>
          <button type="button" class="tbl-btn ${!isBanned ? 'danger' : ''}" onclick='adminToggleBanCustomer(${JSON.stringify(key)}, ${JSON.stringify(fullName)}, ${isBanned})'>${!isBanned ? '🚫 Banned' : '✅ Buka Ban'}</button>
          <button type="button" class="tbl-btn" style="color:#34d399;" onclick='adminAddQuota(${JSON.stringify(key)}, ${JSON.stringify(fullName)}, ${Number(c.quota)})'>+ Token</button>
          <button type="button" class="tbl-btn" style="color:#fbbf24;" onclick='adminDeductQuota(${JSON.stringify(key)}, ${JSON.stringify(fullName)}, ${Number(c.quota)})'>- Token</button>
          <button type="button" class="tbl-btn" onclick='adminEditPass(${JSON.stringify(key)}, ${JSON.stringify(fullName)}, ${JSON.stringify(c.password)})'>Pass</button>
          <button type="button" class="tbl-btn danger" onclick='adminDeleteCust(${JSON.stringify(key)}, ${JSON.stringify(fullName)})'>Hapus</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function adminToggleExclusive(userKey, currentState) { await dbPatch(`customers/${userKey}`, { exclusiveUnlocked: !currentState, requestExclusive: false }); await refreshAdminCloudData(); }
async function adminTogglePremium(userKey, currentState) { await dbPatch(`customers/${userKey}`, { premiumUnlocked: !currentState, requestPremium: false }); await refreshAdminCloudData(); }
async function adminResetCustomerTiers(userKey, username) {
  if (!confirm(`Reset akses Eksklusif & Premium untuk "${username}"?`)) return;
  await dbPatch(`customers/${userKey}`, { exclusiveUnlocked: false, premiumUnlocked: false, requestExclusive: false, requestPremium: false });
  await refreshAdminCloudData();
}

async function adminToggleBanCustomer(userKey, username, isCurrentlyBanned) {
  if (!isCurrentlyBanned) {
    const reason = prompt(`Masukkan alasan BANNED untuk "${username}":`, "Melanggar ketentuan penggunaan FREON AI");
    if (reason === null) return;
    await dbPatch(`customers/${userKey}`, { status: "suspended", banReason: reason.trim() || "Melanggar aturan sistem" });
  } else {
    if (!confirm(`Cabut status BANNED "${username}"?`)) return;
    await dbPatch(`customers/${userKey}`, { status: "active", banReason: "" });
  }
  await refreshAdminCloudData();
}

async function adminSendWarningMessage(userKey, username) {
  const msg = prompt(`Tulis pesan peringatan pribadi untuk "${username}":`, "Peringatan: Harap gunakan layanan FREON AI sesuai ketentuan.");
  if (msg && msg.trim()) { await dbPatch(`customers/${userKey}`, { warningMessage: msg.trim() }); alert(`⚠️ Peringatan dikirim ke "${username}"!`); }
}

async function adminImpersonateCustomer(userKey) {
  const cust = await dbGet(`customers/${userKey}`);
  if (!cust) return alert("Akun customer tidak ditemukan.");
  if (!impersonatedFromAdmin) impersonatedFromAdmin = { ...activeUser };
  activeUser = {
    fullName: cust.fullName || cust.username, username: cust.username, uid: cust.uid || "-",
    userKey, role: "customer", quota: Number(cust.quota || 0),
    exclusiveUnlocked: !!cust.exclusiveUnlocked, premiumUnlocked: !!cust.premiumUnlocked
  };
  closeAdminModal();
  document.getElementById("impersonateTargetName").textContent = `${activeUser.fullName} (${activeUser.username})`;
  document.getElementById("impersonateBanner").style.display = "flex";
  applyUserUI();
  await initWorkspace();
}

async function exitImpersonateCustomer() {
  if (!impersonatedFromAdmin) return;
  activeUser = { ...impersonatedFromAdmin };
  impersonatedFromAdmin = null;
  document.getElementById("impersonateBanner").style.display = "none";
  applyUserUI();
  await initWorkspace();
}

document.getElementById("addCustomerForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const fullName = document.getElementById("newCustFullName").value.trim();
  const p = document.getElementById("newCustPass").value.trim();
  const q = parseInt(document.getElementById("newCustQuota").value, 10) || 0;
  if (!fullName || !p) return;

  let randomUsername = generateRandomCustomerUsername(fullName);
  let userKey = randomUsername.toLowerCase();
  while (await dbGet(`customers/${userKey}`)) { randomUsername = generateRandomCustomerUsername(fullName); userKey = randomUsername.toLowerCase(); }
  const generatedUID = generateSystemUID();

  await dbSet(`customers/${userKey}`, {
    fullName, username: randomUsername, uid: generatedUID, password: p, quota: Math.max(0, q),
    status: "active", banReason: "", warningMessage: "", exclusiveUnlocked: false, premiumUnlocked: false
  });
  document.getElementById("newCustFullName").value = ""; document.getElementById("newCustPass").value = "";
  await refreshAdminCloudData();
  alert(`✅ Akun Customer Dibuat!\n• Username Acak: ${randomUsername}\n• UID: ${generatedUID}`);
});

async function adminAddQuota(userKey, username, currentQuota) {
  const val = prompt(`Tambah berapa token untuk "${username}"?`, "5000");
  if (val !== null && !isNaN(parseInt(val, 10))) { await dbPatch(`customers/${userKey}`, { quota: currentQuota + Math.max(0, parseInt(val, 10)) }); await refreshAdminCloudData(); }
}
async function adminDeductQuota(userKey, username, currentQuota) {
  const val = prompt(`Kurangi berapa token dari "${username}"?`, "1000");
  if (val !== null && !isNaN(parseInt(val, 10))) { await dbPatch(`customers/${userKey}`, { quota: Math.max(0, currentQuota - Math.max(0, parseInt(val, 10))) }); await refreshAdminCloudData(); }
}
async function adminEditPass(userKey, username, currentPass) {
  const val = prompt(`Masukkan password baru untuk "${username}":`, currentPass);
  if (val && val.trim()) { await dbPatch(`customers/${userKey}`, { password: val.trim() }); await refreshAdminCloudData(); }
}
async function adminDeleteCust(userKey, username) {
  if (confirm(`Yakin ingin menghapus akun customer "${username}"?`)) { await dbDelete(`customers/${userKey}`); await dbDelete(`chats/${userKey}`); await refreshAdminCloudData(); }
}

// ==========================================
// 8. KONFIGURASI ENGINE AI & MULTI-AI
// ==========================================
const FREON_ENGINES = {
  hybrid_1_1: {
    label: "FREON 1.1 Hybrid",
    apiModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "deepseek/deepseek-v4-flash",
    temperature: 0.6,
    persona: "Kamu berjalan di mesin FREON 1.1 Hybrid: seimbang antara analisis logika tajam, kejelasan struktur, dan kecepatan eksekusi tools otonom."
  },
  flash_1_1: {
    label: "FREON 1.1 Flash",
    apiModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "deepseek/deepseek-v4-pro",
    temperature: 0.4,
    persona: "Kamu berjalan di mesin FREON 1.1 Flash: berikan jawaban super cepat, ringkas, padat, langsung ke inti tanpa basa-basi panjang."
  },
  sonic_2_1: {
    label: "FREON 2.1 Sonic",
    apiModel: "openai/gpt-6-luna",
    fallbackModel: "deepseek/deepseek-v4-pro",
    temperature: 0.75,
    persona: "Kamu berjalan di mesin flagship tertinggi FREON 2.1 Sonic: berikan penalaran mendalam, kreativitas tinggi, dan kode arsitektur terbaik."
  },
  multi_council: {
    label: "Multi-AI (3 Model)",
    apiModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "deepseek/deepseek-v4-flash",
    temperature: 0.65,
    isMulti: true,
    persona: "Kamu adalah sistem Multi-AI Council FREON."
  }
};

function getCurrentEngine() { return FREON_ENGINES[document.getElementById("modelSelect").value] || FREON_ENGINES.hybrid_1_1; }

function onEngineChange() {
  const select = document.getElementById("modelSelect");
  if (select.value === "multi_council" && !hasTierAccess("premium")) {
    select.value = "hybrid_1_1";
    openLockPrompt("premium", "Chat dengan Banyak AI Sekaligus (Multi-AI)");
    return;
  }
  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
}

// ==========================================
// 9. MODUL STUDIO
// ==========================================
const MODULES_CONFIG = {
  general: {
    badge: "✦ FREON Chat",
    title: "Apa yang bisa FREON bantu?",
    desc: "Gabungan estetika Claude, kecepatan ChatGPT, pembuat dokumen Word semua font MS Word, PPTX asli & Video Call Naruto-Hinata.",
    placeholder: "Tanya apa saja, buat dokumen Word semua font, atau video call...",
    instruction: "Jawab cerdas, tajam, terstruktur, dan gunakan tools jika diperlukan.",
    starters: [
      { title: "📝 Dokumen Word (Semua Font MS Word)", sub: "Makalah, surat & laporan .doc rapi", mod: "office", prompt: "Buatkan dokumen Word (.doc) makalah lengkap dengan font " + selectedWordFont + " tentang Hukum Perjanjian di Indonesia" },
      { title: "📹 Video Call Naruto & Hinata", sub: "Obrolan suara dua arah otomatis + lip-sync", action: "videocall" },
      { title: "📊 Buat Presentasi .PPTX Asli", sub: "Slide 16:9 lengkap dengan catatan pembicara", mod: "office", prompt: "Buatkan presentasi PowerPoint (.pptx) 8 slide tentang Proklamasi Kemerdekaan Indonesia lengkap dengan catatan pembicara" },
      { title: "✨ Katalog 52 Fitur & AI Agent", sub: "Jelajahi seluruh kemampuan FREON AI", action: "catalog" }
    ]
  },
  agent: {
    badge: "🤖 AI Agent Otonom",
    title: "FREON Autonomous AI Agent",
    desc: "Agen otonom yang memecah tujuan besar menjadi sub-tugas berurutan, mencari data internet, menghitung angka, hingga membuat file output.",
    placeholder: "Berikan misi/tugas kompleks untuk dieksekusi bertahap oleh AI Agent...",
    instruction: "Kamu adalah FREON AUTONOMOUS AI AGENT. Pecah permintaan user menjadi rencana langkah demi langkah dan panggil tools berurutan sampai tuntas.",
    starters: [
      { title: "📊 Agent Riset & Laporan Word", sub: "Riset topik + hitung data + export .doc", prompt: "Jalankan AI Agent: Riset perkembangan energi surya di Indonesia, hitung estimasi penghematan listrik 30%, dan buatkan file laporan_energi.doc" },
      { title: "💼 Agent Rencana Bisnis", sub: "Analisis pasar + kalkulasi modal + Excel", prompt: "Jalankan AI Agent: Susun rencana bisnis kedai kopi modern dengan modal Rp 15 juta, hitung proyeksi balik modal, dan ekspor ke rencana_bisnis.xls" },
      { title: "💻 Agent Pembuat Aplikasi", sub: "Rancang arsitektur + tulis kode siap jalan", prompt: "Jalankan AI Agent: Buatkan aplikasi web kalkulator investasi majemuk interaktif dalam satu file HTML lengkap" },
      { title: "🎓 Agent Tutor & Latihan", sub: "Jelaskan konsep + buat kuis + koreksi", prompt: "Jalankan AI Agent: Ajari saya konsep dasar algoritma pemrograman lalu berikan 3 soal latihan" }
    ]
  },
  image: {
    badge: "🎨 Image, Logo & Poster",
    title: "FREON Visual Design Studio",
    desc: "Buat gambar HD, logo brand, desain poster, hingga ilustrasi digital dengan standar visual terlatih.",
    placeholder: "Deskripsikan gambar, logo, atau poster yang ingin dibuat...",
    instruction: "Kamu berada di mode VISUAL DESIGN STUDIO. Setiap permintaan gambar/logo/poster WAJIB memanggil tool 'buatGambar'.",
    starters: [
      { title: "🛡️ AI Logo Maker", sub: "Logo brand & esports profesional", prompt: "Buatkan gambar desain logo minimalis futuristik dengan warna cyan dan emas" },
      { title: "🖼️ AI Desain Poster", sub: "Poster acara, produk, atau film", prompt: "Buatkan gambar poster event teknologi AI masa depan dengan gaya modern" },
      { title: "🐉 Ilustrasi Digital HD", sub: "Seni visual detail tinggi", prompt: "Buatkan gambar kota futuristik cyberpunk malam hari dengan lampu neon" },
      { title: "📦 Desain Kemasan / Produk", sub: "Mockup visual produk modern", prompt: "Buatkan gambar konsep botol minuman energi futuristik bercahaya" }
    ]
  },
  video: {
    badge: "🎬 Video & Tugas Video",
    title: "FREON Video & Tugas Video Studio",
    desc: "Kirim tugas menggunakan video, render klip video AI, animasi bergerak, dan script konten TikTok.",
    placeholder: "Upload video tugas (🎬) atau deskripsikan video yang ingin dibuat...",
    instruction: "Kamu berada di mode VIDEO STUDIO. Gunakan tool 'buatVideo' jika diminta membuat video.",
    starters: [
      { title: "🎬 Kirim Tugas Pakai Video", sub: "Upload video soal/tugas untuk dianalisis AI", action: "videotask" },
      { title: "🌌 AI Video Generator", sub: "Render klip video luar angkasa", prompt: "Buatkan video pesawat luar angkasa melaju melewati galaksi nebula" },
      { title: "📱 Konten TikTok Viral", sub: "Script hook 30 detik + caption FYP", prompt: "Buatkan script konten TikTok viral tentang 3 rahasia AI yang jarang orang tahu" },
      { title: "✨ Animasi Interaktif", sub: "Animasi HTML5 Canvas siap jalan", prompt: "Buatkan kode HTML animasi gelombang neon interaktif siap Live Preview" }
    ]
  },
  music: {
    badge: "🎵 Music Studio Original",
    title: "FREON AI Music Composer",
    desc: "Ciptakan melodi & aransemen musik original berbasis Web Audio Synthesizer.",
    placeholder: "Sebutkan genre/suasana musik (misal: Chill, Epic, Cyber, Piano)...",
    instruction: "Kamu berada di mode MUSIC STUDIO. Setiap permintaan musik WAJIB memanggil tool 'buatMusikOriginal'.",
    starters: [
      { title: "🎹 Cyber Synthwave", sub: "Melodi elektronik futuristik", prompt: "Buatkan musik original bertema Cyber Synthwave tempo 118 BPM" },
      { title: "🌊 Lo-Fi Chill Santai", sub: "Nada lembut untuk fokus belajar", prompt: "Buatkan musik original Lo-Fi Chill santai untuk menemani belajar" },
      { title: "⚔️ Epic Cinematic", sub: "Aransemen dramatis penuh energi", prompt: "Buatkan musik original Epic Cinematic yang megah" },
      { title: "☀️ Happy Upbeat", sub: "Irama ceria & penuh semangat", prompt: "Buatkan musik original Happy Upbeat yang ceria" }
    ]
  },
  coding: {
    badge: "💻 Web, Game HTML & Code",
    title: "FREON Coding, Web & Game Studio",
    desc: "Bangun website modern, game HTML interaktif, dan deteksi bug kode dengan Live Preview & Artifact.",
    placeholder: "Minta dibuatkan website, game HTML, atau perbaiki kode...",
    instruction: "Kamu berada di mode CODING, WEB & GAME HTML. Berikan kode lengkap dalam satu blok ```html agar bisa langsung dijalankan via Live Preview.",
    starters: [
      { title: "🕹️ Pembuat Game HTML", sub: "Game arcade langsung main di browser", prompt: "Buatkan game HTML tangkap bintang neon dengan kontrol mouse/sentuh dan skor dalam satu file HTML lengkap" },
      { title: "🌐 Pembuat Website Modern", sub: "Landing page responsif siap pakai", prompt: "Buatkan website landing page startup AI modern dark mode dalam satu file HTML lengkap" },
      { title: "🔍 Deteksi Kesalahan Kode", sub: "Temukan bug & optimasi script", prompt: "Periksa dan perbaiki error pada kode berikut:\n" },
      { title: "⚙️ Script Otomatisasi", sub: "Kode Python / JS siap jalan", prompt: "Buatkan script JavaScript untuk mengolah dan memfilter data JSON" }
    ]
  },
  office: {
    badge: "📑 Word (All Fonts), PPTX & Excel",
    title: "FREON Office & Microsoft Word Studio",
    desc: "Buat dokumen Word (.doc) lengkap dengan seluruh font Microsoft Word (Times New Roman, Calibri, Arial, Cambria, Georgia, Garamond, dll), PPTX 16:9 & Excel.",
    placeholder: "Minta dibuatkan dokumen Word (.doc), makalah, surat resmi, PPTX, atau Excel...",
    instruction: "Kamu berada di mode OFFICE GENERATOR. Jika user meminta dokumen Word / makalah / surat / laporan (.doc), WAJIB panggil tool 'buatFileDownload' dengan namaFile berakhiran '.doc' dan parameter 'fontFamily'. Jika user meminta PPTX, gunakan '.pptx' dan isi 'slidesData'.",
    starters: [
      { title: "📝 Makalah Word (Times New Roman)", sub: "Format standar kampus & jurnal .doc", prompt: "Buatkan makalah akademik lengkap menggunakan font Times New Roman dalam file makalah_kuliah.doc tentang " },
      { title: "✉️ Surat Resmi (Calibri / Arial)", sub: "Tata letak kop & paragraf rapi .doc", prompt: "Buatkan surat resmi permohonan kerja sama perusahaan menggunakan font Calibri dalam file surat_resmi.doc" },
      { title: "📊 AI Pembuat PPT (.pptx)", sub: "Slide 16:9 + catatan pembicara", prompt: "Buatkan presentasi PowerPoint (.pptx) 8 slide tentang Strategi Bisnis Digital lengkap dengan catatan pembicara" },
      { title: "📈 AI Pembuat Excel (.xls)", sub: "Tabel laporan keuangan & rumus", prompt: "Buatkan tabel laporan penjualan bulanan lengkap dan simpan ke file laporan_penjualan.xls" }
    ]
  },
  finance: {
    badge: "💰 Keuangan, Jadwal & Tugas",
    title: "FREON Life, Finance & Time Manager",
    desc: "Catat keuangan, atur jadwal harian, pengingat tugas, to-do list & analisis data otomatis.",
    placeholder: "Masukkan catatan keuangan, jadwal, tugas, atau data hitung...",
    instruction: "Kamu berada di mode FINANCE, TIME & DATA MANAGER. Gunakan tool 'kalkulator' untuk hitungan pasti.",
    starters: [
      { title: "💵 AI Pencatat Keuangan", sub: "Hitung pemasukan, pengeluaran & saldo", prompt: "Hitung laporan keuangan saya: Gaji Rp 6.000.000, pengeluaran harian Rp 1.800.000, tagihan Rp 950.000. Berapa sisa & alokasi tabungan idealnya?" },
      { title: "📅 AI Pembuat Jadwal", sub: "Jadwal harian & manajemen waktu", prompt: "Buatkan jadwal harian terstruktur untuk mahasiswa & programmer agar produktif" },
      { title: "✅ To-Do List & Pengingat", sub: "Prioritas tugas harian", prompt: "Buatkan to-do list & pengingat tugas mingguan yang terorganisir" },
      { title: "📊 Analisis Data Otomatis", sub: "Statistik rata-rata, median & tren", prompt: "Analisis data penjualan berikut: 120, 145, 132, 168, 190, 175, 210" }
    ]
  },
  research: {
    badge: "🌐 Research, Translate & Tutor",
    title: "FREON Knowledge, Translator & Tutor",
    desc: "Pencarian internet real-time, penerjemah bahasa, perangkum teks panjang & tutor pelajaran.",
    placeholder: "Ketik topik riset, teks terjemahan, rangkuman, atau soal...",
    instruction: "Kamu berada di mode KNOWLEDGE, TRANSLATOR & TUTOR. Gunakan tool 'risetInternet' dan 'cekWaktuSekarang' untuk fakta akurat.",
    starters: [
      { title: "🌐 Pencarian Internet", sub: "Cari fakta & informasi terbaru", prompt: "Riset informasi lengkap tentang perkembangan komputasi kuantum" },
      { title: "🗣️ Penerjemah Bahasa", sub: "Terjemahan natural multi-bahasa", prompt: "Terjemahkan ke Bahasa Inggris, Jepang, dan Korea: 'Teknologi membantu manusia berkarya lebih cepat.'" },
      { title: "📝 Perangkum Teks Panjang", sub: "Ubah teks panjang jadi poin inti", prompt: "Rangkum teks berikut menjadi 5 poin kesimpulan utama:\n" },
      { title: "🎓 Penjawab Soal Pelajaran", sub: "Solusi lengkap langkah demi langkah", prompt: "Jelaskan dan selesaikan soal matematika: Jika 3x + 5 = 20, berapakah nilai 2x + 7?" }
    ]
  }
};

let activeModule = "general";

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("mobileBackdrop");
  if (window.innerWidth <= 768) {
    const isOpen = sidebar.classList.toggle("mobile-open");
    if (backdrop) backdrop.classList.toggle("show", isOpen);
  } else {
    sidebar.classList.toggle("collapsed");
  }
}

function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("mobile-open");
  document.getElementById("mobileBackdrop")?.classList.remove("show");
}

function runStarterPrompt(promptText, actionType = "", modOverride = "") {
  if (actionType === "catalog") { openFeaturesModal("pintar"); return; }
  if (actionType === "trainer") { openTrainerModal(); return; }
  if (actionType === "videocall") { openAnimeVideoCall(); return; }
  if (actionType === "videotask") { triggerVideoTaskUpload(); return; }
  if (modOverride) selectModule(modOverride, false);
  if (!promptText) { triggerUpload(); return; }
  document.getElementById("userInput").value = promptText;
  handleSendOrStop();
}

// ==========================================
// 10. CLOUD CHAT, MEMORY & GLOBAL SEARCH HISTORY
// ==========================================
let currentHistoryTab = "mine";

function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  document.getElementById("tabMyHistory").classList.toggle("active", tab === "mine");
  document.getElementById("tabGlobalHistory").classList.toggle("active", tab === "global");
  if (tab === "mine") renderSidebar();
  else renderGlobalSearchHistory();
}

async function logToGlobalSearchHistory(queryText) {
  if (!activeUser || !queryText) return;
  try {
    const entryId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbSet(`global_search_history/${entryId}`, {
      username: activeUser.fullName || activeUser.username,
      role: impersonatedFromAdmin ? "customer" : activeUser.role,
      query: queryText.slice(0, 140),
      timestamp: Date.now()
    });
  } catch {}
}

async function renderGlobalSearchHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  try {
    const data = await dbGet("global_search_history");
    if (!data || typeof data !== "object") {
      list.innerHTML = `<div style="font-size:11px;color:#64748b;padding:8px;">Belum ada riwayat pencarian global.</div>`;
      return;
    }
    const items = Object.values(data).filter(x => x && x.query).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 35);
    list.innerHTML = items.map(item => {
      const timeStr = new Date(item.timestamp || Date.now()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      return `
        <div class="global-search-card" onclick='useGlobalSearchPrompt(${JSON.stringify(item.query)})'>
          <div class="global-search-user"><span>👤 ${escapeHtml(item.username || "User")}</span><span style="color:#64748b;">${timeStr}</span></div>
          <div class="global-search-q">${escapeHtml(item.query)}</div>
        </div>
      `;
    }).join("");
  } catch {
    list.innerHTML = `<div style="font-size:11px;color:#64748b;padding:8px;">Memuat riwayat global...</div>`;
  }
}

function useGlobalSearchPrompt(q) { const inp = document.getElementById("userInput"); inp.value = q; inp.focus(); closeMobileSidebar(); }
function getUserCloudKey() { return activeUser?.userKey || (activeUser?.username ? activeUser.username.toLowerCase().replace(/[.#$/[\]]/g, "_") : "guest"); }
function getStorageKey(base) { return `${base}_${getUserCloudKey()}`; }

let cachedMemories = [];

async function loadMemoryFromCloud() {
  const uKey = getUserCloudKey();
  try {
    const cloudMem = await dbGet(`memories/${uKey}`);
    if (Array.isArray(cloudMem)) {
      cachedMemories = cloudMem;
      localStorage.setItem(getStorageKey("freon_mem"), JSON.stringify(cachedMemories));
      return cachedMemories;
    }
  } catch {}
  try { cachedMemories = JSON.parse(localStorage.getItem(getStorageKey("freon_mem")) || "[]"); } catch { cachedMemories = []; }
  return cachedMemories;
}

function loadMemory() { return cachedMemories; }

async function saveMemoryItem(fact) {
  const uKey = getUserCloudKey();
  if (!cachedMemories.includes(fact)) {
    cachedMemories.push(fact);
    localStorage.setItem(getStorageKey("freon_mem"), JSON.stringify(cachedMemories));
    try { await dbSet(`memories/${uKey}`, cachedMemories); } catch {}
  }
  return `Tersimpan di Cloud Long-Term Memory: "${fact}"`;
}

function viewMemories() {
  closeMobileSidebar();
  const mem = loadMemory();
  alert(mem.length ? "🧠 Cloud Long-Term Memory:\n\n• " + mem.join("\n• ") : "Belum ada memori tersimpan. Bilang saja 'Ingat ya...' di chat!");
}

async function loadSessionsFromCloud() {
  const uKey = getUserCloudKey();
  try {
    const cloudSessions = await dbGet(`chats/${uKey}`);
    if (cloudSessions && typeof cloudSessions === "object") {
      Object.keys(cloudSessions).forEach(sid => { if (!Array.isArray(cloudSessions[sid].uiMessages)) cloudSessions[sid].uiMessages = []; });
      localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(cloudSessions));
      return cloudSessions;
    }
  } catch {}
  try { return JSON.parse(localStorage.getItem(getStorageKey("freon_sessions")) || "{}"); } catch { return {}; }
}

function saveSessionToCloud(sessionId, sessionObj) {
  const uKey = getUserCloudKey();
  try { localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(sessions)); } catch {}
  const cleanMessages = (sessionObj.uiMessages || []).map(m => ({
    role: m.role, displayText: m.displayText || "", text: m.text || "", engineLabel: m.engineLabel || "",
    imageUrl: (m.imageUrl && m.imageUrl.startsWith("data:")) ? "" : (m.imageUrl || "")
  }));
  dbSet(`chats/${uKey}/${sessionId}`, { title: sessionObj.title || "Obrolan Baru", module: sessionObj.module || "general", updatedAt: Date.now(), uiMessages: cleanMessages }).catch(() => {});
}

function deleteSessionFromCloud(sessionId) {
  const uKey = getUserCloudKey();
  try { localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(sessions)); } catch {}
  dbDelete(`chats/${uKey}/${sessionId}`).catch(() => {});
}

let sessions = {};
let currentSessionId = null;
let chatHistory = [];
let uploadedTextContext = "";
let uploadedImageBase64 = "";
let uploadedFileName = "";
let pendingSpecialElements = [];
let isGenerating = false;
let abortController = null;

// ==========================================
// 10B. FOUNDER-ONLY MULTIMODAL AI TRAINING STUDIO (TEKS + GAMBAR + STYLE)
// ==========================================
let trainedExamples = [];
let trainedImageStylePrompt = "ultra-detailed masterpiece, 8k resolution, sharp focus, cinematic studio lighting, rich colors, professional illustration";
let isDeepRefinementActive = localStorage.getItem("freon_deep_refine") === "true";
let pendingTrainImageBase64 = "";

async function loadTrainingDataFromCloud() {
  try {
    const data = await dbGet("ai_training_dataset");
    if (data && typeof data === "object") {
      trainedExamples = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    } else {
      trainedExamples = [];
    }
    const imgStyle = await dbGet("config/trainedImageStyle");
    if (imgStyle && typeof imgStyle === "string") trainedImageStylePrompt = imgStyle;
  } catch { trainedExamples = []; }
  renderTrainedDatasetList();
}

function openTrainerModal() {
  if (!isCurrentUserFounder()) {
    alert("🔒 Akses Eksklusif: Hanya 5 Founder Utama yang memiliki otoritas melatih model AI!");
    return;
  }
  closeMobileSidebar();
  const toggle = document.getElementById("deepRefinementToggle");
  if (toggle) toggle.checked = isDeepRefinementActive;
  const styleInp = document.getElementById("trainedImageStyleInput");
  if (styleInp) styleInp.value = trainedImageStylePrompt;
  document.getElementById("trainerModalOverlay").classList.add("show");
  loadTrainingDataFromCloud();
}

function closeTrainerModal() { document.getElementById("trainerModalOverlay").classList.remove("show"); }

function toggleDeepRefinement(enabled) {
  if (!isCurrentUserFounder()) return;
  isDeepRefinementActive = enabled;
  localStorage.setItem("freon_deep_refine", String(enabled));
}

function handleTrainImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // Kompres ke max 380px agar ringan di Firebase
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 380 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      pendingTrainImageBase64 = c.toDataURL("image/jpeg", 0.78);
      document.getElementById("trainImagePreviewImg").src = pendingTrainImageBase64;
      document.getElementById("trainImagePreviewWrap").style.display = "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearTrainImage() {
  pendingTrainImageBase64 = "";
  const inp = document.getElementById("trainImageFileInput");
  if (inp) inp.value = "";
  const wrap = document.getElementById("trainImagePreviewWrap");
  if (wrap) wrap.style.display = "none";
}

document.getElementById("imageStyleTrainForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat melatih gaya gambar.");
  const val = document.getElementById("trainedImageStyleInput").value.trim();
  if (!val) return;
  trainedImageStylePrompt = val;
  await dbSet("config/trainedImageStyle", val);
  alert("🎨 Gaya Generasi Gambar AI berhasil dilatih! Semua gambar yang dihasilkan AI akan mengikuti standar kualitas tinggi ini.");
});

async function injectFrontierTrainingPack() {
  if (!isCurrentUserFounder()) return;
  const frontierSamples = [
    {
      prompt: "Analisis hukum perjanjian wanprestasi di Indonesia",
      idealResponse: "1. Dasar Hukum: Pasal 1243 KUHPerdata mengatur penggantian biaya, rugi, dan bunga akibat tidak dipenuhinya perikatan.\n2. Unsur Wanprestasi: (a) Tidak melaksanakan prestasi sama sekali, (b) Melaksanakan tetapi terlambat, (c) Melaksanakan tidak sesuai perjanjian, (d) Melakukan perbuatan yang dilarang kontrak.\n3. Langkah Eksekusi Praktis: Kirimkan Somasi (Peringatan Tertulis) minimal 2 kali dengan tenggat 7x24 jam sebagai syarat mutlak pembuktian lalai sebelum mengajukan gugatan perdata di Pengadilan Negeri."
    },
    {
      prompt: "Buatkan kode aplikasi web interaktif modern",
      idealResponse: "Berikan arsitektur kode lengkap dalam satu file HTML5/CSS3/JS yang responsif, tanpa placeholder '...isi kode di sini...', dilengkapi state management yang bersih, animasi halus 60fps, serta penanganan error input pengguna."
    },
    {
      prompt: "Evaluasi gambar / desain visual UI atau ilustrasi",
      idealResponse: "Lakukan audit visual terstruktur meliputi: (1) Hierarki Tipografi & Kontras Warna, (2) Proporsi Anatomi / Komposisi Tata Letak, (3) Pencahayaan & Detail Tekstur, serta (4) Rekomendasi perbaikan teknis yang langsung dapat dieksekusi."
    },
    {
      prompt: "Susun strategi bisnis dan proyeksi keuangan",
      idealResponse: "Sajikan analisis kuantitatif berbasis angka riil: estimasi CAPEX & OPEX, perhitungan Break-Even Point (BEP), margin laba bersih, kanal akuisisi pelanggan terukur, serta mitigasi risiko utama dalam 90 hari pertama."
    }
  ];

  for (let i = 0; i < frontierSamples.length; i++) {
    const id = `tr_frontier_${Date.now()}_${i}`;
    await dbSet(`ai_training_dataset/${id}`, {
      prompt: frontierSamples[i].prompt,
      idealResponse: frontierSamples[i].idealResponse,
      imageData: "",
      createdBy: activeUser.username,
      createdAt: Date.now() + i
    });
  }
  await loadTrainingDataFromCloud();
  chatHistory[0] = buildSystemPrompt();
  alert("⚡ 4 Paket Latihan Standar Frontier (Hukum, Coding, Visual Audit & Bisnis) berhasil disuntikkan ke Cloud AI!");
}

document.getElementById("addTrainingForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat melatih AI.");
  const q = document.getElementById("trainPromptInput").value.trim();
  const a = document.getElementById("trainIdealOutput").value.trim();
  if (!q || !a) return;

  const trainId = "tr_" + Date.now();
  await dbSet(`ai_training_dataset/${trainId}`, {
    prompt: q,
    idealResponse: a,
    imageData: pendingTrainImageBase64 || "",
    createdBy: activeUser?.username || "Founder",
    createdAt: Date.now()
  });

  document.getElementById("trainPromptInput").value = "";
  document.getElementById("trainIdealOutput").value = "";
  clearTrainImage();
  await loadTrainingDataFromCloud();
  chatHistory[0] = buildSystemPrompt();
  alert("✅ Data latih Multimodal (Teks & Gambar) berhasil disimpan ke Cloud AI!");
});

async function deleteTrainingItem(trainId) {
  if (!isCurrentUserFounder()) return;
  if (!confirm("Hapus data latih ini?")) return;
  await dbDelete(`ai_training_dataset/${trainId}`);
  await loadTrainingDataFromCloud();
  chatHistory[0] = buildSystemPrompt();
}

async function trainFromMessageBtn(btn) {
  if (!isCurrentUserFounder()) return alert("🔒 Fitur pelatihan model khusus untuk 5 Founder Utama.");
  const aiText = btn.closest(".ai-content").querySelector(".text-body").innerText.trim();
  const userRows = document.querySelectorAll(".user-bubble");
  const lastUserPrompt = userRows.length ? userRows[userRows.length - 1].innerText.trim() : "Pertanyaan Umum";
  const editedIdeal = prompt("Edit jika perlu sebelum disimpan sebagai standar latihan Founder:", aiText);
  if (!editedIdeal || !editedIdeal.trim()) return;

  const trainId = "tr_" + Date.now();
  await dbSet(`ai_training_dataset/${trainId}`, {
    prompt: lastUserPrompt.slice(0, 300),
    idealResponse: editedIdeal.trim().slice(0, 2000),
    imageData: "",
    createdBy: activeUser?.username || "Founder",
    createdAt: Date.now()
  });

  await loadTrainingDataFromCloud();
  chatHistory[0] = buildSystemPrompt();
  btn.textContent = "🎓 Terlatih!";
  setTimeout(() => (btn.textContent = "🎓 Latih AI"), 2000);
}

function renderTrainedDatasetList() {
  const listEl = document.getElementById("trainedDatasetList");
  const badgeEl = document.getElementById("trainedCountBadge");
  if (badgeEl) badgeEl.textContent = trainedExamples.length;
  if (!listEl) return;

  if (trainedExamples.length === 0) {
    listEl.innerHTML = `<div style="font-size:12.5px;color:#71717a;">Belum ada data latih. Klik tombol Suntik Paket Frontier atau tambahkan contoh teks & gambar di atas.</div>`;
    return;
  }

  listEl.innerHTML = trainedExamples
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(item => `
      <div style="padding:10px 12px;border-radius:10px;background:#18181b;border:1px solid rgba(255,255,255,0.08);display:flex;gap:12px;align-items:flex-start;">
        ${item.imageData ? `<img src="${item.imageData}" alt="Visual Train" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.2);flex-shrink:0;" />` : ""}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong style="font-size:12.5px;color:#38bdf8;">${item.imageData ? "🖼️ [Vision] " : "📝 "}Q: ${escapeHtml(item.prompt)}</strong>
            <button type="button" class="tbl-btn danger" onclick='deleteTrainingItem(${JSON.stringify(item.id)})'>Hapus</button>
          </div>
          <div style="font-size:12px;color:#a1a1aa;white-space:pre-line;">A: ${escapeHtml(item.idealResponse.slice(0, 220))}${item.idealResponse.length > 220 ? "..." : ""}</div>
        </div>
      </div>
    `).join("");
}

function buildSystemPrompt() {
  const memories = loadMemory();
  const memoryText = memories.length > 0 ? `\n\n[LONG-TERM MEMORY USER]:\n- ${memories.join("\n- ")}` : "";
  const personaText = customAIPersonality ? `\n[CUSTOM AI PERSONALITY]: ${customAIPersonality}` : "";
  const modCfg = MODULES_CONFIG[activeModule] || MODULES_CONFIG.general;
  const engCfg = getCurrentEngine();
  const userName = activeUser ? (activeUser.fullName || activeUser.username) : "User";

  const fewShotBlock = trainedExamples.length > 0
    ? `\n\n[FOUNDER GOLDEN TRAINING DATASET — WAJIB TIRU STANDAR & KEDALAMAN JAWABAN INI]:\n` +
      trainedExamples.slice(0, 8).map((ex, idx) =>
        `Contoh ${idx + 1}${ex.imageData ? " (Terlatih dengan Referensi Gambar Visual)" : ""}:\nUser: ${ex.prompt}\nStandar Jawaban Ideal: ${ex.idealResponse}`
      ).join("\n\n")
    : "";

  const frontierStandard = `
[STANDAR KECERDASAN TINGKAT TINGGI — FREON FRONTIER ALIGNMENT]:
1. Berpikirlah secara mendalam, sistematis, dan kritis sebelum menulis jawaban.
2. Jangan pernah memberikan jawaban dangkal. Berikan analisis tajam, contoh konkret, dan langkah eksekusi yang langsung bisa dipakai.
3. ATURAN DOKUMEN MICROSOFT WORD (.doc):
   - Font Microsoft Word yang sedang dipilih user adalah "${selectedWordFont}".
   - Daftar font Microsoft Word yang didukung: ${MS_WORD_FONTS.join(", ")}.
   - Jika user meminta pembuatan dokumen Word (.doc / makalah / surat / laporan), WAJIB panggil tool 'buatFileDownload' dengan namaFile berakhiran '.doc' dan parameter 'fontFamily'.
4. ATURAN POWERPOINT (.pptx): Jika user meminta PPT/PPTX, wajib panggil 'buatFileDownload' dengan '.pptx' dan isi 'slidesData'.`;

  return {
    role: "system",
    content: `Identitas: Kamu adalah FREON AI buatan Franky ("Made in Franky"). Kamu sedang melayani "${userName}".\nMesin Aktif: ${engCfg.persona}\nTugas Modul: ${modCfg.instruction}\n${frontierStandard}\nGunakan tool 'simpanMemori' jika user meminta mengingat fakta.${personaText}${memoryText}${fewShotBlock}`
  };
}

function selectModule(modKey, createNew = false) {
  if (!MODULES_CONFIG[modKey]) return;
  activeModule = modKey;
  document.querySelectorAll(".module-item").forEach(el => el.classList.toggle("active", el.dataset.mod === modKey));
  const cfg = MODULES_CONFIG[modKey];
  document.getElementById("activeModuleBadge").textContent = cfg.badge;
  document.getElementById("userInput").placeholder = cfg.placeholder;
  if (createNew) { createNewSession(modKey); closeMobileSidebar(); }
  else { chatHistory[0] = buildSystemPrompt(); }
}

function togglePlusMenu(e) { e.stopPropagation(); document.getElementById("plusPopover").classList.toggle("show"); }
document.addEventListener("click", () => { document.getElementById("plusPopover")?.classList.remove("show"); });
function triggerUpload() { document.getElementById("plusPopover").classList.remove("show"); document.getElementById("fileInput").click(); }
function quickSwitchModule(modKey, prefixText) {
  document.getElementById("plusPopover").classList.remove("show");
  selectModule(modKey, false);
  const inp = document.getElementById("userInput");
  inp.value = prefixText;
  inp.focus();
}

const animatedMiniLogoSVG = `
  <svg width="22" height="22" viewBox="0 0 100 100">
    <circle class="ring-outer" cx="50" cy="50" r="42" fill="none" stroke="#d97757" stroke-width="6" stroke-dasharray="45 25" stroke-linecap="round"/>
    <circle class="ring-inner" cx="50" cy="50" r="26" fill="none" stroke="#10b981" stroke-width="5" stroke-dasharray="30 25" stroke-linecap="round"/>
    <polygon class="core-star" points="50,32 55,45 68,50 55,55 50,68 45,55 32,50 45,45" fill="#ffffff"/>
  </svg>
`;

// ==========================================
// 11. WEB AUDIO MUSIC, VIDEO, WORD & PPTX GENERATOR
// ==========================================
function playSynthesizedMusic(gayaMusik = "cyber", tempoBPM = 115) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const scales = {
      cyber: [220, 261.63, 329.63, 392.00, 440, 523.25, 659.25, 523.25],
      chill: [261.63, 329.63, 392.00, 493.88, 523.25, 493.88, 392.00, 329.63],
      epic: [146.83, 220.00, 293.66, 349.23, 440.00, 587.33, 523.25, 440.00],
      happy: [261.63, 293.66, 329.63, 392.00, 440, 523.25, 587.33, 659.25]
    };
    const notes = scales[String(gayaMusik).toLowerCase()] || scales.cyber;
    const stepDur = 60 / Math.max(70, Math.min(180, Number(tempoBPM) || 115)) / 2;

    notes.concat(notes).forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = gayaMusik === "cyber" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * stepDur);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * stepDur);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (idx + 0.9) * stepDur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * stepDur);
      osc.stop(ctx.currentTime + (idx + 0.95) * stepDur);
    });
  } catch { alert("Klik layar sekali untuk mengizinkan audio browser."); }
}

async function generateAnimatedVideo(promptInggris, judulVideo) {
  return new Promise((resolve) => {
    const width = 640, height = 360;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){encodeURIComponent(promptInggris + ", " + trainedImageStylePrompt)}?width=768&height=432&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;

    const renderVideoStream = (bgImage) => {
      const stream = canvas.captureStream(30);
      let mimeType = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));

      recorder.start();
      const totalFrames = 120;
      let frame = 0;

      function drawFrame() {
        if (frame >= totalFrames) { recorder.stop(); return; }
        const progress = frame / totalFrames;
        ctx.clearRect(0, 0, width, height);
        if (bgImage) {
          const scale = 1 + progress * 0.14;
          ctx.save(); ctx.translate(width / 2 - progress * 28, height / 2 - progress * 14); ctx.scale(scale, scale);
          ctx.drawImage(bgImage, -width / 2, -height / 2, width, height); ctx.restore();
        } else {
          const grad = ctx.createLinearGradient(0, 0, width, height);
          grad.addColorStop(0, "#0f172a"); grad.addColorStop(0.5, "#0284c7"); grad.addColorStop(1, "#059669");
          ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
        }
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)"; ctx.fillRect(0, height - 42, width, 42);
        ctx.fillStyle = "#38bdf8"; ctx.font = "bold 13px sans-serif";
        ctx.fillText(`FREON AI VIDEO • ${judulVideo.slice(0, 48)}`, 16, height - 16);
        frame++;
        requestAnimationFrame(drawFrame);
      }
      drawFrame();
    };
    img.onload = () => renderVideoStream(img);
    img.onerror = () => renderVideoStream(null);
  });
}

function createUniversalDownloadUrl(contentOrBase64, mimeType, isBase64 = false) {
  if (isBase64) return `data:${mimeType};base64,${contentOrBase64}`;
  const utf8Base64 = btoa(unescape(encodeURIComponent(String(contentOrBase64))));
  return `data:${mimeType};base64,${utf8Base64}`;
}

function buildMicrosoftWordHtmlDocument(rawContent, chosenFont = "Times New Roman", fontSizePt = 12) {
  const safeFont = MS_WORD_FONTS.find(f => f.toLowerCase() === String(chosenFont || "").toLowerCase()) || selectedWordFont || "Times New Roman";
  const hasHtmlTags = /<(p|h1|h2|h3|table|div|ul|ol|br)\b/i.test(rawContent);
  const formattedBody = hasHtmlTags
    ? rawContent
    : String(rawContent)
        .split("\n\n")
        .map(para => `<p style="margin-bottom:10pt;text-align:justify;line-height:1.5;">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("");

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='[http://www.w3.org/TR/REC-html40](http://www.w3.org/TR/REC-html40)'>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 2.54cm 2.54cm 2.54cm 2.54cm; }
    body, h1, h2, h3, h4, p, td, th, li, span, div {
      font-family: '${safeFont}', serif, sans-serif;
    }
    body { font-size: ${fontSizePt}pt; line-height: 1.5; color: #111827; }
    h1 { font-size: 16pt; font-weight: bold; margin-bottom: 10pt; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
    th, td { border: 1px solid #374151; padding: 6pt 8pt; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
  </style>
</head>
<body>${formattedBody}</body>
</html>`;
}

const myTools = {
  cekWaktuSekarang: async () => `Waktu real-time saat ini (WIB): ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })}`,
  kalkulator: async ({ rumus }) => {
    try {
      const bersih = String(rumus).replace(/[^-()\d/*+.]/g, '');
      return `Hasil perhitungan ${rumus} = ${Function(`'use strict'; return (${bersih})`)()}`;
    } catch { return "Error: Format rumus matematika tidak valid."; }
  },
  jalankanKode: async ({ kodeJS }) => {
    try {
      const logs = [];
      const customConsole = { log: (...args) => logs.push(args.join(" ")) };
      const ret = new Function("console", `"use strict";\n${kodeJS}`)(customConsole);
      return JSON.stringify({ status: "sukses", consoleOutput: logs.join("\n"), returnValue: ret !== undefined ? String(ret) : null });
    } catch (err) { return JSON.stringify({ status: "error", message: err.message }); }
  },
  risetInternet: async ({ kataKunci }) => {
    try {
      const url = `[https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=$](https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=$){encodeURIComponent(kataKunci)}&utf8=&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const results = data.query?.search?.slice(0, 3) || [];
      if (results.length === 0) return `Tidak ditemukan artikel spesifik untuk "${kataKunci}".`;
      return `Hasil riset untuk "${kataKunci}":\n` + results.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet.replace(/<[^>]*>?/gm, '')}`).join("\n");
    } catch (e) { return `Gagal akses pencarian web (${e.message}).`; }
  },
  buatGambar: async ({ promptInggris }) => {
    // Otomatis menggabungkan gaya visual terlatih dari Founder Training Lab
    const enhancedPrompt = `${promptInggris}, ${trainedImageStylePrompt}`;
    const imageUrl = `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){encodeURIComponent(enhancedPrompt)}?width=896&height=576&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
    pendingSpecialElements.push({ type: "image", url: imageUrl, alt: promptInggris });
    return `Gambar HD terkalibrasi gaya Founder berhasil digenerate di URL: ${imageUrl}.`;
  },
  buatVideo: async ({ promptInggris, judulVideo }) => {
    const videoUrl = await generateAnimatedVideo(promptInggris, judulVideo || "AI Motion Scene");
    pendingSpecialElements.push({ type: "video", url: videoUrl, title: judulVideo || "freon-video.webm" });
    return `Video animasi AI "${judulVideo}" berhasil dirender.`;
  },
  buatMusikOriginal: async ({ judulLagu, tempoBPM, gayaMusik }) => {
    const style = gayaMusik || "cyber";
    const bpm = Number(tempoBPM) || 115;
    pendingSpecialElements.push({ type: "music", title: judulLagu || "FREON Original Track", bpm, style });
    playSynthesizedMusic(style, bpm);
    return `Musik original "${judulLagu}" (${style}, ${bpm} BPM) berhasil dikomposisi.`;
  },
  simpanMemori: async ({ informasi }) => await saveMemoryItem(informasi),
  buatFileDownload: async ({ namaFile, isiKonten, slidesData, fontFamily, fontSizePt }) => {
    const safeName = String(namaFile || "dokumen_freon.txt").trim();
    const lower = safeName.toLowerCase();

    if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) {
      const finalName = lower.endsWith(".pptx") ? safeName : safeName.replace(/\.ppt$/i, ".pptx");
      if (typeof PptxGenJS !== "undefined") {
        const pptx = new PptxGenJS();
        pptx.layout = "LAYOUT_WIDE";
        pptx.author = "FREON AI — Made in Franky";
        pptx.title = finalName;

        let slides = Array.isArray(slidesData) ? slidesData : [];
        if (slides.length === 0) {
          const blocks = String(isiKonten || "").split(/\n(?=Slide\s*\d+|#{1,3}\s*Slide|\d+\.\s+)/i).map(b => b.trim()).filter(Boolean);
          slides = (blocks.length > 0 ? blocks : [String(isiKonten || "Presentasi FREON AI")]).map((blk, i) => {
            const lines = blk.split("\n").map(l => l.replace(/^#+\s*/, "").trim()).filter(Boolean);
            const title = (lines[0] || `Slide ${i + 1}`).replace(/^(Slide\s*\d+[:.-]?\s*)/i, "");
            return { title, bullets: lines.slice(1).length > 0 ? lines.slice(1) : [blk], notes: "" };
          });
        }

        slides.forEach((s, index) => {
          const slide = pptx.addSlide();
          const isCover = index === 0;
          const isClosing = index === slides.length - 1 && slides.length > 1;
          slide.background = { color: isCover || isClosing ? "991B1B" : "FBF8F1" };
          slide.addText(String(s.title || `Slide ${index + 1}`), {
            x: 0.85, y: isCover ? 2.0 : 0.45, w: 11.2, h: isCover ? 1.4 : 0.9,
            fontFace: "Arial", fontSize: isCover ? 34 : 24, bold: true,
            color: isCover || isClosing ? "FFFFFF" : "18181B"
          });
          const rawBullets = Array.isArray(s.bullets) ? s.bullets : String(s.content || "").split("\n");
          const formattedBullets = rawBullets.map(item => String(item).replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
            .map(text => ({ text, options: { bullet: !isCover && !isClosing, breakLine: true, paraSpaceAfter: 10 } }));
          if (formattedBullets.length > 0) {
            slide.addText(formattedBullets, {
              x: 0.85, y: isCover ? 3.55 : 1.6, w: 11.4, h: 4.9,
              fontFace: "Calibri", fontSize: 17, color: isCover || isClosing ? "FEF2F2" : "27272A"
            });
          }
          if (s.notes) slide.addNotes(String(s.notes));
        });

        const base64Pptx = await pptx.write({ outputType: "base64" });
        const downloadUrl = createUniversalDownloadUrl(base64Pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", true);
        pendingSpecialElements.push({ type: "download", url: downloadUrl, filename: finalName });
        return `File PowerPoint asli "${finalName}" (${slides.length} slide) berhasil dibuat dan siap didownload.`;
      }
    }

    if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
      const docName = lower.endsWith(".docx") ? safeName.replace(/\.docx$/i, ".doc") : safeName;
      const appliedFont = fontFamily || selectedWordFont || "Times New Roman";
      const appliedSize = Number(fontSizePt) || 12;
      const wordHtml = buildMicrosoftWordHtmlDocument(isiKonten || "", appliedFont, appliedSize);
      const dataUrl = createUniversalDownloadUrl(wordHtml, "application/msword", false);
      pendingSpecialElements.push({ type: "download", url: dataUrl, filename: docName });
      return `Dokumen Microsoft Word "${docName}" dengan font "${appliedFont}" ukuran ${appliedSize}pt berhasil dibuat.`;
    }

    let mime = "text/plain";
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) mime = "application/vnd.ms-excel";
    else if (lower.endsWith(".html") || lower.endsWith(".htm")) mime = "text/html";
    else if (lower.endsWith(".csv")) mime = "text/csv";

    const dataUrl = createUniversalDownloadUrl(isiKonten || "", mime, false);
    pendingSpecialElements.push({ type: "download", url: dataUrl, filename: safeName });
    return `File "${safeName}" siap didownload.`;
  }
};

const toolsSchema = [
  { type: "function", function: { name: "cekWaktuSekarang", description: "Mengecek tanggal & jam real-time.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "kalkulator", description: "Menghitung operasi matematika secara akurat.", parameters: { type: "object", properties: { rumus: { type: "string" } }, required: ["rumus"] } } },
  { type: "function", function: { name: "jalankanKode", description: "Menjalankan kode JavaScript di sandbox.", parameters: { type: "object", properties: { kodeJS: { type: "string" } }, required: ["kodeJS"] } } },
  { type: "function", function: { name: "risetInternet", description: "Mencari informasi dan rangkuman dari internet.", parameters: { type: "object", properties: { kataKunci: { type: "string" } }, required: ["kataKunci"] } } },
  { type: "function", function: { name: "buatGambar", description: "Membuat gambar, logo, atau poster dari deskripsi teks.", parameters: { type: "object", properties: { promptInggris: { type: "string" } }, required: ["promptInggris"] } } },
  { type: "function", function: { name: "buatVideo", description: "Membuat video animasi dari deskripsi teks.", parameters: { type: "object", properties: { promptInggris: { type: "string" }, judulVideo: { type: "string" } }, required: ["promptInggris", "judulVideo"] } } },
  { type: "function", function: { name: "buatMusikOriginal", description: "Membuat komposisi musik original dengan synthesizer audio.", parameters: { type: "object", properties: { judulLagu: { type: "string" }, tempoBPM: { type: "number" }, gayaMusik: { type: "string" } }, required: ["judulLagu", "tempoBPM", "gayaMusik"] } } },
  { type: "function", function: { name: "simpanMemori", description: "Menyimpan fakta penting pengguna ke memori.", parameters: { type: "object", properties: { informasi: { type: "string" } }, required: ["informasi"] } } },
  {
    type: "function",
    function: {
      name: "buatFileDownload",
      description: "Membuat file download (.doc Microsoft Word dengan semua jenis font MS Word, .pptx PowerPoint, .xls Excel, .html, .txt, .csv).",
      parameters: {
        type: "object",
        properties: {
          namaFile: { type: "string" },
          isiKonten: { type: "string" },
          fontFamily: { type: "string" },
          fontSizePt: { type: "number" },
          slidesData: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                notes: { type: "string" }
              },
              required: ["title", "bullets", "notes"]
            }
          }
        },
        required: ["namaFile", "isiKonten"]
      }
    }
  }
];

// ==========================================
// 12. UPLOAD DOKUMEN, GAMBAR, VIDEO & VOICE
// ==========================================
function extractReadableStringsFromBinary(buffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  const matches = raw.match(/[\x20-\x7E\r\n]{5,}/g) || [];
  return matches.join(" ").replace(/\s+/g, " ").slice(0, 14000);
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.type.startsWith("video/")) { handleVideoTaskUpload(event); return; }

  uploadedFileName = file.name;
  uploadedVideoObjectUrl = "";
  const lower = file.name.toLowerCase();

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => { uploadedImageBase64 = e.target.result; uploadedTextContext = ""; showAttachment(`🖼️ Gambar siap dianalisis: ${file.name}`); };
    reader.readAsDataURL(file);
  } else if (lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const extracted = extractReadableStringsFromBinary(e.target.result);
      uploadedTextContext = `\n\n[ISI DOKUMEN PDF/WORD: ${file.name}]\n\`\`\`\n${extracted}\n\`\`\``;
      uploadedImageBase64 = "";
      showAttachment(`📄 PDF/Word siap dibaca & dianalisis: ${file.name}`);
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedTextContext = `\n\n[DOKUMEN TERLAMPIR: ${file.name}]\n\`\`\`\n${String(e.target.result).slice(0, 14000)}\n\`\`\``;
      uploadedImageBase64 = "";
      showAttachment(`📎 Dokumen siap dianalisis: ${file.name}`);
    };
    reader.readAsText(file);
  }
}

function showAttachment(label) { document.getElementById("attachmentLabel").textContent = label; document.getElementById("attachmentPreview").style.display = "flex"; }
function clearAttachment() {
  uploadedTextContext = ""; uploadedImageBase64 = ""; uploadedVideoObjectUrl = ""; uploadedFileName = "";
  document.getElementById("fileInput").value = ""; document.getElementById("videoTaskInput").value = "";
  document.getElementById("attachmentPreview").style.display = "none";
}

let recognition = null, isRecording = false;
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Gunakan Chrome/Edge untuk Voice Mode.");
  const micBtn = document.getElementById("micBtn");
  if (isRecording && recognition) { recognition.stop(); return; }
  recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.onstart = () => { isRecording = true; micBtn.classList.add("recording"); document.getElementById("userInput").placeholder = "🎙️ Mendengarkan suara..."; };
  recognition.onresult = (event) => { document.getElementById("userInput").value = event.results[0][0].transcript; handleSendOrStop(); };
  recognition.onend = () => { isRecording = false; micBtn.classList.remove("recording"); document.getElementById("userInput").placeholder = MODULES_CONFIG[activeModule].placeholder; };
  recognition.start();
}

function speakText(btn) {
  const text = btn.closest(".ai-content").querySelector(".text-body").innerText;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "id-ID"; u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

function copyResponseText(btn) {
  navigator.clipboard.writeText(btn.closest(".ai-content").querySelector(".text-body").innerText);
  btn.textContent = "✓ Tersalin";
  setTimeout(() => btn.textContent = "📋 Salin", 1500);
}

function renderSidebar() {
  if (currentHistoryTab === "global") { renderGlobalSearchHistory(); return; }
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const sortedIds = Object.keys(sessions).sort((a, b) => (sessions[b].updatedAt || 0) - (sessions[a].updatedAt || 0));
  sortedIds.forEach(id => {
    const item = document.createElement("div");
    item.className = `history-item ${id === currentSessionId ? "active" : ""}`;
    item.innerHTML = `<span class="title-text" onclick="switchSession('${id}')">${escapeHtml(sessions[id].title)}</span><span class="del-chat" onclick="deleteSession(event, '${id}')">✕</span>`;
    list.appendChild(item);
  });
}

function createNewSession(modKey = activeModule) {
  currentSessionId = "chat_" + Date.now();
  chatHistory = [buildSystemPrompt()];
  sessions[currentSessionId] = { title: "Obrolan Baru", module: modKey, updatedAt: Date.now(), uiMessages: [] };
  saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  renderSidebar();
  renderWelcomeScreen();
  closeMobileSidebar();
}

function switchSession(id) {
  if (!sessions[id]) return;
  currentSessionId = id;
  selectModule(sessions[id].module || "general", false);
  renderSidebar();
  closeMobileSidebar();

  const container = document.getElementById("chatContainer");
  container.innerHTML = "";
  chatHistory = [buildSystemPrompt()];

  const saved = sessions[id].uiMessages || [];
  if (saved.length === 0) { renderWelcomeScreen(); return; }

  saved.forEach(msg => {
    if (msg.role === "user") {
      appendUserMessage(msg.displayText, msg.imageUrl, false, "");
      chatHistory.push({ role: "user", content: msg.displayText });
    } else if (msg.role === "assistant") {
      appendAIMessage(msg.text, false, [], false, msg.engineLabel || "FREON 1.1 Hybrid");
      chatHistory.push({ role: "assistant", content: msg.text });
    }
  });
}

function deleteSession(e, id) {
  e.stopPropagation();
  delete sessions[id];
  deleteSessionFromCloud(id);
  const remaining = Object.keys(sessions);
  if (remaining.length === 0) createNewSession("general");
  else if (currentSessionId === id) switchSession(remaining[remaining.length - 1]);
  else renderSidebar();
}

function renderWelcomeScreen() {
  const cfg = MODULES_CONFIG[activeModule] || MODULES_CONFIG.general;
  const cardsHtml = (cfg.starters || []).map(st => `
    <div class="starter-card" onclick='runStarterPrompt(${JSON.stringify(st.prompt || "")}, ${JSON.stringify(st.action || "")}, ${JSON.stringify(st.mod || "")})'>
      <div class="starter-card-title">${escapeHtml(st.title)}</div>
      <div class="starter-card-sub">${escapeHtml(st.sub)}</div>
    </div>
  `).join("");

  document.getElementById("chatContainer").innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="hero-logo-wrap">
        <svg width="74" height="74" viewBox="0 0 100 100">
          <defs><linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97757"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>
          <circle class="ring-outer" cx="50" cy="50" r="44" fill="none" stroke="url(#neonGrad)" stroke-width="4" stroke-dasharray="55 20 15 20" stroke-linecap="round"/>
          <circle class="ring-inner" cx="50" cy="50" r="30" fill="none" stroke="#fdba74" stroke-width="3" stroke-dasharray="35 25" stroke-linecap="round" opacity="0.85"/>
          <polygon class="core-star" points="50,28 56,44 72,50 56,56 50,72 44,56 28,50 44,44" fill="#ffffff"/>
        </svg>
      </div>
      <div class="made-badge">Made in Franky • ${cfg.badge}</div>
      <h1>${cfg.title}</h1>
      <p>${cfg.desc}</p>
      <div class="starter-grid">${cardsHtml}</div>
    </div>
  `;
}

function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

let codeBlockCounter = 0;
function formatRichMarkdown(text) {
  const codeBlocks = [];
  let processed = String(text).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = "code_" + (++codeBlockCounter) + "_" + Math.random().toString(36).slice(2, 6);
    const language = (lang || "code").toLowerCase();
    const isWebPreviewable = ["html", "htm", "svg"].includes(language);
    codeBlocks.push(`
      <div class="code-wrapper">
        <div class="code-header">
          <span>${language.toUpperCase()}</span>
          <div class="code-actions">
            ${isWebPreviewable ? `<button type="button" class="code-btn run-btn" onclick="toggleLivePreview('${id}')">▶️ Live Preview</button>` : ""}
            <button type="button" class="code-btn" onclick="copyCodeBlock('${id}', this)">📋 Copy</button>
          </div>
        </div>
        <pre id="${id}">${escapeHtml(code.trim())}</pre>
        ${isWebPreviewable ? `<iframe id="frame_${id}" class="live-preview-frame" sandbox="allow-scripts"></iframe>` : ""}
      </div>
    `);
    return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
  });

  processed = escapeHtml(processed)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:5px;font-family:\"JetBrains Mono\",monospace;font-size:13px;color:#fdba74;'>$1</code>")
    .replace(/\n/g, "<br>");

  codeBlocks.forEach((html, idx) => { processed = processed.replace(`@@CODEBLOCK_${idx}@@`, html); });
  return processed;
}

function copyCodeBlock(id, btn) { navigator.clipboard.writeText(document.getElementById(id).innerText); btn.textContent = "✓ Copied!"; setTimeout(() => btn.textContent = "📋 Copy", 1500); }
function toggleLivePreview(id) {
  const frame = document.getElementById("frame_" + id);
  frame.style.display = frame.style.display === "block" ? "none" : "block";
  if (frame.style.display === "block") frame.srcdoc = document.getElementById(id).innerText;
}

function hideWelcome() { document.getElementById("welcomeScreen")?.remove(); }

function appendUserMessage(text, imgDataUrl = "", saveToSession = true, videoUrl = "") {
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row user-row";
  let mediaHtml = "";
  if (videoUrl) mediaHtml = `<video src="${videoUrl}" controls playsinline></video>`;
  else if (imgDataUrl) mediaHtml = `<img src="${imgDataUrl}" alt="Uploaded">`;

  row.innerHTML = `
    <div class="user-bubble">${escapeHtml(text).replace(/\n/g, "<br>")}${mediaHtml}</div>
    <button type="button" class="act-btn" onclick="editLastPrompt(this)">✎ Edit</button>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  if (saveToSession && sessions[currentSessionId]) {
    if (sessions[currentSessionId].uiMessages.length === 0) sessions[currentSessionId].title = text.slice(0, 32);
    sessions[currentSessionId].updatedAt = Date.now();
    sessions[currentSessionId].uiMessages.push({ role: "user", displayText: text, imageUrl: videoUrl ? "" : imgDataUrl });
    renderSidebar();
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
    logToGlobalSearchHistory(text);
  }
}

function appendAIMessage(text, isError = false, specialEls = [], saveToSession = true, engineLabel = "FREON 1.1 Hybrid") {
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row";

  let extraHtml = "";
  specialEls.forEach(el => {
    if (el.type === "image") extraHtml += `<div class="extra-media"><img src="${el.url}" alt="${escapeHtml(el.alt)}"></div>`;
    else if (el.type === "video") extraHtml += `<div class="extra-media"><video src="${el.url}" controls autoplay loop muted playsinline></video><br><a class="download-card" href="${el.url}" download="${escapeHtml(el.title)}.webm">⬇️ Download Video (.webm)</a></div>`;
    else if (el.type === "music") extraHtml += `<div class="music-player-card"><div><strong>🎵 ${escapeHtml(el.title)}</strong><div style="font-size:12px;color:#94a3b8;">Style: ${escapeHtml(el.style)} • ${el.bpm} BPM</div></div><button type="button" class="tbl-btn excl-on" onclick="playSynthesizedMusic('${escapeHtml(el.style)}', ${el.bpm})">▶️ Putar Lagi</button></div>`;
    else if (el.type === "download") extraHtml += `<a class="download-card" href="${el.url}" download="${escapeHtml(el.filename)}">⬇️ Download ${escapeHtml(el.filename)}</a>`;
  });

  // Tombol Latih AI hanya muncul jika yang login adalah Founder Utama
  const founderTrainBtnHtml = isCurrentUserFounder()
    ? `<button type="button" class="act-btn" onclick="trainFromMessageBtn(this)">🎓 Latih AI</button>`
    : "";

  row.innerHTML = `
    <div class="ai-avatar-box">${animatedMiniLogoSVG}</div>
    <div class="ai-content ${isError ? "error-box" : ""}">
      <div class="text-body">${formatRichMarkdown(text)}</div>
      ${extraHtml}
      ${!isError ? `
        <div class="msg-actions">
          <div class="msg-actions-left">
            <button type="button" class="act-btn" onclick="copyResponseText(this)">📋 Salin</button>
            <button type="button" class="act-btn" onclick="speakText(this)">🔊 Dengar</button>
            <button type="button" class="act-btn" onclick="regenerateLast()">🔄 Ulangi</button>
            ${founderTrainBtnHtml}
          </div>
          <span class="model-tag-footer">⚡ ${escapeHtml(engineLabel)}</span>
        </div>` : ""}
    </div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  if (saveToSession && !isError && sessions[currentSessionId]) {
    sessions[currentSessionId].updatedAt = Date.now();
    sessions[currentSessionId].uiMessages.push({ role: "assistant", text, engineLabel });
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  }
}

function editLastPrompt(btn) {
  const row = btn.closest(".user-row");
  document.getElementById("userInput").value = row.querySelector(".user-bubble").innerText.trim();
  while (row.nextSibling) row.nextSibling.remove();
  row.remove();
  if (chatHistory.length >= 2) chatHistory.splice(-2);
  if (sessions[currentSessionId]?.uiMessages.length >= 2) {
    sessions[currentSessionId].uiMessages.splice(-2);
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  }
  document.getElementById("userInput").focus();
}

function regenerateLast() {
  if (isGenerating || chatHistory.length < 2) return;
  const container = document.getElementById("chatContainer");
  if (container.lastChild) container.lastChild.remove();
  if (chatHistory[chatHistory.length - 1].role === "assistant") chatHistory.pop();
  if (sessions[currentSessionId]?.uiMessages.slice(-1)[0]?.role === "assistant") {
    sessions[currentSessionId].uiMessages.pop();
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  }
  executeAgentRequest();
}

function setGeneratingState(state) {
  isGenerating = state;
  const btn = document.getElementById("sendBtn");
  if (state) {
    btn.classList.add("stop-mode");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  } else {
    btn.classList.remove("stop-mode");
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

// ==========================================
// 13. EKSEKUSI ENGINE AI (MULTIMODAL FEW-SHOT + SELF-REFINEMENT)
// ==========================================
async function callVikeyAPI(modelName, messagesPayload, temp = 0.6, signal = null, includeTools = true) {
  const bodyObj = { model: modelName, messages: messagesPayload, temperature: temp };
  if (includeTools) { bodyObj.tools = toolsSchema; bodyObj.tool_choice = "auto"; }
  return await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify(bodyObj),
    signal
  });
}

async function handleSendOrStop() {
  if (isGenerating) {
    if (abortController) abortController.abort();
    setGeneratingState(false);
    return;
  }

  if (activeUser && activeUser.role === "customer" && activeUser.quota <= 0 && !impersonatedFromAdmin) {
    appendAIMessage("⚠️ **Token Anda sudah habis (0).** Hubungi Admin untuk top-up token.", true, [], false);
    return;
  }

  const input = document.getElementById("userInput");
  const rawText = input.value.trim();
  if (!rawText && !uploadedTextContext && !uploadedImageBase64) return;

  const displayUserText = rawText || `Tolong analisis file lampiran: ${uploadedFileName}`;
  appendUserMessage(displayUserText, uploadedImageBase64, true, uploadedVideoObjectUrl);

  const fullPromptText = (rawText || "Analisis lampiran ini secara detail.") + uploadedTextContext;
  if (uploadedImageBase64) {
    chatHistory.push({ role: "user", content: [{ type: "text", text: fullPromptText }, { type: "image_url", image_url: { url: uploadedImageBase64 } }] });
  } else {
    chatHistory.push({ role: "user", content: fullPromptText });
  }

  input.value = "";
  clearAttachment();
  await executeAgentRequest();
}

async function executeAgentRequest() {
  const engCfg = getCurrentEngine();
  setGeneratingState(true);
  abortController = new AbortController();
  pendingSpecialElements = [];

  const container = document.getElementById("chatContainer");
  const loadingRow = document.createElement("div");
  loadingRow.className = "message-row";
  loadingRow.id = "activeLoadingRow";
  loadingRow.innerHTML = `
    <div class="ai-avatar-box">${animatedMiniLogoSVG}</div>
    <div class="ai-content" style="display:flex;align-items:center;gap:10px;padding-top:6px;">
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <span id="statusText" style="font-size:12.5px;color:#a1a1aa;">${engCfg.isMulti ? "Menjalankan 3 Model Multi-AI sekaligus..." : (isDeepRefinementActive ? "Menyusun & mengaudit jawaban tingkat Frontier..." : "Memproses dengan " + engCfg.label + "...")}</span>
    </div>
  `;
  container.appendChild(loadingRow);
  container.scrollTop = container.scrollHeight;

  const removeLoader = () => { document.getElementById("activeLoadingRow")?.remove(); };

  // Susun payload dengan menyertakan contoh gambar visual yang dilatih Founder (jika user mengirim gambar)
  const buildApiPayloadWithVisionTraining = () => {
    const lastMsg = chatHistory[chatHistory.length - 1];
    const userHasImage = lastMsg && Array.isArray(lastMsg.content);
    const visionExamples = trainedExamples.filter(ex => ex.imageData).slice(0, 2);

    if (userHasImage && visionExamples.length > 0) {
      const injectedPairs = [];
      visionExamples.forEach(ex => {
        injectedPairs.push({
          role: "user",
          content: [{ type: "text", text: `[CONTOH LATIHAN VISUAL FOUNDER]: ${ex.prompt}` }, { type: "image_url", image_url: { url: ex.imageData } }]
        });
        injectedPairs.push({ role: "assistant", content: ex.idealResponse });
      });
      return [chatHistory[0], ...injectedPairs, ...chatHistory.slice(1)];
    }
    return chatHistory;
  };

  try {
    if (engCfg.isMulti) {
      const cleanContext = chatHistory.map(m => ({
        role: m.role,
        content: Array.isArray(m.content) ? m.content.filter(c => c.type === "text").map(c => c.text).join("\n") : m.content
      }));

      const models = [
        { name: "⚡ FREON 1.1 Hybrid", id: "deepseek/deepseek-v4-pro", temp: 0.6 },
        { name: "🚀 FREON 1.1 Flash", id: "deepseek/deepseek-v4-flash", temp: 0.4 },
        { name: "👑 FREON 2.1 Sonic", id: "openai/gpt-6-luna", temp: 0.75 }
      ];

      const results = await Promise.all(models.map(async (m) => {
        try {
          const r = await callVikeyAPI(m.id, cleanContext, m.temp, abortController.signal, false);
          const d = await r.json();
          return { label: m.name, text: d.choices?.[0]?.message?.content || "Tidak ada respons." };
        } catch { return { label: m.name, text: "Mesin sedang sibuk." }; }
      }));

      removeLoader();
      const combinedReply = results.map(res => `### ${res.label}\n${res.text}`).join("\n\n---\n\n");
      chatHistory.push({ role: "assistant", content: combinedReply });
      await deductCustomerQuotaCloud(Math.max(120, Math.ceil(combinedReply.length / 3)));
      appendAIMessage(combinedReply, false, [], true, "Multi-AI Council (3 Model)");
      return;
    }

    let step = 0;
    while (step < 5) {
      step++;
      const payloadToSend = buildApiPayloadWithVisionTraining();
      let response = await callVikeyAPI(engCfg.apiModel, payloadToSend, engCfg.temperature, abortController.signal, true);

      if (!response.ok) {
        const textOnlyHistory = chatHistory.map(m => ({
          role: m.role,
          content: Array.isArray(m.content) ? m.content.filter(c => c.type === "text").map(c => c.text).join("\n") : (m.content || "")
        }));
        response = await callVikeyAPI(engCfg.fallbackModel, textOnlyHistory, engCfg.temperature, abortController.signal, true);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      const totalTokens = data.usage?.total_tokens || 90;
      await deductCustomerQuotaCloud(totalTokens);

      const message = data.choices?.[0]?.message;
      if (!message) throw new Error("Tidak ada balasan dari server AI.");

      if (message.tool_calls && message.tool_calls.length > 0) {
        chatHistory.push(message);
        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try { fnArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch {}

          const st = document.getElementById("statusText");
          if (st) st.textContent = `Menjalankan alat: ${fnName}...`;
          let toolResult = myTools[fnName] ? await myTools[fnName](fnArgs) : `Tool ${fnName} tidak dikenal.`;
          chatHistory.push({ role: "tool", tool_call_id: toolCall.id, content: String(toolResult) });
        }
      } else {
        let finalReply = message.content || "Selesai.";

        if (isDeepRefinementActive && pendingSpecialElements.length === 0 && finalReply.length > 40) {
          const st = document.getElementById("statusText");
          if (st) st.textContent = "🎓 Mengevaluasi & menyempurnakan jawaban (Frontier Alignment)...";
          try {
            const lastUserMsg = [...chatHistory].reverse().find(m => m.role === "user");
            const userPromptStr = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "Permintaan user";
            const refineRes = await callVikeyAPI(
              engCfg.apiModel,
              [
                { role: "system", content: "Kamu adalah Editor & Auditor Kualitas AI tingkat Frontier (setara Claude Opus). Perbaiki draf jawaban berikut agar jauh lebih tajam, mendalam, terstruktur rapi, tanpa basa-basi klise, dan langsung menjawab inti kebutuhan pengguna." },
                { role: "user", content: `Pertanyaan User:\n${userPromptStr}\n\nDraf Awal:\n${finalReply}\n\nTuliskan versi final yang jauh lebih unggul:` }
              ],
              0.45,
              abortController.signal,
              false
            );
            if (refineRes.ok) {
              const refineData = await refineRes.json();
              const improved = refineData.choices?.[0]?.message?.content;
              if (improved && improved.trim().length > 30) finalReply = improved.trim();
            }
          } catch {}
        }

        removeLoader();
        chatHistory.push({ role: "assistant", content: finalReply });
        appendAIMessage(finalReply, false, pendingSpecialElements, true, isDeepRefinementActive ? `${engCfg.label} • Frontier-Aligned` : engCfg.label);
        break;
      }
    }
  } catch (err) {
    removeLoader();
    if (err.name === "AbortError") appendAIMessage("⏹️ *Generasi dihentikan oleh pengguna.*", true, [], false);
    else appendAIMessage(`⚠️ **Terjadi Kendala:** ${err.message}`, true, [], false);
  } finally {
    setGeneratingState(false);
    abortController = null;
  }
}

document.getElementById("userInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendOrStop(); }
});

// ==========================================
// 14. INIT WORKSPACE & BOOT
// ==========================================
async function initWorkspace() {
  await loadMemoryFromCloud();
  await loadTrainingDataFromCloud();
  sessions = await loadSessionsFromCloud();
  const existingIds = Object.keys(sessions);
  if (existingIds.length === 0) createNewSession("general");
  else {
    const latestId = existingIds.sort((a, b) => (sessions[b].updatedAt || 0) - (sessions[a].updatedAt || 0))[0];
    switchSession(latestId);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await initCloudDatabase();
  const savedSession = sessionStorage.getItem("freon_active_session");
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.username) { await loginSuccess(parsed); return; }
    } catch {}
  }
  switchAuthMode("customer");
});
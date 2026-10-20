"use strict";

// ========================================
// ST7 SPORTS CENTER
// Live Matches - Python Backend
// ========================================

// لازم يكون Python Backend شغال على جهازك
const API_URL = "http://127.0.0.1:5000/api/matches";
const REFRESH_INTERVAL = 60_000;

// عناصر الصفحة
const $ = (selector) => document.querySelector(selector);

const matchesList = $("#matchesList");
const todayDate = $("#todayDate");
const tickerMessage = $("#tickerMessage") || $(".ticker-message");
const searchToggle = $("#searchToggle");
const searchBox = $("#searchBox");
const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const clearSearch = $("#clearSearch");
const menuToggle = $("#menuToggle");
const navbar = $("#navbar");
const backToTop = $("#backToTop");
const currentYear = $("#currentYear");

// إنشاء رسالة حالة المباريات إذا لم تكن موجودة في HTML
let emptyMatches = $("#emptyMatches");

if (matchesList && !emptyMatches) {
    emptyMatches = document.createElement("div");
    emptyMatches.id = "emptyMatches";
    emptyMatches.className = "empty-state";
    emptyMatches.hidden = true;
    emptyMatches.innerHTML = "<p></p>";
    matchesList.appendChild(emptyMatches);
}

let allMatches = [];
let activeFilter = "all";
let searchTerm = "";
let isLoading = false;

function getMatchStatus(status) {
    const value = String(status || "").toUpperCase();

    if (["IN_PLAY", "PAUSED", "LIVE", "IN_PLAY_1ST_HALF",
        "IN_PLAY_2ND_HALF", "EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(value)) {
        return "live";
    }

    if (["TIMED", "SCHEDULED", "NOT_STARTED"].includes(value)) {
        return "upcoming";
    }

    if (["FINISHED", "AWARDED", "AFTER_EXTRA_TIME"].includes(value)) {
        return "finished";
    }

    return "other";
}

function getStatusLabel(status) {
    if (status === "live") return "مباشر";
    if (status === "upcoming") return "لم تبدأ";
    if (status === "finished") return "انتهت";
    return "الحالة غير متاحة";
}

function formatDate(dateString) {
    if (!dateString) return "موعد غير محدد";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "موعد غير محدد";

    return new Intl.DateTimeFormat("ar-EG", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Cairo"
    }).format(date);
}

function formatTime(dateString) {
    if (!dateString) return "--:--";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "--:--";

    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Africa/Cairo"
    }).format(date);
}

function formatScore(score) {
    return score === null || score === undefined ? "-" : String(score);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function normalizeMatch(match, index) {
    const home = match.home ?? match.homeTeam?.name ?? match.homeTeam ?? match.home_team ?? "الفريق صاحب الأرض";
    const away = match.away ?? match.awayTeam?.name ?? match.awayTeam ?? match.away_team ?? "الفريق الضيف";

    const score = match.score ?? {};
    const fullTime = score.fullTime ?? {};

    const homeScore = match.homeScore ?? match.home_score ?? fullTime.home ?? null;
    const awayScore = match.awayScore ?? match.away_score ?? fullTime.away ?? null;

    const utcDate = match.utcDate ?? match.utc_date ?? match.date ?? match.utcDateTime ?? "";

    return {
        id: match.id ?? `${home}-${away}-${utcDate}-${index}`,
        home: typeof home === "object" ? (home.name ?? "الفريق صاحب الأرض") : home,
        away: typeof away === "object" ? (away.name ?? "الفريق الضيف") : away,
        homeScore,
        awayScore,
        status: getMatchStatus(match.status),
        rawStatus: match.status || "",
        utcDate,
        competition: typeof match.competition === "object"
            ? (match.competition.name ?? "بطولة غير محددة")
            : (match.competition ?? match.league ?? "بطولة غير محددة")
    };
}

function getTeamIcon(index) {
    const icons = [
        "fa-shield-halved",
        "fa-futbol",
        "fa-star",
        "fa-trophy"
    ];

    return icons[index % icons.length];
}

function getTeamColor(index) {
    const colors = ["team-blue", "team-red", "team-gold", "team-dark"];
    return colors[index % colors.length];
}

function renderMatch(match, index) {
    const homeName = escapeHTML(match.home);
    const awayName = escapeHTML(match.away);
    const competition = escapeHTML(match.competition);

    const isLive = match.status === "live";
    const isUpcoming = match.status === "upcoming";
    const isFinished = match.status === "finished";

    let centerContent = "";

    if (isUpcoming) {
        centerContent = `
            <div class="score-time">${formatTime(match.utcDate)}</div>
            <span class="match-day">${formatDate(match.utcDate)}</span>
        `;
    } else {
        const homeScore = formatScore(match.homeScore);
        const awayScore = formatScore(match.awayScore);

        let scoreLabel = "الحالة غير متاحة";

        if (isLive) scoreLabel = "مباشر الآن";
        if (isFinished) scoreLabel = "نهاية المباراة";

        centerContent = `
            <div class="score-numbers">
                <span>${homeScore}</span>
                <span>:</span>
                <span>${awayScore}</span>
            </div>
            <span class="match-minute">${scoreLabel}</span>
        `;
    }

    const statusClass = isLive
        ? "live-status"
        : isUpcoming
            ? "upcoming-status"
            : "finished-status";

    const statusHTML = isLive
        ? `<span class="live-dot"></span>${getStatusLabel(match.status)}`
        : getStatusLabel(match.status);

    const footerLabel = isUpcoming
        ? "موعد المباراة"
        : isFinished
            ? "نتيجة المباراة"
            : isLive
                ? "المباراة جارية"
                : "بيانات المباراة";

    return `
        <article class="match-card" data-status="${match.status}">
            <div class="match-header">
                <span class="league-name">
                    <i class="fa-solid fa-trophy"></i>
                    ${competition}
                </span>
                <span class="match-status ${statusClass}">
                    ${statusHTML}
                </span>
            </div>

            <div class="match-teams match-body">
                <div class="team">
                    <div class="team-logo ${getTeamColor(index)}">
                        <i class="fa-solid ${getTeamIcon(index)}"></i>
                    </div>
                    <span class="team-name">${homeName}</span>
                </div>

                <div class="match-score">
                    ${centerContent}
                </div>

                <div class="team">
                    <div class="team-logo ${getTeamColor(index + 1)}">
                        <i class="fa-solid ${getTeamIcon(index + 1)}"></i>
                    </div>
                    <span class="team-name">${awayName}</span>
                </div>
            </div>

            <div class="match-footer">
                <small>
                    <i class="fa-solid fa-circle-info"></i>
                    ${footerLabel}
                </small>
                <span class="details-btn">
                    ${isLive ? "مباشر" : isFinished ? "النتيجة النهائية" : "موعد اللقاء"}
                    <i class="fa-solid fa-chevron-left"></i>
                </span>
            </div>
        </article>
    `;
}

function getFilteredMatches() {
    return allMatches.filter((match) => {
        const matchesStatus =
            activeFilter === "all" || match.status === activeFilter;

        const searchableText = [
            match.home,
            match.away,
            match.competition
        ].join(" ").toLocaleLowerCase("ar");

        const matchesSearch =
            !searchTerm ||
            searchableText.includes(searchTerm.toLocaleLowerCase("ar"));

        return matchesStatus && matchesSearch;
    });
}

function showEmptyMessage(message) {
    if (!emptyMatches) return;

    emptyMatches.hidden = false;

    const paragraph = emptyMatches.querySelector("p");

    if (paragraph) {
        paragraph.textContent = message;
    }
}

function renderMatches() {
    if (!matchesList) {
        console.error("ST7: العنصر #matchesList غير موجود في index.html");
        return;
    }

    const filteredMatches = getFilteredMatches();

    // إزالة الكروت القديمة فقط، مع الإبقاء على رسالة الحالة
    matchesList.querySelectorAll(".match-card").forEach((card) => card.remove());

    if (filteredMatches.length > 0) {
        emptyMatches.hidden = true;

        const html = filteredMatches
            .map((match, index) => renderMatch(match, index))
            .join("");

        matchesList.insertAdjacentHTML("afterbegin", html);
    } else {
        showEmptyMessage(
            allMatches.length === 0
                ? "لا توجد مباريات متاحة حاليًا."
                : "لا توجد مباريات تطابق اختيارك."
        );
    }

    if (todayDate) {
        const now = new Date();

        todayDate.textContent = `مباريات اليوم - ${new Intl.DateTimeFormat("ar-EG", {
            day: "numeric",
            month: "long",
            timeZone: "Africa/Cairo"
        }).format(now)}`;
    }

    updateTicker();
}

function updateTicker() {
    if (!tickerMessage) return;

    const liveMatches = allMatches.filter(
        (match) => match.status === "live"
    );

    if (liveMatches.length > 0) {
        tickerMessage.textContent = liveMatches
            .slice(0, 3)
            .map((match) =>
                `${match.home} ${formatScore(match.homeScore)} - ${formatScore(match.awayScore)} ${match.away}`
            )
            .join(" | ");
    } else {
        tickerMessage.textContent =
            "أهلاً بيك في ST7 — لا توجد مباريات مباشرة حسب البيانات المتاحة حاليًا";
    }
}

async function loadMatches() {
    if (isLoading) return;

    isLoading = true;

    try {
        if (allMatches.length === 0) {
            showEmptyMessage("جاري تحميل بيانات المباريات...");
        }

        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`خطأ في السيرفر: ${response.status}`);
        }

        const data = await response.json();

        // يدعم شكل { matches: [...] } أو مصفوفة مباشرة
        const matchesData = Array.isArray(data)
            ? data
            : data.matches ?? data.matchesToday ?? data.data;

        if (!Array.isArray(matchesData)) {
            console.error("ST7: صيغة البيانات غير متوقعة:", data);
            throw new Error("الـ API لا يرجع قائمة مباريات بالشكل المتوقع.");
        }

        allMatches = matchesData.map(normalizeMatch);

        const order = {
            live: 0,
            upcoming: 1,
            finished: 2,
            other: 3
        };

        allMatches.sort((a, b) => {
            const difference = order[a.status] - order[b.status];

            if (difference !== 0) return difference;

            return new Date(a.utcDate || 0) - new Date(b.utcDate || 0);
        });

        renderMatches();

        console.log(`ST7: تم تحميل ${allMatches.length} مباراة.`);
    } catch (error) {
        console.error("ST7 matches error:", error);

        if (allMatches.length === 0) {
            showEmptyMessage(
                "تعذر تحميل المباريات. تأكد أن Python Backend يعمل وأن رابط الـ API صحيح."
            );
        }

        if (tickerMessage && allMatches.length === 0) {
            tickerMessage.textContent =
                "تعذر الاتصال بسيرفر المباريات حاليًا";
        }
    } finally {
        isLoading = false;
    }
}

// الفلاتر
const matchFilters =
    $("#matchFilters") ||
    $(".filter-buttons") ||
    $(".filters");

if (matchFilters) {
    matchFilters.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");

        if (!button) return;

        activeFilter = button.dataset.filter || "all";

        matchFilters.querySelectorAll("[data-filter]").forEach((filter) => {
            filter.classList.toggle("active", filter === button);
        });

        renderMatches();
    });
}

// البحث
if (searchToggle && searchBox) {
    searchToggle.addEventListener("click", () => {
        searchBox.classList.toggle("show");

        if (searchBox.classList.contains("show")) {
            searchInput?.focus();
        }
    });
}

if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        searchTerm = searchInput.value.trim();
        renderMatches();
        $("#matches")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    searchInput.addEventListener("input", () => {
        searchTerm = searchInput.value.trim();
        renderMatches();
    });
}

if (clearSearch && searchInput) {
    clearSearch.addEventListener("click", () => {
        searchInput.value = "";
        searchTerm = "";
        renderMatches();
        searchInput.focus();
    });
}

// قائمة الموبايل
if (menuToggle && navbar) {
    menuToggle.addEventListener("click", () => {
        navbar.classList.toggle("show");

        const isOpen = navbar.classList.contains("show");

        menuToggle.setAttribute("aria-expanded", String(isOpen));

        menuToggle.innerHTML = isOpen
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
    });

    navbar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navbar.classList.remove("show");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        });
    });
}

// الروابط النشطة
document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((item) => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});

// زر العودة للأعلى
window.addEventListener("scroll", () => {
    if (backToTop) {
        backToTop.classList.toggle("show", window.scrollY > 450);
    }
});

if (backToTop) {
    backToTop.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}

// السنة الحالية
if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

// بدء التشغيل والتحديث التلقائي
document.addEventListener("DOMContentLoaded", () => {
    loadMatches();
    window.setInterval(loadMatches, REFRESH_INTERVAL);
});

// ===== Загрузка и рендер контента из /api/content =====
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

async function loadContent() {
    try {
        const res = await fetch('/api/content');
        const data = await res.json();
        render(data);
    } catch (e) {
        console.error('Не удалось загрузить контент сайта', e);
    }
}

function render(data) {
    if (data.hero) {
        document.getElementById('heroTitle').innerHTML = nl2br(data.hero.title);
        document.getElementById('heroSubtitle').textContent = data.hero.subtitle || '';
    }
    if (Array.isArray(data.about)) {
        document.getElementById('aboutText').innerHTML = data.about.map(p => `<p>${esc(p)}</p>`).join('');
    }
    if (data.about_image) {
        document.getElementById('aboutImage').src = data.about_image;
    }
    if (Array.isArray(data.history_timeline)) {
        document.getElementById('historyTimeline').innerHTML = data.history_timeline.map(item => `
            <div class="timeline-item"><div class="timeline-content"><div class="timeline-date"><i class="fas ${esc(item.icon || 'fa-star')}"></i> ${esc(item.date)}</div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></div>
        `).join('');
    }
    if (Array.isArray(data.history_achievements)) {
        document.getElementById('historyAchievements').innerHTML = data.history_achievements.map(item => `
            <div class="card"><div class="card-content" style="padding-top: 2rem;"><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></div>
        `).join('');
    }
    if (Array.isArray(data.history_gallery)) {
        document.getElementById('historyGallery').innerHTML = data.history_gallery.map(item => `
            <div class="card"><div class="card-content" style="padding-top: 2rem;"><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></div>
        `).join('');
    }
    if (Array.isArray(data.best_members)) {
        document.getElementById('bestMembers').innerHTML = data.best_members.map(m => `
            <div class="card" style="display: flex; flex-direction: column; height: 100%;">
                <div class="card-img" style="height: 400px; flex-shrink: 0;">
                    <img src="${esc(m.photo)}" alt="${esc(m.name)}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;" loading="lazy">
                </div>
                <div class="card-content" style="flex: 1; display: flex; flex-direction: column;">
                    <h3>${esc(m.name)}</h3>
                    <div class="card-role">${esc(m.role)}</div>
                    <p>${esc(m.bio)}</p>
                    <div class="achievements-list" style="margin-top: auto;">
                        <h4>Достижения:</h4>
                        <ul>${(m.achievements || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        `).join('');
    }
    if (Array.isArray(data.activities)) {
        document.getElementById('activitiesList').innerHTML = data.activities.map(a => `
            <div class="card"><div class="card-content" style="padding-top: 2.5rem; text-align: center;"><i class="fas ${esc(a.icon || 'fa-star')}" style="font-size: 3rem; color: var(--gold); margin-bottom: 1rem; display: inline-block;"></i><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div></div>
        `).join('');
    }
    if (data.activities_quote) {
        document.getElementById('activitiesQuote').textContent = data.activities_quote;
    }
    if (Array.isArray(data.documents)) {
        document.getElementById('documentsList').innerHTML = data.documents.map(d => `
            <div class="card"><div class="card-img"><img src="${esc(d.image)}" alt="Документ" loading="lazy"></div><div class="card-content"><p>${esc(d.desc)}</p><div class="document-meta"><i class="fas fa-calendar"></i> ${esc(d.date)} &nbsp; <i class="fas fa-file-alt"></i> ${esc(d.size)}</div><a href="${esc(d.file)}" class="btn" style="padding:8px 20px; font-size:0.85rem" download><i class="fas fa-download"></i> Скачать</a></div></div>
        `).join('');
    }
    if (data.contact) {
        document.getElementById('emailAddress').textContent = data.contact.email || '';
        document.getElementById('contactAddress').innerHTML = nl2br(data.contact.address);
        document.getElementById('contactHours').textContent = data.contact.hours || '';
        document.getElementById('contactChairman').textContent = data.contact.chairman || '';
    }
}

loadContent();

// ===== Навигация и интерактив (логика оригинального сайта) =====
document.getElementById('currentYear').textContent = new Date().getFullYear();

const pageNames = {
    home: 'Главная',
    history: 'История',
    'best-members': 'Лучшие кадеты',
    activities: 'Деятельность',
    documents: 'Документы',
    contact: 'Контакты'
};
function updateBreadcrumbs(pageId) {
    const container = document.getElementById('breadcrumbsContainer');
    if (!container) return;
    const name = pageNames[pageId] || 'Страница';
    container.innerHTML = `<div class="breadcrumbs"><a href="#" data-page="home">Главная</a> / <span>${name}</span></div>`;
    const homeLink = container.querySelector('a');
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage('home', document.querySelector('.mobile-nav-link[data-page="home"]'));
        });
    }
}

const burgerBtn = document.getElementById('burgerBtn');
const mobileNav = document.getElementById('mobileNav');
const menuOverlay = document.getElementById('menuOverlay');
const body = document.body;

function closeMenu() {
    mobileNav.classList.remove('active');
    menuOverlay.classList.remove('active');
    burgerBtn.classList.remove('active');
    burgerBtn.setAttribute('aria-expanded', 'false');
    body.classList.remove('menu-open');
}
function openMenu() {
    mobileNav.classList.add('active');
    menuOverlay.classList.add('active');
    burgerBtn.classList.add('active');
    burgerBtn.setAttribute('aria-expanded', 'true');
    body.classList.add('menu-open');
}
burgerBtn.addEventListener('click', () => {
    mobileNav.classList.contains('active') ? closeMenu() : openMenu();
});
menuOverlay.addEventListener('click', closeMenu);

let touchStartX = 0;
mobileNav.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});
mobileNav.addEventListener('touchmove', (e) => {
    const touchEndX = e.touches[0].clientX;
    if (touchEndX - touchStartX > 50 && mobileNav.classList.contains('active')) {
        closeMenu();
    }
});

const navLinks = document.querySelectorAll('.mobile-nav-link, .footer-nav-link');
const pages = document.querySelectorAll('.page');
function switchPage(pageId, activeElement) {
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.mobile-nav-link').forEach(l => l.classList.remove('active'));
    if (activeElement && activeElement.classList && activeElement.classList.contains('mobile-nav-link')) {
        activeElement.classList.add('active');
    }
    updateBreadcrumbs(pageId);
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        switchPage(this.getAttribute('data-page'), this);
    });
});
document.getElementById('learn-more-btn')?.addEventListener('click', () => {
    switchPage('history', document.querySelector('.mobile-nav-link[data-page="history"]'));
});

const activePage = document.querySelector('.page.active')?.id || 'home';
updateBreadcrumbs(activePage);

const form = document.getElementById('contactForm');
if (form) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const status = document.createElement('div');
        status.style.cssText = 'margin-top:1rem; padding:0.8rem; border-radius:12px; text-align:center; background:rgba(255,184,28,0.2);';
        form.appendChild(status);
        const data = new FormData(form);
        try {
            const res = await fetch(form.action, { method: form.method, body: data, headers: { 'Accept': 'application/json' } });
            if (res.ok) { status.innerHTML = '✓ Сообщение отправлено!'; status.style.border = '1px solid #2E7D32'; form.reset(); setTimeout(() => status.remove(), 4000); }
            else throw new Error();
        } catch { status.innerHTML = '✗ Ошибка отправки'; status.style.border = '1px solid #d32f2f'; setTimeout(() => status.remove(), 4000); }
    });
}

function showToast(message) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2500);
}

const _emailCardEl = document.getElementById('emailCard');
if (_emailCardEl) _emailCardEl.style.cursor = 'pointer';

document.addEventListener('click', (e) => {
    const emailCard = document.getElementById('emailCard');
    if (emailCard && (e.target === emailCard || emailCard.contains(e.target))) {
        const emailText = document.getElementById('emailAddress')?.innerText;
        if (!emailText) return;
        navigator.clipboard.writeText(emailText).then(() => {
            showToast('✉️ Email скопирован!');
        }).catch(() => {
            showToast('❌ Ошибка копирования');
        });
    }
});

const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        scrollBtn.classList.add('show');
    } else {
        scrollBtn.classList.remove('show');
    }
});
scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

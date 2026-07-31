// ===== API helpers =====
async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((body && body.error) || `Ошибка ${res.status}`);
    return body;
}
async function getContent(key) { return api(`/api/admin/content/${key}`); }
async function putContent(key, value) {
    return api(`/api/admin/content/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
}
async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Ошибка загрузки');
    return body.url;
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function statusMsg(el, text, ok) {
    el.textContent = text;
    el.className = 'status-msg ' + (ok ? 'ok' : 'err');
    if (ok) setTimeout(() => { el.textContent = ''; }, 3000);
}

// ===== Auth =====
const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');

async function checkAuth() {
    try {
        const me = await api('/api/admin/me');
        document.getElementById('whoami').textContent = me.username;
        loginScreen.style.display = 'none';
        appEl.style.display = 'block';
        loadTab('hero');
    } catch {
        loginScreen.style.display = 'block';
        appEl.style.display = 'none';
    }
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginErr');
    errEl.textContent = '';
    try {
        await api('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        checkAuth();
    } catch (e) {
        errEl.textContent = e.message;
    }
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    checkAuth();
});

checkAuth();

// ===== Tabs =====
const tabContent = document.getElementById('tabContent');
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTab(btn.dataset.tab);
    });
});

async function loadTab(tab) {
    tabContent.innerHTML = '<p>Загрузка…</p>';
    try {
        if (tab === 'hero') await renderHero();
        else if (tab === 'history') await renderHistory();
        else if (tab === 'best_members') await renderBestMembers();
        else if (tab === 'activities') await renderActivities();
        else if (tab === 'documents') await renderDocuments();
        else if (tab === 'contact') await renderContact();
        else if (tab === 'password') renderPassword();
    } catch (e) {
        tabContent.innerHTML = `<div class="panel">Ошибка загрузки: ${esc(e.message)}</div>`;
    }
}

function panel(title, innerHtml) {
    return `<div class="panel"><h3>${title}</h3>${innerHtml}</div>`;
}
function saveRow(id) {
    return `<div class="save-row"><button class="btn" id="${id}-save">Сохранить</button><span class="status-msg" id="${id}-status"></span></div>`;
}

// ===== Главная (hero + about) =====
async function renderHero() {
    const hero = await getContent('hero');
    const about = await getContent('about');
    const aboutImage = await getContent('about_image');
    tabContent.innerHTML =
        panel('Главный баннер', `
            <label>Заголовок (можно перенос строки)</label>
            <textarea id="hero-title">${esc(hero.title)}</textarea>
            <label>Подзаголовок</label>
            <input type="text" id="hero-subtitle" value="${esc(hero.subtitle)}">
            ${saveRow('hero')}
        `) +
        panel('Раздел «О Кадетском Парламенте»', `
            <label>Абзацы текста (каждый с новой строки, пустая строка = новый абзац)</label>
            <textarea id="about-text" style="min-height:180px">${esc(about.join('\n\n'))}</textarea>
            <label>Фото рядом с текстом</label>
            <div class="upload-row">
                <img class="image-preview" id="about-image-preview" src="${esc(aboutImage)}" onerror="this.style.display='none'">
                <input type="file" id="about-image-file" accept="image/*">
            </div>
            ${saveRow('about')}
        `);

    document.getElementById('hero-save').addEventListener('click', async () => {
        const el = document.getElementById('hero-status');
        try {
            await putContent('hero', {
                title: document.getElementById('hero-title').value,
                subtitle: document.getElementById('hero-subtitle').value,
            });
            statusMsg(el, '✓ Сохранено', true);
        } catch (e) { statusMsg(el, e.message, false); }
    });

    document.getElementById('about-save').addEventListener('click', async () => {
        const el = document.getElementById('about-status');
        try {
            let imgUrl = aboutImage;
            const file = document.getElementById('about-image-file').files[0];
            if (file) imgUrl = await uploadFile(file);
            const paragraphs = document.getElementById('about-text').value
                .split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
            await putContent('about', paragraphs);
            await putContent('about_image', imgUrl);
            statusMsg(el, '✓ Сохранено', true);
        } catch (e) { statusMsg(el, e.message, false); }
    });
}

// ===== История =====
async function renderHistory() {
    const timeline = await getContent('history_timeline');
    const achievements = await getContent('history_achievements');
    const gallery = await getContent('history_gallery');

    tabContent.innerHTML =
        panel('Хронология (таймлайн)', `<div id="timeline-items"></div><button class="btn secondary add-btn" id="timeline-add">+ Добавить событие</button>${saveRow('timeline')}`) +
        panel('Достижения за годы работы', `<div id="achievements-items"></div><button class="btn secondary add-btn" id="achievements-add">+ Добавить карточку</button>${saveRow('achievements')}`) +
        panel('Галерея достижений', `<div id="gallery-items"></div><button class="btn secondary add-btn" id="gallery-add">+ Добавить карточку</button>${saveRow('gallery')}`);

    setupSimpleListEditor('timeline-items', timeline, item => `
        <label>Дата / период</label><input type="text" class="f-date" value="${esc(item.date)}">
        <label>Иконка Font Awesome (напр. fa-star)</label><input type="text" class="f-icon" value="${esc(item.icon)}">
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(item.title)}">
        <label>Текст</label><textarea class="f-text">${esc(item.text)}</textarea>
    `, () => ({ date: '', icon: 'fa-star', title: '', text: '' }));
    document.getElementById('timeline-add').addEventListener('click', () => addSimpleItem('timeline-items', { date: '', icon: 'fa-star', title: '', text: '' }, timelineItemHtml));
    document.getElementById('timeline-save').addEventListener('click', () => saveSimpleList('timeline-items', 'history_timeline', ['date', 'icon', 'title', 'text'], 'timeline-status'));

    setupSimpleListEditor('achievements-items', achievements, item => `
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(item.title)}">
        <label>Текст</label><textarea class="f-text">${esc(item.text)}</textarea>
    `);
    document.getElementById('achievements-add').addEventListener('click', () => addSimpleItem('achievements-items', { title: '', text: '' }, achievementItemHtml));
    document.getElementById('achievements-save').addEventListener('click', () => saveSimpleList('achievements-items', 'history_achievements', ['title', 'text'], 'achievements-status'));

    setupSimpleListEditor('gallery-items', gallery, item => `
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(item.title)}">
        <label>Текст</label><textarea class="f-text">${esc(item.text)}</textarea>
    `);
    document.getElementById('gallery-add').addEventListener('click', () => addSimpleItem('gallery-items', { title: '', text: '' }, achievementItemHtml));
    document.getElementById('gallery-save').addEventListener('click', () => saveSimpleList('gallery-items', 'history_gallery', ['title', 'text'], 'gallery-status'));
}

function timelineItemHtml(item) {
    return `
        <label>Дата / период</label><input type="text" class="f-date" value="${esc(item.date)}">
        <label>Иконка Font Awesome (напр. fa-star)</label><input type="text" class="f-icon" value="${esc(item.icon)}">
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(item.title)}">
        <label>Текст</label><textarea class="f-text">${esc(item.text)}</textarea>
    `;
}
function achievementItemHtml(item) {
    return `
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(item.title)}">
        <label>Текст</label><textarea class="f-text">${esc(item.text)}</textarea>
    `;
}

// Generic helper: render a list of items into a container, each removable.
function setupSimpleListEditor(containerId, items, itemHtmlFn) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach(item => addItemCard(container, itemHtmlFn(item)));
}
function addItemCard(container, innerHtml) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `<button type="button" class="remove-btn" title="Удалить">✕</button>${innerHtml}`;
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove());
    container.appendChild(card);
}
function addSimpleItem(containerId, emptyItem, itemHtmlFn) {
    const container = document.getElementById(containerId);
    addItemCard(container, itemHtmlFn(emptyItem));
}
async function saveSimpleList(containerId, key, fields, statusId) {
    const container = document.getElementById(containerId);
    const statusEl = document.getElementById(statusId);
    try {
        const items = Array.from(container.children).map(card => {
            const obj = {};
            fields.forEach(f => {
                const input = card.querySelector('.f-' + f);
                obj[f] = input ? input.value : '';
            });
            return obj;
        });
        await putContent(key, items);
        statusMsg(statusEl, '✓ Сохранено', true);
    } catch (e) { statusMsg(statusEl, e.message, false); }
}

// ===== Лучшие кадеты =====
async function renderBestMembers() {
    const members = await getContent('best_members');
    tabContent.innerHTML = panel('Лучшие кадеты', `<div id="members-items"></div><button class="btn secondary add-btn" id="members-add">+ Добавить кадета</button>${saveRow('members')}`);
    const container = document.getElementById('members-items');
    container.innerHTML = '';
    members.forEach(m => addItemCard(container, memberItemHtml(m)));

    document.getElementById('members-add').addEventListener('click', () => {
        addItemCard(container, memberItemHtml({ name: '', photo: '', role: '', bio: '', achievements: [] }));
    });

    document.getElementById('members-save').addEventListener('click', async () => {
        const statusEl = document.getElementById('members-status');
        try {
            const items = [];
            for (const card of Array.from(container.children)) {
                let photo = card.querySelector('.f-photo-url').value;
                const file = card.querySelector('.f-photo-file').files[0];
                if (file) photo = await uploadFile(file);
                items.push({
                    name: card.querySelector('.f-name').value,
                    photo,
                    role: card.querySelector('.f-role').value,
                    bio: card.querySelector('.f-bio').value,
                    achievements: card.querySelector('.f-achievements').value.split('\n').map(s => s.trim()).filter(Boolean),
                });
            }
            await putContent('best_members', items);
            statusMsg(statusEl, '✓ Сохранено', true);
        } catch (e) { statusMsg(statusEl, e.message, false); }
    });
}
function memberItemHtml(m) {
    return `
        <label>Фото</label>
        <div class="upload-row">
            <img class="image-preview f-photo-preview" src="${esc(m.photo)}" onerror="this.style.display='none'">
            <input type="file" class="f-photo-file" accept="image/*">
        </div>
        <input type="hidden" class="f-photo-url" value="${esc(m.photo)}">
        <label>ФИО</label><input type="text" class="f-name" value="${esc(m.name)}">
        <label>Должность / роль</label><input type="text" class="f-role" value="${esc(m.role)}">
        <label>Краткая биография</label><textarea class="f-bio">${esc(m.bio)}</textarea>
        <label>Достижения (каждое с новой строки)</label>
        <textarea class="f-achievements achievements-editor">${esc((m.achievements || []).join('\n'))}</textarea>
    `;
}

// ===== Деятельность =====
async function renderActivities() {
    const activities = await getContent('activities');
    const quote = await getContent('activities_quote');
    tabContent.innerHTML =
        panel('Направления деятельности', `<div id="activities-items"></div><button class="btn secondary add-btn" id="activities-add">+ Добавить направление</button>${saveRow('activities')}`) +
        panel('Цитата', `<label>Текст цитаты</label><textarea id="quote-text">${esc(quote)}</textarea>${saveRow('quote')}`);

    const container = document.getElementById('activities-items');
    container.innerHTML = '';
    activities.forEach(a => addItemCard(container, activityItemHtml(a)));
    document.getElementById('activities-add').addEventListener('click', () => addItemCard(container, activityItemHtml({ icon: 'fa-star', title: '', text: '' })));
    document.getElementById('activities-save').addEventListener('click', () => saveSimpleListGeneric(container, 'activities', ['icon', 'title', 'text'], 'activities-status'));

    document.getElementById('quote-save').addEventListener('click', async () => {
        const el = document.getElementById('quote-status');
        try {
            await putContent('activities_quote', document.getElementById('quote-text').value);
            statusMsg(el, '✓ Сохранено', true);
        } catch (e) { statusMsg(el, e.message, false); }
    });
}
function activityItemHtml(a) {
    return `
        <label>Иконка Font Awesome (напр. fa-book-open)</label><input type="text" class="f-icon" value="${esc(a.icon)}">
        <label>Заголовок</label><input type="text" class="f-title" value="${esc(a.title)}">
        <label>Текст</label><textarea class="f-text">${esc(a.text)}</textarea>
    `;
}
async function saveSimpleListGeneric(container, key, fields, statusId) {
    const statusEl = document.getElementById(statusId);
    try {
        const items = Array.from(container.children).map(card => {
            const obj = {};
            fields.forEach(f => { const inp = card.querySelector('.f-' + f); obj[f] = inp ? inp.value : ''; });
            return obj;
        });
        await putContent(key, items);
        statusMsg(statusEl, '✓ Сохранено', true);
    } catch (e) { statusMsg(statusEl, e.message, false); }
}

// ===== Документы =====
async function renderDocuments() {
    const docs = await getContent('documents');
    tabContent.innerHTML = panel('Документы', `<div id="documents-items"></div><button class="btn secondary add-btn" id="documents-add">+ Добавить документ</button>${saveRow('documents')}`);
    const container = document.getElementById('documents-items');
    container.innerHTML = '';
    docs.forEach(d => addItemCard(container, documentItemHtml(d)));
    document.getElementById('documents-add').addEventListener('click', () => addItemCard(container, documentItemHtml({ category: 'Уставные документы', image: '', file: '', desc: '', date: '', size: '' })));

    document.getElementById('documents-save').addEventListener('click', async () => {
        const statusEl = document.getElementById('documents-status');
        try {
            const items = [];
            for (const card of Array.from(container.children)) {
                let image = card.querySelector('.f-image-url').value;
                const imageFile = card.querySelector('.f-image-file').files[0];
                if (imageFile) image = await uploadFile(imageFile);
                let file = card.querySelector('.f-file-url').value;
                const docFile = card.querySelector('.f-file-file').files[0];
                if (docFile) file = await uploadFile(docFile);
                items.push({
                    category: card.querySelector('.f-category').value,
                    image, file,
                    desc: card.querySelector('.f-desc').value,
                    date: card.querySelector('.f-date').value,
                    size: card.querySelector('.f-size').value,
                });
            }
            await putContent('documents', items);
            statusMsg(statusEl, '✓ Сохранено', true);
        } catch (e) { statusMsg(statusEl, e.message, false); }
    });
}
function documentItemHtml(d) {
    return `
        <label>Категория</label><input type="text" class="f-category" value="${esc(d.category)}">
        <label>Обложка (изображение)</label>
        <div class="upload-row">
            <img class="image-preview" src="${esc(d.image)}" onerror="this.style.display='none'">
            <input type="file" class="f-image-file" accept="image/*">
        </div>
        <input type="hidden" class="f-image-url" value="${esc(d.image)}">
        <label>Файл документа (.doc/.docx/.pdf)</label>
        <div class="upload-row">
            ${d.file ? `<a href="${esc(d.file)}" target="_blank">Текущий файл ↗</a>` : '<span class="hint">файл не загружен</span>'}
            <input type="file" class="f-file-file" accept=".doc,.docx,.pdf">
        </div>
        <input type="hidden" class="f-file-url" value="${esc(d.file)}">
        <label>Описание</label><textarea class="f-desc">${esc(d.desc)}</textarea>
        <label>Дата</label><input type="text" class="f-date" value="${esc(d.date)}">
        <label>Размер / тип файла (напр. DOC 22.8 КБ)</label><input type="text" class="f-size" value="${esc(d.size)}">
    `;
}

// ===== Контакты =====
async function renderContact() {
    const c = await getContent('contact');
    tabContent.innerHTML = panel('Контактная информация', `
        <label>Email</label><input type="text" id="c-email" value="${esc(c.email)}">
        <label>Адрес</label><textarea id="c-address">${esc(c.address)}</textarea>
        <label>Время работы</label><input type="text" id="c-hours" value="${esc(c.hours)}">
        <label>Председатель</label><input type="text" id="c-chairman" value="${esc(c.chairman)}">
        ${saveRow('contact')}
    `);
    document.getElementById('contact-save').addEventListener('click', async () => {
        const el = document.getElementById('contact-status');
        try {
            await putContent('contact', {
                email: document.getElementById('c-email').value,
                address: document.getElementById('c-address').value,
                hours: document.getElementById('c-hours').value,
                chairman: document.getElementById('c-chairman').value,
            });
            statusMsg(el, '✓ Сохранено', true);
        } catch (e) { statusMsg(el, e.message, false); }
    });
}

// ===== Смена пароля =====
function renderPassword() {
    tabContent.innerHTML = panel('Смена пароля', `
        <label>Текущий пароль</label><input type="password" id="p-old">
        <label>Новый пароль (мин. 6 символов)</label><input type="password" id="p-new">
        ${saveRow('pass')}
    `);
    document.getElementById('pass-save').addEventListener('click', async () => {
        const el = document.getElementById('pass-status');
        try {
            await api('/api/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    old_password: document.getElementById('p-old').value,
                    new_password: document.getElementById('p-new').value,
                }),
            });
            statusMsg(el, '✓ Пароль изменён', true);
            document.getElementById('p-old').value = '';
            document.getElementById('p-new').value = '';
        } catch (e) { statusMsg(el, e.message, false); }
    });
}

package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var db *sql.DB

const sessionCookie = "kmkk_session"
const sessionTTL = 7 * 24 * time.Hour

// ---------- DB setup ----------

func initDB(path string) {
	var err error
	db, err = sql.Open("sqlite", path)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	schema := `
	CREATE TABLE IF NOT EXISTS content (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS admin_users (
		username TEXT PRIMARY KEY,
		password_hash TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	seedAdmin()
	seedContent()
}

func seedAdmin() {
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM admin_users`).Scan(&count)
	if count > 0 {
		return
	}
	user := os.Getenv("ADMIN_USER")
	if user == "" {
		user = "admin"
	}
	pass := os.Getenv("ADMIN_PASSWORD")
	if pass == "" {
		pass = "changeme123"
		log.Printf("WARNING: ADMIN_PASSWORD env var not set. Using default password %q for user %q. Set ADMIN_PASSWORD in Railway variables and restart.", pass, user)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}
	_, err = db.Exec(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`, user, string(hash))
	if err != nil {
		log.Fatalf("seed admin: %v", err)
	}
	log.Printf("Created admin user %q", user)
}

// defaultContent seeds the site with the real text migrated from the old static index.html
func defaultContent() map[string]any {
	return map[string]any{
		"hero": map[string]any{
			"title":    "Кадетский Парламент\nКанского Морского Кадетского Корпуса",
			"subtitle": "Орган ученического самоуправления, развивающий лидерские качества кадет",
		},
		"about": []string{
			"Кадетский Парламент - законодательный и представительный орган ученического самоуправления Канского Морского Кадетского Корпуса. Он олицетворяет собой принципы чести, долга, справедливости и коллективной ответственности, служа фундаментом для развития кадетской демократии и формирования подлинного корпоративного духа.",
			"Основанный на принципах всеобщего, равного и прямого избирательного права при тайном голосовании, Кадетский Парламент формируется путём подсчета общего количества голосов за каждого из кандидатов. Таким образом, в его состав попадают самые достойные представители корпуса — кадеты, чьи лидерские качества, активная гражданская позиция, безупречная репутация и преданность идеалам снискали всеобщее уважение и доверие.",
			"Это — не только орган управления, но и кузница будущих руководителей. В его стенах на практике постигаются азы правовой культуры, стратегического планирования, искусства переговоров и коллективного принятия решений.",
		},
		"about_image": "/uploads/kadetsky.jpg",
		"history_timeline": []map[string]string{
			{"date": "2022 год - Осень", "icon": "fa-leaf", "title": "Создание Кадетского Парламента", "text": "Реформирование бывшего органа ученического самоуправления КСоЛД в Кадетский Парламент кадетом 9-ого класса, Каверзиным Иваном Игоревичом. Первые выборы Председателя и членов Кадетского Парламента."},
			{"date": "2022 год - Зима", "icon": "fa-snowflake", "title": "Первые крупные изменения", "text": "Организация первых масштабных мероприятий, создание Положения о Кадетском Парламенте, формирование состава Кадетского Парламента, начало работы."},
			{"date": "2022 год - Весна", "icon": "fa-seedling", "title": "Первые результаты", "text": "Завершение года, подведение итогов и выявление лучших по истечению периода. Подача отчетов Директору корпуса."},
			{"date": "2023 год - Осень", "icon": "fa-handshake", "title": "Межкорпусное сотрудничество", "text": "Налаживание партнерских отношений с кадетскими парламентами других корпусов, проведение совместных онлайн - встреч и обмен опытом."},
			{"date": "2023 год - Весна", "icon": "fa-trophy", "title": "Окончание срока Первого Председателя", "text": "Награждение похвальными грамотами и орденами \"Военно - Морской Флот\"."},
			{"date": "2025 год - Осень", "icon": "fa-globe", "title": "Создание первого сайта Кадетского Парламента", "text": "Развитие в цифровой сфере для увеличения массовой известности в кругах корпуса, города и края."},
		},
		"history_achievements": []map[string]string{
			{"title": "Награды", "text": "За активную работу на корпусном уровне, первый Председатель и Вице-Председатель Кадетского Парламента были удостоены Высшей Награды Кадетского Парламента, ордена \"Военно-Морской Флот\", а также Благодарственной Грамоты от Директора Корпуса."},
			{"title": "Участники", "text": "Более 40 кадет приняли участие в работе Кадетского Парламента за всю историю его существования, активно развивая Орган на корпусном уровне и проявляя инициативу в развитии отношений между кадетами и администрацией."},
			{"title": "Проекты", "text": "Под руководством Кадетского Парламента в 2025-ом учебном году было положено начало разработке проекта \"Каток\" для облагораживания и продуктивной эксплуатации прилегающей к корпусу территории."},
		},
		"history_gallery": []map[string]string{
			{"title": "Награды наших кадет", "text": "За последние 3 года кадеты Кадетского Парламента получили более 70 наград, участвуя в олимпиадах, соревнованиях и конкурсах различных уровней (от муниципального до международного)."},
			{"title": "Выпускники-медалисты", "text": "2 выпускника-члена Кадетского Парламента закончили корпус с золотыми медалями за последние 3 года. Медалисты без проблем смогли поступить в ВУЗ-ы страны, которые выбрали изначально."},
			{"title": "Поступления в вузы", "text": "100% выпускников-членов Кадетского Парламента поступают в высшие учебные военные и гражданские заведения Российской Федерации имея запас и высокие места в рейтингах поступления."},
		},
		"best_members": []map[string]any{
			{
				"name": "Каверзин Иван Игоревич", "photo": "/uploads/van.jpg",
				"role": "Основатель и Первый Председатель Кадетского Парламента 2022-2024 учебный год",
				"bio":  "Выпускник Канского Морского Кадетского Корпуса (2024), серебряный медалист, лауреат государственных премий Союза Писателей России, за заслуги награжден Благодарственным письмом и Орденом \"Военно - Морской Флот\".",
				"achievements": []string{
					"Выступил с инициативой создания Кадетского Парламента, доказав его необходимость для развития корпуса.",
					"Лично разработал и сформировал Положение о Кадетском Парламенте — основной документ, определяющий его цели, задачи, права, обязанности и структуру.",
					"Был избран первым Председателем, что является признанием его лидерских качеств и авторитета среди кадет. На этом посту он заложил традиции работы Кадетского Парламента, наладил взаимодействие между кадетами и администрацией корпуса.",
				},
			},
			{
				"name": "Потылицын Лев Евгеньевич", "photo": "/uploads/image-29.jpg",
				"role": "Вице-Председатель Кадетского Парламента 2023-2024 учебный год",
				"bio":  "Выпускник Канского Морского Кадетского Корпуса (2024), активист Кадетского Парламента, за заслуги награжден Благодарственным письмом и Орденом \"Военно - Морской Флот\".",
				"achievements": []string{
					"Организация нового Медиационного Отдела в Отделе Дисциплины Кадетского Парламента, активный контроль дисциплины в корпусе в учебное и внеурочное время.",
					"Активное участие в организации Корпусных Мероприятий, проявление инициативы и выдвижение предложений для их организации.",
					"Помощь в разработке Положения о Кадетском Парламенте, инициатива создания поощрительной меры стимулирования (орден \"Военно - Морской Флот\"), особый вклад в развитие дисциплинарного отдела Кадетского Парламента, безупречное ведение работы на посту Министра Отдела Дисциплины.",
				},
			},
			{
				"name": "Лавров Сергей", "photo": "/uploads/1774626280331.jpg",
				"role": "Активист Кадетского Парламента, ведущий Корпусных мероприятий, хорошист.",
				"bio":  "Кадет 8-ого класса (2025-2026), И.О. Председателя Кадетского Парламента (2025-2026).",
				"achievements": []string{
					"На протяжении двух лет активно участвует в организации корпусных мероприятий, также ведет мероприятия, посвященные знаменательным датам и открытиям Аллей Памяти по приглашению от города Канска.",
					"Активный член Кадетского Парламента, вступивший в год основания. Проявляет инициативу в делах Органа, за что был удостоен высокой должности \"Исполняющий Обязанности Председателя Кадетского Парламента\".",
					"Служит примером для младших товарищей, участвует в подготовке вновь прибывших обучающихся пятого класса к принятию Кадетской Клятвы, уча пятиклассников элементам строевой подготовки и нравственным принципам кадетской жизни, создавая важную базу для будущего обучения пятиклассников в Кадетском Корпусе.",
				},
			},
			{
				"name": "Жданов Дмитрий Иванович", "photo": "/uploads/1000067026.jpg",
				"role": "Председатель Кадетского Парламента 2025-2026 учебный год",
				"bio":  "Кадет 11 класса, выпускник. Номинант литературных премий Российского Союза Писателей, поэт и прозаик.",
				"achievements": []string{
					"Внёс важные поправки в нормативные документы, что позволило сделать работу Парламента более структурированной и соответствующей принципам кадетской демократии.",
					"Дал начало информационно-коммуникативной цепи Кадетского Парламента, значительно улучшив внутреннее и внешнее взаимодействие, освещение мероприятий и обратную связь с кадетами корпуса.",
					"Привнёс огромные изменения в организацию работы Парламента, повысив дисциплину, ответственность и вовлечённость членов в деятельность органа.",
				},
			},
		},
		"activities": []map[string]string{
			{"icon": "fa-book-open", "title": "Учебная подготовка", "text": "Проверка учебников, помощь отстающим кадетам в повышении успеваемости путем объяснения пропущенного или непонимаемого материала."},
			{"icon": "fa-handshake", "title": "Внутренняя работа", "text": "Решение конфликтов между кадетами, работа по соблюдению порядка во время учебного процесса, помощь кадетам в строевой подготовке."},
			{"icon": "fa-flag-checkered", "title": "Патриотические мероприятия", "text": "Организация мероприятий, направленных на формирование любви к Родине и уважения к флотским традициям. Проведение уроков мужества, встреч с ветеранами."},
		},
		"activities_quote": "«Мы не просто выполняем обязанности — мы формируем будущее кадетского братства. Каждый наш шаг направлен на развитие, дисциплину и честь»",
		"documents": []map[string]string{
			{"category": "Уставные документы", "image": "/uploads/5.jpg", "file": "/uploads/5.doc", "desc": "Основной документ, определяющий цели, задачи, права, обязанности и структуру Кадетского Парламента.", "date": "27.03.2026", "size": "DOC 22.8 КБ"},
			{"category": "Уставные документы", "image": "/uploads/4.jpg", "file": "/uploads/4.doc", "desc": "Документ, регламентирующий структуру, функции, права и обязанности каждого отдела Кадетского Парламента.", "date": "27.03.2026", "size": "DOC 21.5 КБ"},
			{"category": "Уставные документы", "image": "/uploads/6.jpg", "file": "/uploads/3.doc", "desc": "Официальный бланк для тайного голосования при выборах Председателя и состава Кадетского Парламента.", "date": "27.03.2026", "size": "DOC 18 КБ"},
			{"category": "Уставные документы", "image": "/uploads/1.jpg", "file": "/uploads/2.doc", "desc": "Официальный бланк для выдвижения кандидата и его регистрации на выборах в Кадетский Парламент.", "date": "27.03.2026", "size": "DOC 16 КБ"},
			{"category": "Уставные документы", "image": "/uploads/2.jpg", "file": "/uploads/1.doc", "desc": "Документ, определяющий порядок выдвижения кандидатов, проведения голосования и подведения итогов выборов в Кадетский Парламент.", "date": "27.03.2026", "size": "DOC 21 КБ"},
			{"category": "Уставные документы", "image": "/uploads/3.jpg", "file": "/uploads/7.doc", "desc": "Документ, устанавливающий требования к кандидатам для допуска к участию в выборах и деятельности Кадетского Парламента.", "date": "27.03.2026", "size": "DOC 20 КБ"},
		},
		"contact": map[string]string{
			"email":    "Fo8983@yandex.ru",
			"address":  "Канский Морской Кадетский Корпус, ул. Герцена 11, г.Канск, Красноярский край, Россия",
			"hours":    "Пн-Вс: 8:00 - 21:00",
			"chairman": "Жданов Дмитрий Иванович",
		},
	}
}

func seedContent() {
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM content`).Scan(&count)
	if count > 0 {
		return
	}
	for key, val := range defaultContent() {
		b, err := json.Marshal(val)
		if err != nil {
			log.Fatalf("marshal seed %s: %v", key, err)
		}
		if _, err := db.Exec(`INSERT INTO content (key, value) VALUES (?, ?)`, key, string(b)); err != nil {
			log.Fatalf("seed content %s: %v", key, err)
		}
	}
	log.Printf("Seeded default content (%d sections)", len(defaultContent()))
}

// ---------- helpers ----------

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("rand: %v", err)
	}
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// currentUser returns the username for a valid session cookie, or "" if unauthenticated.
func currentUser(r *http.Request) string {
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return ""
	}
	var username string
	var expiresAt int64
	err = db.QueryRow(`SELECT username, expires_at FROM sessions WHERE token = ?`, c.Value).Scan(&username, &expiresAt)
	if err != nil {
		return ""
	}
	if time.Now().Unix() > expiresAt {
		db.Exec(`DELETE FROM sessions WHERE token = ?`, c.Value)
		return ""
	}
	return username
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if currentUser(r) == "" {
			writeErr(w, http.StatusUnauthorized, "не авторизован")
			return
		}
		next(w, r)
	}
}

// ---------- handlers: public content ----------

func handleGetContent(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`SELECT key, value FROM content`)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	out := map[string]json.RawMessage{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			writeErr(w, 500, err.Error())
			return
		}
		out[k] = json.RawMessage(v)
	}
	writeJSON(w, 200, out)
}

// ---------- handlers: admin auth ----------

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "неверный запрос")
		return
	}
	var hash string
	err := db.QueryRow(`SELECT password_hash FROM admin_users WHERE username = ?`, body.Username).Scan(&hash)
	if err != nil {
		writeErr(w, 401, "неверный логин или пароль")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeErr(w, 401, "неверный логин или пароль")
		return
	}
	token := randomToken()
	expires := time.Now().Add(sessionTTL)
	if _, err := db.Exec(`INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)`, token, body.Username, expires.Unix()); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  expires,
	})
	writeJSON(w, 200, map[string]string{"username": body.Username})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		db.Exec(`DELETE FROM sessions WHERE token = ?`, c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1})
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if u == "" {
		writeErr(w, 401, "не авторизован")
		return
	}
	writeJSON(w, 200, map[string]string{"username": u})
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	username := currentUser(r)
	var body struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.NewPassword) < 6 {
		writeErr(w, 400, "новый пароль должен быть не короче 6 символов")
		return
	}
	var hash string
	db.QueryRow(`SELECT password_hash FROM admin_users WHERE username = ?`, username).Scan(&hash)
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.OldPassword)) != nil {
		writeErr(w, 401, "неверный текущий пароль")
		return
	}
	newHash, _ := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	db.Exec(`UPDATE admin_users SET password_hash = ? WHERE username = ?`, string(newHash), username)
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

// ---------- handlers: admin content editing ----------

var allowedKeys = map[string]bool{
	"hero": true, "about": true, "about_image": true, "history_timeline": true,
	"history_achievements": true, "history_gallery": true, "best_members": true,
	"activities": true, "activities_quote": true, "documents": true, "contact": true,
}

func handleGetContentKey(w http.ResponseWriter, r *http.Request, key string) {
	var v string
	err := db.QueryRow(`SELECT value FROM content WHERE key = ?`, key).Scan(&v)
	if err != nil {
		writeErr(w, 404, "раздел не найден")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Write([]byte(v))
}

func handlePutContentKey(w http.ResponseWriter, r *http.Request, key string) {
	if !allowedKeys[key] {
		writeErr(w, 400, "неизвестный раздел")
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, 400, "ошибка чтения тела запроса")
		return
	}
	var js json.RawMessage
	if err := json.Unmarshal(body, &js); err != nil {
		writeErr(w, 400, "невалидный JSON: "+err.Error())
		return
	}
	_, err = db.Exec(`INSERT INTO content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, string(js))
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

// ---------- handlers: uploads ----------

const maxUploadSize = 15 << 20 // 15MB

var allowedExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
	".doc": true, ".docx": true, ".pdf": true,
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeErr(w, 400, "файл слишком большой или запрос некорректен")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeErr(w, 400, "файл не найден в запросе (поле 'file')")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExt[ext] {
		writeErr(w, 400, "недопустимый тип файла: "+ext)
		return
	}
	safeName := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), randomToken()[:8], ext)
	dstPath := filepath.Join(uploadsDir, safeName)
	dst, err := os.Create(dstPath)
	if err != nil {
		writeErr(w, 500, "не удалось сохранить файл")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		writeErr(w, 500, "ошибка записи файла")
		return
	}
	writeJSON(w, 200, map[string]string{"url": "/uploads/" + safeName})
}

// ---------- routing ----------

var uploadsDir string
var webDir string

// seedFiles are the original site images/documents. They live as plain files
// next to main.go (no subfolders, for easy GitHub upload) and get copied into
// the uploads volume on first boot.
var seedFiles = []string{
	"1.doc", "1.jpg", "1000067026.jpg", "1774626280331.jpg", "1774626579817.jpg",
	"2.doc", "2.jpg", "3.doc", "3.jpg", "4.doc", "4.jpg", "5.doc", "5.jpg", "6.jpg", "7.doc",
	"IMG_20260308_141624_767.jpg", "image-29.jpg", "kadetsky.jpg", "van.jpg",
}

func main() {
	dataDir := envOr("DATA_DIR", "./data")
	uploadsDir = envOr("UPLOADS_DIR", filepath.Join(dataDir, "uploads"))
	webDir = envOr("WEB_DIR", ".")
	os.MkdirAll(dataDir, 0755)
	os.MkdirAll(uploadsDir, 0755)
	seedUploadsIfEmpty(webDir)

	initDB(filepath.Join(dataDir, "kmkk.db"))
	defer db.Close()

	mux := http.NewServeMux()

	// Public API
	mux.HandleFunc("GET /api/content", handleGetContent)

	// Auth
	mux.HandleFunc("POST /api/admin/login", handleLogin)
	mux.HandleFunc("POST /api/admin/logout", handleLogout)
	mux.HandleFunc("GET /api/admin/me", handleMe)
	mux.HandleFunc("POST /api/admin/change-password", requireAuth(handleChangePassword))

	// Content editing (auth required)
	mux.HandleFunc("GET /api/admin/content/{key}", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		handleGetContentKey(w, r, r.PathValue("key"))
	}))
	mux.HandleFunc("PUT /api/admin/content/{key}", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		handlePutContentKey(w, r, r.PathValue("key"))
	}))

	// Uploads (user-uploaded files live on the volume, not in the repo)
	mux.HandleFunc("POST /api/admin/upload", requireAuth(handleUpload))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	// Static frontend files — served individually by name, since the repo has
	// no subfolders. Only these exact files are exposed, never the whole
	// directory (that would leak main.go, go.mod, the sqlite db, etc).
	serveFile := func(name, contentType string) http.HandlerFunc {
		full := filepath.Join(webDir, name)
		return func(w http.ResponseWriter, r *http.Request) {
			if contentType != "" {
				w.Header().Set("Content-Type", contentType)
			}
			http.ServeFile(w, r, full)
		}
	}
	mux.HandleFunc("GET /", serveFile("index.html", "text/html; charset=utf-8"))
	mux.HandleFunc("GET /app.js", serveFile("app.js", "application/javascript; charset=utf-8"))
	mux.HandleFunc("GET /admin/", serveFile("admin.html", "text/html; charset=utf-8"))
	mux.HandleFunc("GET /admin.js", serveFile("admin.js", "application/javascript; charset=utf-8"))

	port := envOr("PORT", "8080")
	addr := ":" + port
	log.Printf("KMKK сервер запущен на %s (web=%s, uploads=%s)", addr, webDir, uploadsDir)
	if err := http.ListenAndServe(addr, logMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}

// seedUploadsIfEmpty copies the original site images/documents (checked into
// the repo as plain files next to main.go) into the uploads volume on first
// boot, so a freshly created Railway volume already has the files referenced
// by the seeded content (van.jpg, 5.doc, etc).
func seedUploadsIfEmpty(sourceDir string) {
	entries, err := os.ReadDir(uploadsDir)
	if err != nil || len(entries) > 0 {
		return
	}
	copied := 0
	for _, name := range seedFiles {
		src := filepath.Join(sourceDir, name)
		dst := filepath.Join(uploadsDir, name)
		in, err := os.Open(src)
		if err != nil {
			continue
		}
		out, err := os.Create(dst)
		if err != nil {
			in.Close()
			continue
		}
		io.Copy(out, in)
		in.Close()
		out.Close()
		copied++
	}
	log.Printf("Seeded %d/%d files into uploads volume from %s", copied, len(seedFiles), sourceDir)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

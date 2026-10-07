# SOKAK OYUNLARI — Final Raporu

**Tarih:** 7 Ekim 2026 · **Dal:** `claude/quirky-hamilton-c4mnxp` · **Durum:** Oyun **yalnızca 101 Okey**. Senin isteğinle Saklambaç 7 Ekim'de kaldırıldı; kodu git geçmişinde duruyor. 62 test geçiyor.

Linke tıklayınca saniyeler içinde açılan, hesap istemeyen, telefonda ve bilgisayarda çalışan çok oyunculu 3D **101 Okey**. Mekân, Üsküdar'da modern bir kıraathane: masaya otur, arkadaşlarınla ya da botlarla oyna, çayları ısmarla, sahile çıkıp simit al, martıları besle, balık tut.

Projenin uzun geçmişi (önce Saklambaç M0–M6, sonra okey modu, kalite geçişleri, gece çalışması) İngilizce olarak `Docs/SessionLog.md` ve `Docs/Decisions.md` içinde, eski rapor sürümleri de git geçmişinde.

---

## 1. Ne yapıldı

| Bölüm | İçerik |
|---|---|
| **Giriş ve lobi** | Ana sayfada takma ad ve 9 gerçekçi karakterden birini seçme (3D önizleme). Lobide salon listesi (Üsküdar semtlerinin adları), **⚡ Hızlı oyna** (seni en uygun masaya oturtur), **Yeni salon aç** (istersen sadece davet linkiyle girilen özel salon), çevrimiçi en zenginler listesi. Davet linki `?kahve=…`. |
| **101 Okey** | 106 taş, gösterge ve okey, sahte okeyler. Seri ya da en az 5 çiftle 101 açma, işleme, okeyi yerinde kullanma, göstergeyi gösterme (−101), okeyle ya da elden bitirince puanların ikiye katlanması. Sağa doğru oyun, 30 sn hamle süresi (sonra otomatik oynar). 1/3/5 el, 0–250 ₺ bahis, kazanan kasayı alır. **Taş çalma** (evin kuralı) ve **"Hile var!"**. Botlar boş koltukları doldurur, oynar, bazen hile yapar ve yakalar. |
| **Masa başı** | Gerçek 3D taşlar (parlak, kazınmış rakamlar), cilalı masif ahşap masa ve ıstakalar, çuha. Ekrandaki ıstakada taşları sürükleyip dizme, "Seri diz / Çift diz", geçerli perlerin yeşil çerçevesi, canlı per puanı. Masadaki hazır cümleler, botların konuşmaları, masa izleme. Oyuncular taş çekip atarken kolunu masaya uzatıyor. |
| **Kıraathane ve dış dünya** | 18 masalı salon + 4 masalı teras, çay ocağı (krom kazanlar, demlikler), tavla oynayan amcalar, çaycının sipariş getirmesi (çay, oralet, kahve, gazoz, ayran, simit, tost). Yan tarafta Hasan Market (reyonlar, içecek dolapları, sigara dolabı uyarılı, dondurma dolabı). Sokakta park etmiş arabalar ve taksi. Sahilde çınarlar, banklar, simitçi, çay bahçesi, oturulan taş set, balık tutma, martı besleme, güvercinler, vapur iskelesi ve iskeleye yanaşan Şehir Hatları vapuru, Kız Kulesi ve tarihi yarımada silueti. |
| **Karakterler** | Microsoft Rocketbox'ın 9 gerçekçi, dokulu yetişkin karakteri. Oyuncular kendi seçtiğini, NPC'ler kendi rollerini kullanıyor. Elde çay, simit, dondurma tutma; oturma, balık tutma, ifadeler (el salla, gül, dans, göster). |
| **Sosyal ve ekonomi** | Hazır sohbet cümleleri (serbest yazı yok), ifadeler, isteğe bağlı sesli sohbet (masadakiler ve yakındakiler). Sanal oyun parası: cihaz başına saklanan cüzdan, günlük 250 ₺ bonus, veresiye, seviyeler, günlük görevler. |
| **Yayın** | Takma ad küfür filtresi, Docker + docker-compose + Caddy (otomatik HTTPS), `Docs/Deploy.md`, sadece sayı tutan istatistik (`/stats`: başlayan masa, oynanan el, masa başına oyuncu, bahisler), indirme boyutu kontrolü. |

## 2. Nasıl test edildi

- **62 otomatik test** (`pnpm test`):
  - Okey kuralları ve bot yapay zekâsı: 20 test.
  - **Gerçek çok oyunculu testler:** 16 test. Testler sunucuyu rastgele bir portta açıp başsız istemcilerle oynuyor: aynı kahvehaneye düşme, uzaktan oturamama, botlarla tam maç (gizli eller, bahis, kasanın kazanana gitmesi, para korunumu), masaya çay, taş çalma ve yakalanma, market ve banklar, sahil seti, balık tutma, cüzdanın cihazda kalması ve iki sekmede bozulmaması, yeniden bağlanınca elin geri gelmesi, günlük görevler, lobi, liderlik tablosu, takma ad filtresi, istatistikler.
  - Hareket fiziği: 8 test.
  - Istaka mantığı: 5 test.
  - Çaycının yol bulması: 7 test.
  - Takma ad: 5 test.
  - Sabitler: 1 test.
- **Tarayıcıda (Playwright, Chromium):**
  - Masaüstü ve telefon boyutunda ana sayfa → lobi → hızlı oyna → botlarla oyun akışı denendi, sayfa hatası çıkmadı.
  - Aynı salona iki ayrı tarayıcıyla girildi; biri telefon kalitesindeydi. Her oyuncu diğerini seçtiği karakterle gördü.
  - Market alışverişi, banka oturma, balık tutma, sesli sohbet ve sayfa yenileyince elin geri gelmesi daha önceki turlarda denendi.
  - Her görsel değişiklik ekran görüntüsüyle kontrol edildi.
- **Boyut:**
  - Toplam indirme 3,2 MB (gzip); lobiyi göstermek için 128 KB yetiyor.
  - Gerçekçi karakterler (her biri yaklaşık 0,4 MB) okeye girince yükleniyor. Telefon önce 4 karakter indiriyor, diğerlerini gerektikçe indiriyor.
- **Docker:** üretim imajı derlendi; kapsayıcıda oyun, `/health` ve `/stats` çalıştı.

## 3. Senin yerine verdiğim kararlar (özet; ayrıntılar `Docs/Decisions.md` içinde)

- **Oyun parası tamamen sanal:**
  - Satın alınamaz, nakde çevrilemez.
  - Hesap yok. Cüzdan, rastgele ve isimsiz bir cihaz anahtarıyla sunucuda tutuluyor.
- **Okey kuralları:**
  - Yaygın 101 kuralları seçildi: seri ya da 5 çiftle 101 açma, puanlar, okeyle/elden bitirince ikiye katlama, gösterge.
  - Taş çalma, senin istediğin eğlence kuralı olarak eklendi: yakalanırsan 101 ceza, haksız "Hile var!" 20 ₺.
- **Senin açıkça istediğin iki istisna:**
  - Sesli sohbet sadece isteyene açık, eşler arası bağlanıyor ve sunucuda ses tutulmuyor.
  - Markette satılan sanal sigara tamamen süs; sağlık uyarısı taşıyor ve oyunda hiçbir avantaj sağlamıyor.
- **Gerçekçi görünüm:**
  - Karakterler Microsoft Rocketbox (MIT lisanslı).
  - Kız Kulesi, vapur, arabalar, market, ağaçlar ve silüet kodla gerçekçi biçimde üretildi; hiçbirinde marka logosu yok.
- **Saklambaç kaldırıldı:**
  - Ürün adı "SOKAK OYUNLARI" kaldı.
  - Ana sayfada mod seçimi yok; davet linkleri `?kahve=` biçiminde.
- **Ana sayfa:** çizgi film karakter düzenleyicisinin yerine 9 gerçekçi karakterden seçim geldi.

## 4. Kullanılan varlıklar (kaynak + lisans)

Ayrıntılı liste `Docs/ThirdPartyAssets.md` dosyasında.
- **Kenney** (CC0): adım, zıplama, tıklama ve para sesleri; yedek çizgi film karakter gövdesi (gerçekçi model yüklenemezse kullanılıyor).
- **Microsoft Rocketbox** (MIT, lisans metni `public/models/ROCKETBOX_LICENSE.txt`): 9 gerçekçi karakter.
- **ambientCG Fabric030** (CC0): okey çuhası.
- **Baloo 2** yazı tipi (SIL OFL 1.1).
- **Kodla üretilenler:** geri kalan her şey (mekânlar, Kız Kulesi, vapur, arabalar, market, ağaçlar, okey taşları, tabelalar, deniz).
- **Sentezle üretilen sesler:** dalga, martı, vapur düdüğü.

## 5. Bilinen sorunlar ve engeller

- **Sunucuya kurulum yapılmadı:** VDS ve alan adı hesap gerektiriyor; adımlar hazır.
- **Sesli sohbet:**
  - Bazı mobil ağlarda bağlanması için TURN sunucusu gerekiyor (`Docs/Deploy.md`).
  - Telefonda mikrofon sadece HTTPS'te çalışıyor. Aynı Wi-Fi'de `http://` ile denerken sadece dinleyebilirsin.
- **Gerçek telefonda kare hızı ölçülmedi.** Tarayıcı testleri yazılımsal grafikle (yavaş, GPU'suz) yapıldı. Düşük kalitede ağaç yaprakları seyreltiliyor ve karakterler azaltılmış setle yükleniyor, ama gerçek cihazda bir kez denemeni öneririm.
- **Odalar ve maçlar bellekte:** sunucu yeniden başlarsa açık salonlar ve süren maçlar kapanır. Cüzdanlar dosyada kalır.
- **Caddy henüz canlıda denenmedi:** imajı geliştirme ortamında çekilemedi; ilk gerçek kurulumda çalışacak.
- **Karakterlerin animasyonu kendi sistemimizle yapılıyor:** yüz ifadeleri yok.
- **Telefonda bekleme olabilir:** başka bir oyuncunun karakteri sende yüklü değilse, birkaç saniye geçici bir karakter görünür, sonra doğrusu gelir.

## 6. Bilgisayarında adım adım çalıştırma

1. **Node.js 22** kur: https://nodejs.org (LTS).
2. Terminalde pnpm'i aç: `corepack enable` (olmazsa `npm install -g pnpm`).
3. Projeyi al ve kur:
   ```bash
   git clone <repo adresi> sokak
   cd sokak
   git checkout claude/quirky-hamilton-c4mnxp
   pnpm install
   ```
4. Geliştirme modunda başlat:
   ```bash
   pnpm dev
   ```
   Sunucu `:2567`'de, oyun **http://localhost:5173** adresinde açılır.
5. Takma adını yaz, **Lobiye gir**. **⚡ Hızlı oyna** seni boş bir masaya oturtur, **🤖 Botlarla hemen başla** ile hemen oynarsın. Arkadaşınla oynamak için **Yeni salon aç**, içeride **🔗 Davet et** ile linki gönder ya da ikinci bir sekmede aç.
6. Hızlı test için sunucuyu şöyle başlatabilirsin (hamle süresi 12 sn, eller arası beklemeler kısa):
   ```bash
   # macOS/Linux
   SOKAK_TIMERS=fast pnpm dev
   # Windows PowerShell
   $env:SOKAK_TIMERS="fast"; pnpm dev
   ```
7. Testler ve üretim derlemesi:
   ```bash
   pnpm test          # 62 test (Saklambaç kaldırıldıktan sonra)
   pnpm typecheck
   pnpm build
   pnpm check:size    # indirme boyutu kontrolü
   pnpm start         # üretim sunucusu: http://localhost:2567 (oyunu da sunar)
   ```

### Aynı Wi-Fi'deki telefonla test
1. Bilgisayarın yerel IP adresini bul: Windows'ta `ipconfig` (IPv4, ör. `192.168.1.23`), macOS'ta `ipconfig getifaddr en0`, Linux'ta `hostname -I`.
2. `pnpm dev` çalışırken telefonda **http://192.168.1.23:5173** aç (Vite terminalde "Network:" satırında bu adresi de gösterir).
3. Salon linkini bilgisayardan paylaş; link `localhost` içeriyorsa telefonda `localhost` yerine IP'yi yaz. En kolayı: salonu **telefondan** aç ve **Davet et** ile linki diğerlerine gönder.
4. Windows güvenlik duvarı Node.js için izin isterse **Özel ağlar**'a izin ver (5173 ve 2567 portları).
5. Kontroller: sol tarafta parmağını sürükle = yürü, sağ tarafta sürükle = etrafa bak; masada taşları parmağınla sürükle.

Masaüstü kontrolleri: WASD/oklar yürü · fare sürükle bak · **E** otur / alışveriş / izle · **Q** elindekini kullan · 1–4 ifadeler · masada taşları fareyle sürükle.

## 7. Sunucuya (VDS) kurulum

Ayrıntılı adımlar: **`Docs/Deploy.md`**. Kısaca:
1. Bir Linux VDS ve alan adı al, alan adının A kaydını sunucu IP'sine yönlendir, 80/443 portlarını aç.
2. Sunucuda `curl -fsSL https://get.docker.com | sh`
3. `git clone … && cd sokak && cp .env.example .env` → `.env` içinde `DOMAIN` ve `STATS_TOKEN` değerlerini yaz.
4. `docker compose up -d --build` → `https://alanadin` hazır (Caddy sertifikayı otomatik alır).
5. İstatistik: `https://alanadin/stats?token=STATS_TOKEN`.

## 8. Önerilen sonraki adımlar

1. **Sunucuya kur** (`Docs/Deploy.md`) ve TURN sunucusunu ayarla. Linki küçük bir grupla paylaş, `/stats` ile masaları ve elleri izle.
2. **Gerçek telefonda bir maç oyna:** kare hızını, dokunmatik taş sürüklemeyi ve sesli sohbeti kontrol et.
3. Okey kurallarında evinde oynadığın farklılıklar varsa söyle. Kurallar `packages/okey` içinde, testleriyle birlikte değiştirilebilir.
4. **İstersen eklenebilecekler:**
   - oynanabilir tavla,
   - vapura binip karşıya geçme,
   - kalıcı haftalık liderlik tablosu (takma ad saklamayı gerektirir),
   - daha fazla karakter.

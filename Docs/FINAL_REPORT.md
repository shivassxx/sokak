# SOKAK OYUNLARI — Final Raporu

**Tarih:** 6 Ekim 2026 · **Dal:** `claude/quirky-hamilton-c4mnxp` · **Durum:** M0 → M6 tamamlandı, 64 test geçiyor.

Linke tıklayınca saniyeler içinde açılan, telefonda ve bilgisayarda çalışan, çok oyunculu 3D **Saklambaç** hazır. Oda kur, linki gönder, arkadaşların (ya da botlar) gelsin; Ebe duvara dönüp sayar, herkes saklanır, "Gördüm!" denince Ebe Duvarı'na yarış başlar.

---

## 1. Kilometre taşlarına göre yapılanlar

| # | Ne yapıldı |
|---|---|
| **M0 Temel** | pnpm monorepo (`apps/client`, `apps/server`, `packages/shared`, `rules`, `bots`), strict TypeScript, Vitest, `pnpm dev` ile sunucu (:2567) ve istemci (:5173) birlikte açılıyor. Docs dosyaları. |
| **M1 Hareket** | ~120×120 m elle tasarlanmış mahalle haritası (apartmanlar, merdiven + balkon, merdiven altı, dar sokak, delikli duvar, çamaşır ipleri, bakkal + kasalar, dolmuş, hurda araba, çöp konteynerleri, park, kaydırak, çalılar, çay bahçesi, Ebe Duvarı ortada). İstemci ve sunucunun **aynı** kullandığı çarpışma/hareket kodu (merdiven çıkma, zıplama, çömelme). Üçüncü şahıs kamera (duvara girmiyor). Klavye + fare ve dokunmatik joystick + butonlar (eylem haritası üzerinden). |
| **M2 Odalar** | Colyseus odası, tahmin edilemez 12 karakterlik oda kimliği, `?oda=…` linkiyle katılma, takma ad + tişört rengi, 10 oyuncuya kadar senkron hareket (istemci tahmini + sunucu uzlaştırması + ara değerleme), 20 sn yeniden bağlanma penceresi (sayfa yenilense bile aynı koltuğa döner), kurucu bot ekleyip çıkarabilir, botlar dolaşır. |
| **M3 Saklambaç kuralları** | `packages/rules`: saf durum makinesi (Lobi → Ebe seçimi → Sayma 30 sn → Arama 3 dk → El sonu 10 sn). Ebe sayarken ekranı kararır, büyük sayılar ve "Önüm arkam sağım solum sobe, saklanmayan ebe!" anonsu. Zamanlayıcı, rol ipuçları, olay bildirimleri, skor tablosu (Tab), el özeti (ilk sobelenen, en iyi saklanan + saklandığı yer, en uzun dayanan, sıradaki ebe). |
| **M4 Görme & sobe** | Sunucu tarafı görüş kontrolü (mesafe + harita engellerine ışın). **Ebe'nin istemcisine göremediği saklananların konumu hiç gönderilmiyor** (sayarken hiçbiri). "Gördüm!" sunucuda aynı kontrolle doğrulanıyor. Duvara yarış → Sobelendi / Kurtuldu, gizlice duvara dokunma, **herkesi kurtarma**. Saklanan ve arayan botlar (saklanma yeri seçer, çömelir, fırsat kollar; Ebe bot devriye gezer, görür, yarışır). **→ İlk Oynanabilir sürüm (M0–M4).** |
| **M5 Mahalle hissi** | Gri kutular yerine kodla üretilmiş low-poly mahalle: pencereli/balkonlu/klimalı binalar, tabelalar (EBE DUVARI, BAKKAL, ÇAY OCAĞI, DOLMUŞ), çizgili bakkal tentesi, meyveli kasalar, arabalar, paslı hurda araba, sarı dolmuş, ağaçlar, çalılar, kaydırak, çay masaları, sallanan çamaşırlar, uzak şehir silueti. Yaz akşamı ışığı: alçak güneş, gradyan gökyüzü; arama süresi ilerledikçe hava kararıyor, sokak lambaları ve pencereler yanıyor. Hızlı sohbet (6 hazır cümle, konuşma balonu), 4 ifade (el salla, gül, dans, göster), sentezlenmiş ses efektleri + cihazda Türkçe ses varsa sayma ve "sobe" anonsu, ses kapatma. |
| **M6 Yayın** | Takma ad küfür filtresi (Türkçe + İngilizce, leet/ayraç/tekrar harf yakalıyor; "Kemal", "Işık" gibi isimler geçiyor), açılış sayfası ("Nasıl oynanır"), oyun içi "Davet et" / lobi "Paylaş" butonu, gizlilik dostu analitik (`/stats`: oda sayısı, oynanan el, oda büyüklüğü), Dockerfile + docker-compose + Caddy (otomatik HTTPS), `Docs/Deploy.md`, yükleme boyutu kontrolü. |

## 2. Nasıl test edildi

- **64 otomatik test** (`pnpm test`):
  - Kurallar: her geçiş ve uç durum için 26 birim testi (Ebe sayarken/ararken çıkar, son saklanan çıkar, oyun ortası katılan izleyici olur, oyuncu azalınca lobiye dönüş, sıradaki ebe ayrılırsa kura, herkesi kurtarma, süre dolması, puanlar).
  - Fizik, görüş, harita (doğma noktaları ve saklanma yerleri engel içinde değil), A* yol bulma, takma ad filtresi.
  - **Gerçek çok oyunculu entegrasyon testleri:** testler gerçek sunucuyu rastgele portta açıp başsız (headless) bot istemcilerle oynuyor: linkle katılma, hareket senkronu, yeniden bağlanma, tam el akışı, Ebe'ye sayarken konum gitmemesi, duvarın arkasındaki/menzil dışındaki saklananın gönderilmemesi, "Gördüm!" doğrulaması, yarış → sobe, Ebe Duvarı'ndan "Gördüm" reddi, herkes kurtuldu, sadece botlardan oluşan tam bir el, analitik ve küfür filtresi.
- **Tarayıcıda (Playwright, Chromium):** masaüstü 1280×720 ve telefon 390×844 dokunmatik görünümde ekran görüntüleriyle kontrol: iki ayrı tarayıcıdan aynı odaya katılma, bot ekleme, sayfa yenileyince aynı koltuğa dönme, sayma ekranı, anons, el özeti, sohbet balonu, ifadeler.
- **Yükleme süresi (üretim derlemesi, telefon simülasyonu):** toplam indirme **264 KB (gzip)**, lobiyi göstermek için gereken **123 KB**. 4G: ana sayfa 0,6 sn, 3D sahne 1,3 sn. Yavaş 3G: ana sayfa 2,7 sn, 3D sahne 4,6 sn. (5 MB bütçenin çok altında.) Bu test yavaş ağda bir çökme hatasını yakaladı, düzeltildi.
- **Docker:** imaj derlendi, kapsayıcı sayfayı, `/health`, `/stats`'ı sundu ve içinde gerçek bir oda açıldı.

## 3. Senin yerine verdiğim kararlar (özet — ayrıntı `Docs/Decisions.md`)

- Kararlı, iyi bilinen sürümler: Colyseus 0.16, TypeScript 5.9, Vitest 3, Vite 7, React 19, Three.js 0.186 (daha yeni ana sürümler var, yükseltme Backlog'da).
- Konumlar Colyseus şemasında değil, her oyuncuya ayrı ayrı gönderilen anlık görüntülerde → sunucu, Ebe'nin neyi göreceğini filtreleyebiliyor (hile önleme).
- **"Gördüm!" nişan gerektirmez:** sunucu, menzildeki (20 m) ve görünen en yakın saklananı seçer — telefonda tek büyük buton yeterli.
- **Ebe, Ebe Duvarı'nın üstündeyken "Gördüm!" diyemez** (yoksa duvar dibinde bekleyip anında sobeleyebilirdi; uzaklaşıp geri koşmak oyunun eğlencesi).
- Ebe duvara dokununca o an "görülmüş" tüm saklananlar sobelenir; aynı anda dokunulursa saklanan kazanır.
- Çömelmek yavaşlatır ama görünürlüğü azaltır; çalı, ağaç tacı ve çamaşırlar görüşü keser ama içinden geçilebilir. 1,8 m'den yakındaki herkes her zaman görülür.
- Koşma yok: Ebe ile saklananların hızı eşit, yarışı konum belirler.
- Sıradaki Ebe: ilk sobelenen; kimse yakalanmadıysa veya "herkes kurtuldu" olduysa aynı Ebe; Ebe çıktıysa kura.
- Puanlar: duvara ulaşan +3, süre sonuna kadar dayanan +2, herkesi kurtaran +5, Ebe her sobe için +2.
- Oyunun ortasında gelen kişi o el izleyici (kimse onu görmez), sonraki elde oyuna girer. 3 kişiden az kalırsa lobiye dönülür.
- Takma ad ve renk sadece tarayıcı oturumunda (sessionStorage) tutulur; hesap/kişisel veri yok. Ses kapatma tercihi cihazda saklanır.
- Varlık siteleri bu geliştirme ortamından erişilemediği için tüm modeller ve sesler kodla üretildi (lisans sorunu yok, indirme küçük).
- Analitik yalnızca sayılar tutar; `STATS_TOKEN` ile korunabilir.
- `pnpm start` Windows'ta da çalışsın diye `--prod` bayrağı kullanıyor.

## 4. Kullanılan varlıklar (kaynak + lisans)

**Üçüncü taraf varlık yok.** Tüm 3D modeller (`world.ts`, `character.ts`), tabelalar (çalışma anında canvas ile) ve sesler (WebAudio sentezi) bu projede kodla üretildi. Sayma/"sobe" sesi için cihazın kendi Türkçe konuşma sesi kullanılıyor (varsa; indirme yok).

Önerilen CC0 paketler (kenney.nl, quaternius.com, polyhaven.com bu ortamdan erişilemedi) `Docs/ThirdPartyAssets.md` içinde **ASSET RECOMMENDED** tablosu olarak listelendi: Kenney City Kit (Suburban), Kenney Car Kit, Quaternius karakterleri, Kenney Interface Sounds ve kendi kaydedeceğin çocuk sesleri ("bir… otuz", "Önüm arkam sağım solum sobe…").

## 5. Bilinen sorunlar ve engeller

- **Grafikler prosedürel:** sevimli ve hızlı ama gerçek bir sanatçı modeli kadar detaylı değil (yukarıdaki CC0 paketleriyle yükseltilebilir).
- **Gerçek sesler yok:** sentez efektleri var; Türkçe konuşma sesi her cihazda bulunmayabilir (o zaman sadece yazı + efekt).
- **Sunucuya kurulum yapılmadı** (VDS + alan adı hesap gerektiriyor); adımlar hazır.
- Caddy imajı geliştirme ortamında çekilemedi; Caddyfile standart iki direktif kullanıyor ama gerçek sunucuda ilk kez çalışacak.
- Botlar basit: bazen aynı bölgede takılabilir ya da çok erken/geç duvara koşabilir.
- Sunucu yeniden başlarsa açık odalar kapanır (odalar bellekte).
- Gerçek telefonda elle test edilmedi; telefon görünümü Chromium ile simüle edildi. İlk denemede düşük donanımlı telefonda kare hızını kontrol etmeni öneririm.
- 3D paketi (Three.js) 141 KB gzip; ana sayfa açıldıktan sonra arka planda yükleniyor.

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
5. Takma ad yaz, renk seç, **Oda kur**. Lobideki **Paylaş** ile linki kopyala, ikinci bir sekmede aç. Az kişiyle denemek için **+ Bot ekle** (en az 3 oyuncu gerekir), sonra **Oyunu başlat**.
6. Kısa ellerle hızlı test için sunucuyu şöyle başlatabilirsin (sayma 6 sn, arama 45 sn):
   ```bash
   # macOS/Linux
   SOKAK_TIMERS=fast pnpm dev
   # Windows PowerShell
   $env:SOKAK_TIMERS="fast"; pnpm dev
   ```
7. Testler ve üretim derlemesi:
   ```bash
   pnpm test          # 64 test
   pnpm typecheck
   pnpm build
   pnpm check:size    # indirme boyutu kontrolü
   pnpm start         # üretim sunucusu: http://localhost:2567 (oyunu da sunar)
   ```

### Aynı Wi-Fi'deki telefonla test
1. Bilgisayarın yerel IP adresini bul: Windows'ta `ipconfig` (IPv4, ör. `192.168.1.23`), macOS'ta `ipconfig getifaddr en0`, Linux'ta `hostname -I`.
2. `pnpm dev` çalışırken telefonda **http://192.168.1.23:5173** aç (Vite terminalde "Network:" satırında bu adresi de gösterir).
3. Oda linkini bilgisayardan paylaş; link `localhost` içeriyorsa telefonda `localhost` yerine IP'yi yaz. En kolayı: odayı **telefondan** kur ve **Paylaş** ile linki diğerlerine gönder.
4. Windows güvenlik duvarı Node.js için izin isterse **Özel ağlar**'a izin ver (5173 ve 2567 portları).
5. Kontroller: sol tarafta parmağını sürükle = yürü, sağ tarafta sürükle = etrafa bak, sağ alttaki butonlar = Zıpla / Çömel / **Gördüm!**

Masaüstü kontrolleri: WASD/oklar yürü · fare sürükle bak (çift tık = fare kilidi) · Boşluk zıpla · C çömel · E veya F "Gördüm!" · Tab skor · 1–4 ifadeler · T hızlı sohbet.

## 7. Sunucuya (VDS) kurulum

Ayrıntılı adımlar: **`Docs/Deploy.md`**. Kısaca:
1. Bir Linux VDS ve alan adı al, alan adının A kaydını sunucu IP'sine yönlendir, 80/443 portlarını aç.
2. Sunucuda `curl -fsSL https://get.docker.com | sh`
3. `git clone … && cd sokak && cp .env.example .env` → `.env` içinde `DOMAIN` ve `STATS_TOKEN` değerlerini yaz.
4. `docker compose up -d --build` → `https://alanadin` hazır (Caddy sertifikayı otomatik alır).
5. İstatistik: `https://alanadin/stats?token=STATS_TOKEN`.

## 8. Önerilen sonraki adımlar

1. **Arkadaşlarla gerçek bir el oyna** (özellikle telefonda) ve en eğlenceli/sinir bozucu anları not et: menzil (20 m), süreler (30 sn / 3 dk), çömelme gücü en çok ayar isteyebilecek değerler (`packages/shared/src/visibility.ts`, `constants.ts`).
2. Sunucuya kur (`Docs/Deploy.md`) ve linki küçük bir grupla paylaş; `/stats` ile oynanan el ve oda büyüklüklerini izle.
3. Sesleri kaydet: çocuk sesiyle sayma ve "Önüm arkam sağım solum sobe, saklanmayan ebe!" — en büyük nostalji etkisi burada.
4. CC0 model paketleriyle görselleri yükselt (`Docs/ThirdPartyAssets.md`).
5. Kurucuya oda ayarları (süre, bot sayısı), izleyici kamerası, ikinci bir mahalle haritası (`Docs/Backlog.md`).
6. Sonra sıradaki mod: Yakar Top, Kör Ebe, İstop, Mendil Kapmaca, Elim Sende (Backlog'da).

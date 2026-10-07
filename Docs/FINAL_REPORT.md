# SOKAK OYUNLARI — Final Raporu

**Tarih:** 6–7 Ekim 2026 · **Dal:** `claude/quirky-hamilton-c4mnxp` · **Durum:** M0 → M6, iki kalite geçişi, Mod 2 (101 Okey) ve gece çalışması tamamlandı; 112 test geçiyor. En yeni değişiklikler en alttaki **"Ek: Gece çalışması"** bölümünde.

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

---

## Ek: Kalite geçişi (M7) — "daha profesyonel, daha az basit"

**Görsel**
- **Yeni karakterler:** chibi tarzı, bebekli ve parlayan gözler, göz kırpma, kaşlar, yanaklar, dirsek/diz eklemleri. 5 saç modeli, 6 şapka (kasket, bere, hasır şapka, taç, kulaklık), 4 ten rengi. Koşma, sinsi çömelme ve zıplama animasyonları. Pozlar: Ebe duvarda gözlerini kapatıyor, görülenin başında "!", sobelenen üzgün, kurtulan seviniyor.
- **Ana sayfada canlı 3D karakter önizlemesi:** görünüm buradan seçiliyor ve diğer oyunculara da gidiyor.
- **Mahalle baştan yapıldı:** shader ile sıva, tuğla, karo, arnavut kaldırımı, asfalt, çimen ve ahşap dokuları; duvar diplerinde gölge. Panjurlar, saksılar, bitkili balkonlar, numaralı kapılar, çatı depoları ve çanak antenler eklendi. Kaldırım bordürleri, yaya geçitleri, tebeşirle çizilmiş seksek, bakkal tezgâhı, semaver, damalı dolmuş, çay bardakları, çimen ve çiçekler var.
- **Canlılık:** koşan birinden kaçan güvercinler, bulutlar, ortam yansımalı ışık ve daha koyu bir akşam alacası.
- **Kenney CC0 pikapları** park etmiş arabalar olarak kullanıldı. Kamera çalıya girince yapraklar şeffaflaşıyor.
- **Arayüz:** Baloo 2 yazı tipi; yeniden tasarlanan HUD, paneller ve açılış sayfası; el sonu özetinde ödül kartları.
- **Ses:** Kenney CC0 kayıtları (adım sesi, zıplama, iniş, kurtulma, sobe, şehir ambiyansı). Dosya çözülemezse sentez seslere dönülüyor.

**Oynanış**
- **Koşma ve dayanıklılık (Shift / Koş):** yaklaşık 3,6 saniye depar atılabiliyor; tükenince bir süre koşulamıyor.
- **Ayak sesi ipucu:** Ebe, göremediği ama koşan birinin yönünü ekran kenarında sarı "tıkırtı" olarak görüyor. Konum değil, sadece yön gidiyor. Çömelmek sessiz.
- **Ebe yakın uyarısı:** saklananlar Ebe yaklaşınca kırmızı kalp atışı efekti görüyor.
- **Taş atma (Q / Taş at):** 12 saniye bekleme süresi var. Herkes taşın düştüğü yerde "TIK!" görüyor, atanı kimse görmüyor; Ebe sadece yönünü duyuyor.
- **Çöp konteynerine saklanma (E):** içerideki kimseye görünmüyor. Ebe konteynerin yanında "Gördüm!" derse kapağı açıp yakalıyor.
- **Diğer:** Ebe Duvarı pusulası, bağlama göre değişen eylem butonları (Gördüm! / Kapağı aç! / Konteynere saklan / Dışarı çık), kamera sarsıntısı, depar sırasında görüş açısı genişlemesi. Botlar da koşuyor; Ebe bot konteynerleri yokluyor.

**Teknik**
- Test sayısı 64'ten 70'e çıktı.
- Basit sahnede çizim çağrısı 212'den 121'e indi.
- Toplam indirme 2,07 MB (gzip). Bunun 1,2 MB'ı oyun açıldıktan sonra yüklenen ambiyans sesi; lobi için gereken 128 KB.
- Yeni varlıklar `Docs/ThirdPartyAssets.md`, kararlar `Docs/Decisions.md` dosyasında.

**Bilinen sınırlar:** Animasyonlu hazır CC0 karakter olarak sadece miğferli bir asker modeli erişilebilirdi; bu yüzden karakterler kodla üretildi. Gerçek bir telefonda kare hızının elle ölçülmesi önerilir; karakter başına yaklaşık 35 çizim çağrısı var.

---

## Ek: Mod 2 — 101 Okey · Kahvehane

**Nasıl girilir**
1. Ana sayfada **"101 Okey"** modunu seç, sonra **"Kahvehaneye gir"** düğmesine bas. Herkes aynı herkese açık kahvehane lobisine düşer; 40 kişi dolunca yeni bir kahvehane açılır. `?kahve=<id>` linkiyle arkadaşın aynı kahvehaneye gelir.
2. Salonda yürü, bir masaya yaklaş ve **Otur (E)** de. İlk oturan masanın sahibi olur.
3. Masa sahibi **bahsi** (0 / 10 / 50 / 100 / 250) ve **el sayısını** (1 / 3 / 5) seçer. Boş sandalyelere **bot** ekleyip **"Taşları dağıt"** der.

**Kurallar (101 Okey)**
- 106 taş (2 sahte okey), gösterge ve okey, 22/21 taş dağıtımı. Desteden ya da soldaki oyuncunun attığı taştan çekilir, sonra bir taş atılır.
- **Elini açmak** için en az **101 puanlık** seri ve per ya da en az **5 çift** gerekir. Soldan alınan taş kullanılmazsa atılamaz; zorla atılırsa ceza yazılır.
- Açtıktan sonra yere per indirme, başkasının perine taş işleme ve okeyle yer değiştirme var. İşlek taş atana +101 ceza.
- **Puanlama:** biten oyuncu −101 alır, okeyle ya da elden bitirilirse ×2. Açmayan oyuncu 202, açan oyuncu elinde kalan taşların toplamını yazar; çift açanda ×2. Deste biterse el kimse bitirmeden kapanır.
- Maçın sonunda en düşük toplam puanı olan **potu** kazanır.

**Taş çalma**
- Her elde bir kez, sol hariç bir oyuncunun atık yığınındaki üst taşı kendi taşınla gizlice değiştirebilirsin (**Taş çal**).
- Masadakiler 6 saniye içinde **"Hile var!"** derse hamle geri alınır, çalan 101 ceza ve 50 lira para cezası öder. Haksız suçlama yapan 20 lira öder.
- Diğer oyunculara bazen "bir şeyler dönüyor…" ipucu gelir. Botlar da arada çalıyor ve şüphelenince suçluyor.

**Kahvehane**
- **Çaycı Rıza**'dan çay, oralet, Türk kahvesi, gazoz, ayran, simit ve tost sipariş edilebiliyor. Kendine, bütün masaya ya da bir oyuncuya ısmarlanabiliyor.
- Çaycı tepsisiyle yürüyerek siparişi getiriyor; içecek masada görünüyor ve karakter içiyor.
- **Sanal para:** başlangıçta 1000 ₺ var. Para bitince 5 dakikada bir 200 ₺ **Veresiye** alınabiliyor. Para tamamen oyun içi; gerçek parayla hiçbir bağı yok.
- "En zenginler" listesi, okeye özel hazır mesajlar ve emojiler var. Serbest sohbet yok.
- 3D salonda ahşap zemin, çini duvar, semaverli tezgâh, tavla, televizyon, vantilatörler ve tabelalar bulunuyor. Masalarda istekalar ve taşlar görünüyor.

**Arayüz**
- 2×14'lük ıstaka var; taşlar sürükle-bırak ile diziliyor. **Seri diz** ve **Çift diz** otomatik dizer.
- **"Elini aç"** düğmesi kaç puanla açacağını gösteriyor. Rakiplerin atık yığınları, gösterge ve okey bilgisi ekranda.
- Hamle süresi 30 saniye; süre dolarsa otomatik oynanıyor. Oyundan kalkan oyuncunun yerine bot geçiyor.
- Telefonda yatay ekran destekleniyor; dikey tutulduğunda "çevir" uyarısı çıkıyor.

**Test**
- `packages/okey` paketinde 18 birim testi var: taşlar, dağıtım, açma, işleme, okey değiştirme, puanlama, deste bitmesi, çalma ve suçlama. 12 tam el sadece botlarla oynatılıp taşların korunduğu doğrulandı.
- Sunucuda 5 entegrasyon testi var: ortak oda, oturma mesafesi, para korunumuyla tam bot maçı, sipariş ve veresiye, çalmanın yakalanması ve bot devralması.
- Toplam test sayısı 93/93. Masaüstü ve telefon (yatay) ekran görüntüleri Playwright ile kontrol edildi.

**Bilinen sınırlar**
- Eşli (2'ye 2) oyun yok.
- Katlamalı açma barajı ve renk okeyi gibi yöresel varyantlar yok. Bunlar `Docs/Backlog.md` dosyasına eklenebilir.
- Telefonda dikey modda oynanmıyor.

---

## Ek: Kalite geçişi 2 — karakterler, grafik, kıraathane ve okey masası

**Karakterler**
- Kenney'nin CC0 lisanslı, iskeletli (rigged) insan modeli kullanıldı. Kaynak `pmndrs/market-assets` deposu, ayrıntılar `Docs/ThirdPartyAssets.md` dosyasında.
- Modelin hazır kıyafet dokusu yok. Yüz, saç çizgisi, tişört (düz, çizgili, polo, düğmeli), pantolon ve ayakkabı her görünüm için kodla çiziliyor. Böylece renk, saç, şapka ve ten seçimi aynen çalışıyor.
- Çocuklar Saklambaç için biraz daha küçük ve büyük kafalı. Kahvehanede yetişkin oranları kullanılıyor; amcalarda bıyık, kır saç, kel, yelek, gözlük ve tespih var.
- Yürüme, koşma, çömelme, zıplama, oturma, çay içme, gazete okuma, uyuklama ve emoji animasyonları iskelete uygulanıyor.

**Grafik**
- Masaüstünde ortam gölgelemesi (GTAO), lamba parlaması (bloom), renk düzenlemesi, kenar karartma ve kenar yumuşatma var.
- Telefonda hafif mod kullanılıyor. Kare hızı düşerse kalite kendiliğinden bir kademe iniyor.
- Tuğla derzleri, parke ve taş aralıkları, tahta çizgileri ve asfalt çatlakları gölgelendirici ile kabartmalı görünüyor. Karakterlerde hafif bir kenar ışığı var.

**Kıraathane baştan yapıldı**
- Zemin desenli karo, duvarlarda ceviz lambri ve adaçayı yeşili sıva var.
- Pencerelerde dantel perdeler ve dışarıda akşam sokağı görünüyor. Akşam güneşi pencerelerden içeri vuruyor.
- Çay ocağında mermer tezgâh, çini pano, semaver, çaydanlıklar, bardaklar, tepsiler ve menü tahtası var.
- Thonet tarzı hasır oturaklı kahvehane sandalyeleri ve tornalı ayaklı, keçeli okey masaları var. Her masada iki katlı ıstakalar bulunuyor.
- Köşelerde zar atarak tavla oynayan, gazete okuyan, uyuklayan ve çay içen amcalar var.
- Gerçek saati gösteren duvar saati, maç yayınlayan televizyon, eski fotoğraflar, takvim, ayna, vantilatörler, sarkıt lambalar ve havada uçuşan toz zerreleri eklendi.

**101 Okey masası**
- Masalardaki her şey gerçek 3D taş: ıstakalardaki taşlar, deste, gösterge, atılan taşlar ve açılan perler. Salonda gezerken diğer masalardaki oyunları da görebiliyorsun.
- Atılan taş oyuncunun ıstakasından yığına uçuyor, perler masaya kayarak iniyor. Sırası gelen oyuncunun ıstakası parlıyor.
- Oturunca kamera masayı ekranın altındaki ahşap ıstakanın tam üstüne yerleştiriyor.
- **Taşları istediğin gibi dizebilirsin.** Bir taşı sürükleyip başka bir taşın üstüne bırakırsan araya girer, diğer taşlar kayar; boş yere bırakırsan oraya yerleşir. İstersen önce taşa, sonra boş yuvaya dokunarak da taşıyabilirsin. Dokunmatik ekranda da çalışıyor.
- Taş atmak için taşı sağ köşedeki yığına sürüklemen yeterli. İşlemek için taşı yerdeki pere bırakıyorsun.
- Desteden çekmek için desteye, soldan almak için soldaki yığına dokunuyorsun; ikisi de sıra sende olunca parlıyor.
- Ekranın üstünde yalnızca o an ne yapman gerektiğini söyleyen tek bir yönlendirme satırı var.
- "Per: 87/101" ilerleme çubuğu gösteriliyor ve geçerli perler ıstakada yeşil çerçeveyle işaretleniyor. "Elini aç" düğmesi sadece açabilecek durumdayken çıkıyor.
- Seyrek kullanılan işlemler (taş çal, geri koy, deste bitti, kalk) "⋯" menüsünde. "Hile var!" düğmesi yalnızca şüpheli bir durum olduğunda beliriyor.
- "Nasıl oynanır?" panelinde kurallar kısaca anlatılıyor.
- Yeni çekilen taş ıstakada vurgulanıyor, sıra sana gelince ses çalıyor ve isim etiketlerinde maç puanları görünüyor.

**Test**
- 98 test geçiyor. Bunların 5'i yeni eklenen ıstaka düzenleme testi.
- Playwright ile masaüstünde ve telefon boyutunda (yatay) gerçek sürükle-bırak denendi: taşı araya sokma, desteden çekme ve yığına atma çalıştı.
- Saklambaç botlarla oynatıldı ve sorunsuz çalıştı.
- Toplam indirme 2,16 MB (gzip), lobi için gereken 132 KB.

**Bilinen sınırlar**
- Karakter animasyonları koddan üretiliyor; Kenney'nin hazır animasyon dosyaları indirilebilirse daha akıcı olur.
- Yüksek kalite modu (AO ve bloom) zayıf dizüstü bilgisayarlarda kendiliğinden düşüyor. Telefonlarda kare hızı gerçek cihazda ölçülmeli.

## Ek: Gece çalışması — Üsküdar kıraathanesi, lobi, sesli sohbet

Uyurken verdiğin listedeki her madde yapıldı. Takip listesi `Docs/NightPlan.md` dosyasında.

**Bildirdiğin hatalar**
- **Kamera titremesi:** kamera artık karakteri yatayda birebir takip ediyor. Sadece yükseklik (basamak, kaldırım) yumuşatılıyor. Bu yüzden yürürken karakter ekranda sallanmıyor.
- **Karakterin takılı kalması:** bir engelin içine giren gövde artık en kısa yoldan dışarı itiliyor. Önceden geriye itiliyor ve sıkışıyordu. Bunun için test de eklendi.
- **Yazılı emote atınca etrafın kararması:** sorun konuşma balonlarının etrafında oluşan gölge (AO) halesiydi. Balonlar ve isim etiketleri artık bu gölgeye dahil edilmiyor.
- **Mekânın dışına çıkılması:** harita kenarları kapatıldı. Denize atlamayı önlemek için korkuluğun üstüne görünmez bir duvar konuldu. Kamera da artık ince duvarlardan, vitrin camından ve kapı üstünden dışarı geçmiyor.

**Gece test ederken bulup düzelttiğim hatalar**
- Oyun ortasında sayfa yenilenince masaya geri dönülüyordu ama ıstaka boş geliyordu. Artık taşlar geri geliyor, üstelik senin dizdiğin sırayla.
- Özel salonun davet linkini almanın bir yolu yoktu. Kahvede **🔗 Davet et** düğmesi eklendi: telefonda paylaşma menüsünü açıyor, bilgisayarda linki kopyalıyor.
- Çaycı markete veya sahile çay götürürken duvarların içinden geçiyordu. Artık engellerin etrafından dolaşan bir yol buluyor.
- Telefonda yatay ekranda üst çubuk taşıyordu. Masadayken üstteki düğmeler ipucu satırının altında kalıyordu. "Otur" ve "Alışveriş" yazıları elindeki eşyanın çubuğuyla üst üste biniyordu. Üçü de düzeltildi.
- Bankta veya duvarda otururken karakter havaya kalkabiliyordu. Bu da düzeltildi.
- **Sunucu kurulum dosyası (Docker) okey paketini kurmuyordu.** Düzeltildi. Cüzdan dosyası artık kalıcı `data` klasörüne yazılıyor. İmaj gerçekten derlendi; kapsayıcının içinde bir salona girildi, liderlik tablosu ve cüzdan kaydı çalıştı.

**Modern kıraathane**
- Beton karo zemin, tuğla duvar, meşe ve siyah çelik mobilya, sarkıt lambalar var. Çay ocağı ve tavla köşesi korundu.
- İçeride 18 masa var. Cam korkuluklu terasta 4 masa daha var, toplam 22 okey masası.
- Bir salona 60 kişiye kadar girebiliyor.

**Dışarısı: Üsküdar sahili**
- Kıraathaneden çıkınca önce teras, sonra arabaların park ettiği sokak geliyor.
- Sokaktan sonra Salacak tarzı sahil var: çınar ağaçları, banklar, simitçi arabası, tabureli çay bahçesi, olta atan balıkçılar ve vapur iskelesi.
- Denizin karşısında **Kız Kulesi** duruyor. Önünden vapur geçiyor, martılar uçuyor.
- Ufukta Tarihi Yarımada'nın silueti görünüyor: Ayasofya, Sultanahmet, Topkapı, Süleymaniye ve Galata Kulesi. Uzaktan da seçilebilsin diye biraz büyük çizildi.
- Arkada renkli Üsküdar evleri ve tepede bir cami var. Deniz animasyonlu, üstünde güneş parıltısı var.
- Sahilde bir bölümde korkuluk yok, alçak taş duvar var. Buraya oturup bacaklarını denize sarkıtabilir, Kız Kulesi'ne karşı çay içebilirsin.

**Market ve dışarıdaki sosyal aktiviteler**
- Kıraathanenin yanında **Bakkal Hasan** var. Sigara, su, gazoz, çekirdek, çikolata, dondurma ve gazete satıyor. Simitçi Cemal ise simit, çay ve su satıyor.
- Aldığın şey elinde duruyor ve **Q** ile kullanıyorsun: sigara yakıp duman üflüyorsun, simit yiyorsun, gazoz içiyorsun, gazete okuyorsun. Diğer oyuncular da bunu görüyor.
- Sigara tamamen sanal ve oyun parasıyla alınıyor. Oyunda hiçbir avantaj sağlamıyor ve üstünde "Sigara içmek sağlığa zararlıdır" uyarısı var.
- Sahil korkuluğunda ya da duvarında elinde simit varken **Q** "Martılara at" oluyor: simitten bir parça atıyorsun, en yakın martı dalıp havada kapıyor. Herkes görüyor.
- **Balık tutma:** Bakkal Hasan'dan 30 ₺'ye olta alabilirsin. Sahilde denize karşı durup **Q** ile oltayı atıyorsun; şamandıra suda sallanıyor.
  - Birkaç saniye sonra "Vurdu!" diye bağırıyorsun, şamandıra çırpınıyor ve düğme "ÇEK!" oluyor.
  - Hemen çekersen istavrit, çinekop, lüfer, palamut ya da bazen eski bir ayakkabı çıkıyor. Tuttuğun şey salondaki herkese duyuruluyor.
  - Erken çekersen ya da geç kalırsan balık kaçıyor. Yürüyüp uzaklaşırsan oltayı topluyorsun.
  - Balıkçı amcaların oltaları ters duruyordu, o da düzeltildi.
- **Sesler:** kahvehane dünyasında artık adım sesleri var. Sahile yaklaştıkça dalga sesi artıyor, ara sıra martılar çığlık atıyor; simit atınca martı bağırarak geliyor. Bu sesler dosya indirmeden, tarayıcıda üretiliyor.
- Banklara, taburelere ve sahil duvarına **E** ile oturabilirsin. Emote, hazır sohbet cümleleri ("Sahile inelim mi?", "Manzaraya bak!") ve çay ısmarlama dışarıda da çalışıyor. Çaycı siparişi nerede olursan ol getiriyor.

**Online oyun özellikleri**
- **Lobi:** salonlar Üsküdar semtlerinin adını taşıyor (Salacak, Kuzguncuk, Çengelköy…). Listede her salonun kaç kişi olduğu, kaç masada oyun sürdüğü ve kaç masanın oyuncu beklediği görünüyor.
- **⚡ Hızlı oyna** seni doğrudan boş bir masaya oturtuyor. Önce oyuncu bekleyen masalar dolduruluyor.
- **Yeni salon aç** ile salon kurabilirsin. İstersen "özel" yapabilirsin: listede görünmez, sadece davet linkiyle girilir.
- Salonun içinde **🃏 Masalar** listesinden tek tıkla bir masaya oturabilirsin. **🤖 Botlarla hemen başla** boş yerleri botlarla doldurup taşları dağıtıyor.
- **Masa izleme:** oyun süren bir masaya yaklaşıp **👀 İzle** (E) dersen kamera masanın boş köşesine geçiyor. Taşları, perleri ve puanları seyirci gibi izliyorsun. Yürüyünce ya da E'ye basınca izleme bitiyor.
- **Kalıcı cüzdan:** hesap yok. Bakiyen cihazına verilen rastgele, isimsiz bir anahtarla sunucuda saklanıyor. Her gün ilk girişte 250 ₺ bonus alıyorsun.
- **Seviye:** bitirdiğin her maç ve her galibiyet seviyeni yükseltiyor. Unvanlar sırasıyla Çaylak, Acemi, Mahalle oyuncusu, Kahve müdavimi, Usta, Okey ağası ve Efsane.
  - Seviyen salonda ⭐ rozetiyle, masada isim etiketlerinde görünüyor. Seviye atlayınca bildirim geliyor.
  - Lobide bakiyen, seviyen, oynadığın maç sayısı ve galibiyetlerin yazıyor.
- **Liderlik tablosu:** lobide o an çevrimiçi en zengin 10 oyuncu, salon adlarıyla birlikte görünüyor.
- **Sesli sohbet:** isteğe bağlı ve varsayılan olarak kapalı. **🎙️** ile açılıyor ve mikrofon izni istiyor; izin vermezsen sadece dinleyebilirsin.
  - Masadayken masadaki dört kişiyle konuşuyorsun. Dışarıdayken ~14 m içindeki oyuncularla konuşuyorsun ve ses mesafeyle azalıyor.
  - İstediğin kişiyi tek tek susturabilir, kendi mikrofonunu kapatabilirsin. Konuşan kişinin üstünde simge beliriyor.
  - Ses, oyuncular arasında doğrudan (WebRTC) gidiyor. Sunucudan geçmiyor ve hiçbir yerde kaydedilmiyor.

**Senin yerine verdiğim kararlar (ayrıntı `Docs/Decisions.md`)**
- "Küçük mapimizi Üsküdar'a benzetelim" isteğini kıraathanenin dışındaki okey dünyası olarak yorumladım. Saklambaç mahallesine dokunmadım.
- Sesli sohbet ve sigara, CLAUDE.md'deki çocuk güvenliği kurallarına aykırıydı ama sen açıkça istediğin için ekledim. İkisi için de önlem aldım:
  - Sesli sohbet isteğe bağlı, susturulabiliyor ve kayıt tutulmuyor.
  - Sigara sanal, uyarılı ve avantajsız.
  - Oyunu küçük yaştakiler oynayacaksa ikisi de tek satırla kapatılabilir.
- Liderlik tablosu sadece o an çevrimiçi olanları gösteriyor. Geçmişe dönük sıralama için takma adları saklamak gerekirdi; bunu yapmadım.

**Nasıl test edildi**
- 113 otomatik test geçiyor (bazıları yeni kontroller içeriyor). Gece eklenen testler:
  - Market alışverişi ve kullanma, bank ve sahil duvarı oturma.
  - Cüzdanın aynı cihazda korunması, hızlı oturma ve botla başlatma.
  - Maç bitince insan oyuncunun maç/galibiyet sayısının artması (botların artmaması), lobinin sadece kendi cüzdanını okuyabilmesi.
  - Liderlik tablosu, sayfa yenilemeden sonra elin geri gelmesi.
  - Balık tutma: denizden uzakta olta atılamaması, erken çekince kaçması, vurunca çekince balık çıkması, uzaklaşınca oltanın toplanması.
  - Çaycının yol bulması (markete, sahile, çay bahçesine giden rotalar duvar içinden geçmiyor).
- Playwright ile tarayıcıda denenenler:
  - Lobi → hızlı oyna → botlar → 5 tur taş çekip atma.
  - Oyun ortasında sayfayı yenileme.
  - Markete yürüyüp sigara alma ve yakma.
  - Simitçiden simit alıp banka oturma; ikinci bir oyuncunun ekranından bunun görünmesi.
  - Sahil duvarına oturma, davet linkiyle özel salona girme.
  - İki ayrı tarayıcı arasında sesli sohbet.
  - Telefon boyutunda yatay ekran.
- Toplam indirme 2,18 MB (gzip), lobiyi göstermek için gereken 136 KB.

**Bilinen sınırlar**
- **Sesli sohbet:** bazı mobil ağlarda (sıkı NAT) bağlantı kurulamayabilir. Bunun için sunucuda bir TURN sunucusu kurulmalı; adımlar `Docs/Deploy.md` dosyasında. Bu iş hesap ve sunucu gerektirdiği için sana bıraktım.
- **Telefonda mikrofon:** tarayıcılar mikrofonu sadece HTTPS'te veriyor. Aynı Wi-Fi'de `http://192.168…` adresiyle denerken telefonda sadece dinleyebilirsin. Gerçek sunucuda (Caddy ile HTTPS) mikrofon da çalışır.
- **Cüzdan dosyası:** bakiyeler `data/wallets.json` dosyasında. Sunucuyu yeniden kurarken bu klasörü koru.
- **Gerçek cihaz testi:** gerçek telefonda ses ve kare hızı henüz ölçülmedi.

**Önerilen sonraki adımlar**
- İlk iş olarak VDS'e kurulum yap ve TURN sunucusunu ayarla.
- Kalıcı haftalık liderlik tablosu eklenebilir; bunun için takma ad saklamak gerekir.
- Sahilde vapura binip karşıya geçme gibi yeni mini etkinlikler eklenebilir. Tutulan balıklar için bir "günün balıkçısı" listesi de eklenebilir.
- Saklambaç için de Üsküdar temalı ikinci bir mahalle yapılabilir.


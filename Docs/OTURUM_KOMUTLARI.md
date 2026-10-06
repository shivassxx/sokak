# SOKAK OYUNLARI — Bulut Oturumu Komutları

Model: **Opus / medium** (ya da `/model opusplan`).

---

## Tek seferde hepsi

Bulut oturumunu başlat, repoyu seç ve bunu yapıştır:

```
Read CLAUDE.md. Build the whole project autonomously: complete milestones M0 through M6 in order without asking me any questions. Make reasonable decisions yourself and record them in Docs/Decisions.md. After every milestone, run typecheck, build and tests, fix failures, update Docs/Roadmap.md and Docs/SessionLog.md, then commit and push. When everything is done, write Docs/FINAL_REPORT.md in Turkish and give me the same report.
```

---

## Oturum yarıda kalırsa

Bütçe, süre ya da bağlam sınırı yüzünden oturum bitmeden durursa yeni bir oturum aç ve bunu yapıştır:

```
Read CLAUDE.md, Docs/Roadmap.md and Docs/SessionLog.md. Continue autonomously from the earliest incomplete milestone through M6 without asking me any questions. Checkpoint after every milestone. When everything is done, write Docs/FINAL_REPORT.md in Turkish and give me the same report.
```

---

## Bittiğinde kontrol

1. `Docs/FINAL_REPORT.md` dosyasını oku.
2. Bilgisayarında:
   ```
   git pull
   pnpm install
   pnpm dev
   ```
3. Tarayıcıda açılan adresten bir oda kur, linki ikinci bir sekmede ya da aynı Wi-Fi'deki telefonunda aç ve bir el oyna.

# Wdrożenie

Aplikacja to jeden proces Node.js (Fastify), który serwuje i API, i zbudowany klient. Dane trzyma w jednym pliku
`store.json` w katalogu `DATA_DIR`.

## 1. Paczka do wgrania na serwer (zalecane dla zwykłego VPS / hostingu z Node)

Na swoim komputerze:

```bash
npm ci
npm run package        # tworzy release/nadgodziny-<wersja>.tar.gz i .zip
```

Na serwerze (Node.js 20+):

```bash
mkdir -p /opt/nadgodziny && cd /opt/nadgodziny
tar -xzf nadgodziny-1.0.0.tar.gz --strip-components=1     # lub rozpakuj .zip
cp .env.example .env && nano .env                         # ADMIN_PASSWORD, PORT, ...
npm install --omit=dev
./start.sh                                                # test
```

Na stałe — wybierz jedno:

- **PM2:** `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`
- **systemd:** skopiuj `nadgodziny.service` do `/etc/systemd/system/`, popraw ścieżki/użytkownika,
  `systemctl enable --now nadgodziny`

### HTTPS (nginx)

Użyj `nginx.conf.example` (Let's Encrypt), a w `.env` ustaw `COOKIE_SECURE=1` i `TRUST_PROXY=1`.
Bez HTTPS logowanie admina przesyła hasło otwartym tekstem — nie wystawiaj panelu w sieci publicznej bez TLS.

## 2. Docker

```bash
cp .env.example .env     # ADMIN_PASSWORD obowiązkowe
docker compose up -d --build
```

Dane są w wolumenie `nadgodziny-data` (`/data` w kontenerze). Kopia:
`docker run --rm -v nadgodziny_nadgodziny-data:/data -v $PWD:/backup alpine tar czf /backup/data.tgz -C /data .`

Gotowy obraz z GitHub Container Registry powstaje po wypchnięciu taga `vX.Y.Z` (workflow `Release`).

## 3. Sam hosting statyczny

Wgraj zawartość `apps/web/dist/` (zawiera `.htaccess` dla Apache i `_redirects` dla Netlify). Kalkulator działa z
danymi wbudowanymi w aplikację. **Bez serwera Node nie ma panelu administratora** i zmiany kalendarza/wag nie są
współdzielone między nauczycielami.

## Aktualizacja

Nowa paczka → nadpisz `server/` i `web/` (zostaw `.env` i `data/`) → `npm install --omit=dev` → restart.
Format `store.json` jest wersjonowany (`"version": 1`).

## Kopie zapasowe

Wystarczy skopiować `DATA_DIR/store.json`. Konfigurację (ustawienia + kalendarz bez hasła) można też pobrać z panelu:
_Konto i kopie → Pobierz kopię_.

## Zapomniałem hasła admina

Ustaw w środowisku `ADMIN_PASSWORD=nowe-haslo` oraz `ADMIN_PASSWORD_RESET=1`, zrestartuj serwer, zaloguj się i usuń
`ADMIN_PASSWORD_RESET`.

## Zmiana roku szkolnego

Panel → _Ustawienia_ → rok szkolny. Reguły (początek, koniec, przerwy, święta) wyliczą się same; ferie zimowe są
wbudowane dla 2026/2027 — dla kolejnych lat dodaj je w _Kalendarz → zakres → Ferie zimowe_.

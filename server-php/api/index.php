<?php
// Odpowiednik serwera Node dla hostingu PHP: ten sam kontrakt API, wywoływany jako
//   api/index.php?r=config, api/index.php?r=admin/login, ...
declare(strict_types=1);

require __DIR__ . '/lib.php';

$config = require __DIR__ . '/config.php';
$store = new Store((string) ($config['data_dir'] ?? __DIR__ . '/data'));
ensure_admin($store, $config);

$state = $store->get();
if (empty($state['jwtSecret'])) {
    $secret = b64url(random_bytes(48));
    $state = $store->update(function (&$s) use ($secret) {
        $s['jwtSecret'] = $secret;
    }, false);
}
$secret = (string) $state['jwtSecret'];

$route = trim((string) ($_GET['r'] ?? ''), '/');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'POST' && isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
    $method = strtoupper((string) $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
}

/* ---- public ------------------------------------------------------------------------- */

if ($route === 'health') {
    respond(200, ['status' => 'ok', 'revision' => (int) $state['revision']], ['Cache-Control' => 'no-store']);
}

if ($route === 'config') {
    $cfg = $store->publicConfig();
    $etag = 'W/"cfg-' . $cfg['revision'] . '"';
    header('ETag: ' . $etag);
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        respond(304, null, ['Cache-Control' => 'no-cache']);
    }
    respond(200, $cfg, ['Cache-Control' => 'no-cache']);
}

if (strpos($route, 'admin/') !== 0) {
    fail(404, 'Nie znaleziono.');
}

/* ---- admin: CSRF guard ---------------------------------------------------------------- */

if ($method !== 'GET' && !empty($_SERVER['HTTP_ORIGIN'])) {
    $originHost = parse_url((string) $_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $originPort = parse_url((string) $_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    $origin = $originHost . ($originPort ? ':' . $originPort : '');
    if (!$originHost || strcasecmp($origin, (string) ($_SERVER['HTTP_HOST'] ?? '')) !== 0) {
        fail(403, 'Niedozwolone źródło żądania.');
    }
}

$sessionHours = (int) ($config['session_hours'] ?? 8);

function current_admin(string $secret): ?string
{
    return verify_token($_COOKIE[COOKIE_NAME] ?? null, $secret);
}

function require_admin(string $secret): string
{
    $user = current_admin($secret);
    if ($user === null) {
        fail(401, 'Wymagane logowanie administratora.');
    }
    return $user;
}

switch ($route) {
    case 'admin/login':
        if ($method !== 'POST') {
            fail(405, 'Metoda niedozwolona.');
        }
        $password = (string) ($config['admin_password'] ?? '');
        if ($password === '' || $password === PLACEHOLDER_PASSWORD) {
            fail(503, 'Panel jest wyłączony: ustaw hasło administratora w pliku api/config.php.');
        }
        if (rate_limited($store->dir, (int) ($config['login_rate_limit'] ?? 8))) {
            fail(429, 'Zbyt wiele prób. Spróbuj ponownie za ' . retry_after($store->dir) . ' s.');
        }
        $body = read_json_body();
        if (!is_array($body) || empty($body['username']) || empty($body['password'])) {
            fail(400, 'Podaj login i hasło.');
        }
        $admin = $state['admin'] ?? null;
        $hash = $admin['passwordHash'] ?? password_hash('x', PASSWORD_DEFAULT);
        $passOk = password_verify((string) $body['password'], (string) $hash);
        $userOk = $admin !== null && hash_equals((string) $admin['user'], (string) $body['username']);
        if ($admin === null || !$userOk || !$passOk) {
            fail(401, 'Nieprawidłowy login lub hasło.');
        }
        setcookie(COOKIE_NAME, sign_token($admin['user'], $secret, $sessionHours), [
            'expires' => time() + $sessionHours * 3600,
            'path' => '/',
            'secure' => is_https(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        respond(200, ['user' => $admin['user']], ['Cache-Control' => 'no-store']);

    case 'admin/logout':
        setcookie(COOKIE_NAME, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
        respond(200, ['ok' => true], ['Cache-Control' => 'no-store']);

    case 'admin/session':
        respond(200, ['user' => require_admin($secret)], ['Cache-Control' => 'no-store']);

    case 'admin/settings':
        require_admin($secret);
        [$clean, $issues] = validate_settings(read_json_body());
        if ($clean === null) {
            fail(400, 'Niepoprawne ustawienia.', ['issues' => $issues]);
        }
        $store->update(function (&$s) use ($clean) {
            $s['settings'] = $clean;
        });
        respond(200, $store->publicConfig(), ['Cache-Control' => 'no-store']);

    case 'admin/calendar':
        require_admin($secret);
        $body = read_json_body();
        [$days, $issues] = validate_days(is_array($body) ? ($body['customDays'] ?? null) : null);
        if ($days === null) {
            fail(400, 'Niepoprawny kalendarz.', ['issues' => $issues]);
        }
        $store->update(function (&$s) use ($days) {
            $s['customDays'] = $days;
        });
        respond(200, $store->publicConfig(), ['Cache-Control' => 'no-store']);

    case 'admin/password':
        require_admin($secret);
        if (rate_limited($store->dir, (int) ($config['login_rate_limit'] ?? 8))) {
            fail(429, 'Zbyt wiele prób. Spróbuj ponownie za ' . retry_after($store->dir) . ' s.');
        }
        $body = read_json_body();
        $next = is_array($body) ? (string) ($body['next'] ?? '') : '';
        if (str_len($next) < 10) {
            fail(400, 'Hasło musi mieć co najmniej 10 znaków.');
        }
        $admin = $state['admin'] ?? null;
        if ($admin === null || !password_verify((string) ($body['current'] ?? ''), (string) $admin['passwordHash'])) {
            fail(403, 'Aktualne hasło jest nieprawidłowe.');
        }
        $hash = password_hash($next, PASSWORD_DEFAULT);
        $store->update(function (&$s) use ($admin, $hash) {
            $s['admin'] = ['user' => $admin['user'], 'passwordHash' => $hash, 'source' => 'ui'];
        }, false);
        respond(200, ['ok' => true], ['Cache-Control' => 'no-store']);

    case 'admin/backup':
        require_admin($secret);
        $cfg = $store->publicConfig();
        respond(200, ['settings' => $cfg['settings'], 'customDays' => $cfg['customDays']], [
            'Content-Disposition' => 'attachment; filename="nadgodziny-konfiguracja.json"',
            'Cache-Control' => 'no-store',
        ]);

    case 'admin/restore':
        require_admin($secret);
        $body = read_json_body();
        [$settings, $i1] = validate_settings(is_array($body) ? ($body['settings'] ?? null) : null);
        [$days, $i2] = validate_days(is_array($body) ? ($body['customDays'] ?? null) : null);
        if ($settings === null || $days === null) {
            fail(400, 'Plik kopii zapasowej jest niepoprawny.');
        }
        $store->update(function (&$s) use ($settings, $days) {
            $s['settings'] = $settings;
            $s['customDays'] = $days;
        });
        respond(200, $store->publicConfig(), ['Cache-Control' => 'no-store']);

    default:
        fail(404, 'Nie znaleziono.');
}

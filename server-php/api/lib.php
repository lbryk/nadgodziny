<?php
// Wspólne funkcje API: magazyn danych, uwierzytelnianie, walidacja. Zgodne z PHP 7.4+.
declare(strict_types=1);

const COOKIE_NAME = 'nadgodziny_admin';
const DUMMY_HASH = '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
const PLACEHOLDER_PASSWORD = 'ZMIEN-TO-HASLO-NA-WLASNE';

/* ---------------------------------------------------------------- HTTP helpers ------ */

function respond(int $status, $body = null, array $headers = []): void
{
    http_response_code($status);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    if ($body !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }
    exit;
}

function fail(int $status, string $message, array $extra = []): void
{
    respond($status, array_merge(['error' => $message], $extra), ['Cache-Control' => 'no-store']);
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
}

function read_json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return null;
    }
    if (strlen($raw) > 2 * 1024 * 1024) {
        fail(413, 'Żądanie jest za duże.');
    }
    $data = json_decode($raw, true);
    return json_last_error() === JSON_ERROR_NONE ? $data : null;
}

/* ---------------------------------------------------------------- store ------------- */

final class Store
{
    private string $file;
    private array $state;

    public function __construct(string $dir)
    {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            fail(500, 'Nie można utworzyć katalogu danych. Sprawdź uprawnienia katalogu api/data.');
        }
        if (!is_writable($dir)) {
            fail(500, 'Katalog danych nie jest zapisywalny. Nadaj mu uprawnienia 755/775 (api/data).');
        }
        $this->file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'store.php';
        $this->dir = $dir;
        $this->state = $this->load();
    }

    public string $dir;

    private function defaults(): array
    {
        $defaults = json_decode((string) file_get_contents(__DIR__ . '/defaults.json'), true);
        return [
            'version' => 1,
            'revision' => 0,
            'updatedAt' => gmdate('c'),
            'settings' => $defaults['settings'],
            'customDays' => $defaults['customDays'],
            'admin' => null,
            'jwtSecret' => null,
        ];
    }

    private function load(): array
    {
        if (!is_file($this->file)) {
            $state = $this->defaults();
            $this->write($state);
            return $state;
        }
        $raw = (string) file_get_contents($this->file);
        $json = substr($raw, (int) strpos($raw, "\n") + 1);
        $state = json_decode($json, true);
        if (!is_array($state) || !isset($state['settings'], $state['customDays'])) {
            fail(500, 'Plik danych jest uszkodzony (api/data/store.php).');
        }
        return $state;
    }

    private function write(array $state): void
    {
        // PHP wrapper: the file can never be served as text, even without .htaccess support
        $payload = "<?php http_response_code(403); exit; ?>\n"
            . json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION);
        $tmp = $this->file . '.' . getmypid() . '.tmp';
        if (file_put_contents($tmp, $payload, LOCK_EX) === false || !@rename($tmp, $this->file)) {
            @unlink($tmp);
            fail(500, 'Nie udało się zapisać danych.');
        }
    }

    public function get(): array
    {
        return $this->state;
    }

    /** Read-modify-write under an exclusive lock; `$bump` increments the public revision. */
    public function update(callable $mutate, bool $bump = true): array
    {
        $lock = fopen($this->dir . DIRECTORY_SEPARATOR . '.lock', 'c');
        if ($lock) {
            flock($lock, LOCK_EX);
        }
        try {
            $state = $this->load();
            $mutate($state);
            if ($bump) {
                $state['revision'] = (int) $state['revision'] + 1;
            }
            $state['updatedAt'] = gmdate('c');
            $this->write($state);
            $this->state = $state;
        } finally {
            if ($lock) {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        }
        return $this->state;
    }

    public function publicConfig(): array
    {
        $s = $this->state;
        return [
            'settings' => $s['settings'],
            'customDays' => array_values($s['customDays']),
            'revision' => (int) $s['revision'],
            'updatedAt' => $s['updatedAt'],
        ];
    }
}

/* ---------------------------------------------------------------- auth -------------- */

function b64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    return (string) base64_decode(strtr($data, '-_', '+/'));
}

function sign_token(string $user, string $secret, int $hours): string
{
    $payload = b64url(json_encode(['sub' => $user, 'exp' => time() + $hours * 3600]));
    return $payload . '.' . b64url(hash_hmac('sha256', $payload, $secret, true));
}

/** Returns the user name of a valid session cookie, or null. */
function verify_token(?string $token, string $secret): ?string
{
    if (!$token || strpos($token, '.') === false) {
        return null;
    }
    [$payload, $sig] = explode('.', $token, 2);
    if (!hash_equals(b64url(hash_hmac('sha256', $payload, $secret, true)), $sig)) {
        return null;
    }
    $data = json_decode(b64url_decode($payload), true);
    if (!is_array($data) || !isset($data['sub'], $data['exp']) || (int) $data['exp'] < time()) {
        return null;
    }
    return (string) $data['sub'];
}

/** Creates / refreshes the administrator from api/config.php (mirrors ADMIN_PASSWORD of the Node server). */
function ensure_admin(Store $store, array $config): void
{
    $password = (string) ($config['admin_password'] ?? '');
    $user = (string) ($config['admin_user'] ?? 'admin');
    if ($password === '' || $password === PLACEHOLDER_PASSWORD) {
        return;
    }
    $admin = $store->get()['admin'] ?? null;
    $reset = !empty($config['admin_password_reset']);
    $follow = $admin === null || (($admin['source'] ?? '') === 'config') || $reset;
    if (!$follow) {
        return;
    }
    if ($admin === null || $admin['user'] !== $user || !password_verify($password, (string) $admin['passwordHash'])) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $store->update(function (&$s) use ($user, $hash) {
            $s['admin'] = ['user' => $user, 'passwordHash' => $hash, 'source' => 'config'];
        }, false);
    }
}

function rate_limited(string $dir, int $max): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'rate-' . md5($ip) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string) file_get_contents($file), true) ?: [];
    }
    $hits = array_values(array_filter($hits, function ($t) use ($now) {
        return $t > $now - 60;
    }));
    if (count($hits) >= $max) {
        return true;
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
    return false;
}

function retry_after(string $dir): int
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'rate-' . md5($ip) . '.json';
    $hits = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    return $hits ? max(1, 60 - (time() - (int) min($hits))) : 60;
}

/* ---------------------------------------------------------------- validation -------- */

const VOIVODESHIPS = ['dolnoslaskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'lodzkie', 'malopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie', 'pomorskie', 'slaskie', 'swietokrzyskie', 'warminsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'];
const DAY_KINDS = ['school', 'holiday', 'break', 'ferie', 'den', 'director', 'exam', 'other'];

function valid_iso_date($value): bool
{
    if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return false;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

function num_in($value, float $min, float $max): bool
{
    return (is_int($value) || is_float($value)) && $value >= $min && $value <= $max;
}

function str_len(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/** @return array{0: ?array, 1: array} [clean settings or null, issues] */
function validate_settings($d): array
{
    $issues = [];
    if (!is_array($d)) {
        return [null, [['path' => '', 'message' => 'Oczekiwano obiektu.']]];
    }
    $bad = function (string $path, string $msg) use (&$issues) {
        $issues[] = ['path' => $path, 'message' => $msg];
    };
    $name = isset($d['schoolName']) && is_string($d['schoolName']) ? trim($d['schoolName']) : null;
    if ($name === null || str_len($name) < 1 || str_len($name) > 160) {
        $bad('schoolName', 'Nazwa szkoły: 1–160 znaków.');
    }
    if (!isset($d['schoolYearStart']) || !num_in($d['schoolYearStart'], 2024, 2060) || floor((float) $d['schoolYearStart']) != $d['schoolYearStart']) {
        $bad('schoolYearStart', 'Rok szkolny: 2024–2060.');
    }
    if (!isset($d['voivodeship']) || !in_array($d['voivodeship'], VOIVODESHIPS, true)) {
        $bad('voivodeship', 'Nieznane województwo.');
    }
    if (!isset($d['denIsDayOff']) || !is_bool($d['denIsDayOff'])) {
        $bad('denIsDayOff', 'Oczekiwano wartości logicznej.');
    }
    $w = $d['weights'] ?? null;
    foreach (['k12', 'k34', 'k5', 'individual'] as $k) {
        if (!is_array($w) || !isset($w[$k]) || !num_in($w[$k], 0, 2)) {
            $bad("weights.$k", 'Waga: 0–2.');
        }
    }
    if (!isset($d['weeksPerMonth']) || !num_in($d['weeksPerMonth'], 3, 5)) {
        $bad('weeksPerMonth', 'Tygodnie w miesiącu: 3–5.');
    }
    $enums = ['rounding' => ['nearest', 'up', 'down'], 'workdaysBasis' => ['working-days', 'school-days'], 'absenceCounting' => ['lesson-days', 'all-days'], 'examDays' => ['neutral', 'normal']];
    foreach ($enums as $key => $allowed) {
        if (!isset($d[$key]) || !in_array($d[$key], $allowed, true)) {
            $bad($key, 'Niedozwolona wartość.');
        }
    }
    if (!isset($d['class5EndDate']) || !valid_iso_date($d['class5EndDate'])) {
        $bad('class5EndDate', 'Niepoprawna data.');
    }
    $presets = $d['pensumPresets'] ?? null;
    if (!is_array($presets) || count($presets) < 1 || count($presets) > 12) {
        $bad('pensumPresets', 'Lista pensum: 1–12 pozycji.');
    } else {
        foreach ($presets as $i => $p) {
            if (!num_in($p, 1, 60)) {
                $bad("pensumPresets.$i", 'Pensum: 1–60.');
            }
        }
    }
    if (!isset($d['defaultPensum']) || !num_in($d['defaultPensum'], 1, 60)) {
        $bad('defaultPensum', 'Pensum domyślne: 1–60.');
    }
    if (!isset($d['submissionDeadline']) || !is_string($d['submissionDeadline']) || str_len($d['submissionDeadline']) > 32) {
        $bad('submissionDeadline', 'Termin: maks. 32 znaki.');
    }
    if (!isset($d['announcement']) || !is_string($d['announcement']) || str_len($d['announcement']) > 400) {
        $bad('announcement', 'Komunikat: maks. 400 znaków.');
    }
    if ($issues) {
        return [null, $issues];
    }
    return [[
        'schoolName' => $name,
        'schoolYearStart' => (int) $d['schoolYearStart'],
        'voivodeship' => $d['voivodeship'],
        'denIsDayOff' => $d['denIsDayOff'],
        'weights' => ['k12' => $w['k12'], 'k34' => $w['k34'], 'k5' => $w['k5'], 'individual' => $w['individual']],
        'weeksPerMonth' => $d['weeksPerMonth'],
        'rounding' => $d['rounding'],
        'workdaysBasis' => $d['workdaysBasis'],
        'absenceCounting' => $d['absenceCounting'],
        'examDays' => $d['examDays'],
        'class5EndDate' => $d['class5EndDate'],
        'pensumPresets' => array_values($presets),
        'defaultPensum' => $d['defaultPensum'],
        'submissionDeadline' => $d['submissionDeadline'],
        'announcement' => $d['announcement'],
    ], []];
}

/** @return array{0: ?array, 1: array} sorted, de-duplicated by date */
function validate_days($days): array
{
    if (!is_array($days) || (count($days) > 0 && array_keys($days) !== range(0, count($days) - 1))) {
        return [null, [['path' => '', 'message' => 'Oczekiwano listy dni.']]];
    }
    if (count($days) > 1500) {
        return [null, [['path' => '', 'message' => 'Za dużo dni (maks. 1500).']]];
    }
    $issues = [];
    $byDate = [];
    foreach ($days as $i => $day) {
        if (!is_array($day) || !isset($day['date']) || !valid_iso_date($day['date'])) {
            $issues[] = ['path' => "$i.date", 'message' => 'Niepoprawna data (RRRR-MM-DD).'];
            continue;
        }
        if (!isset($day['kind']) || !in_array($day['kind'], DAY_KINDS, true)) {
            $issues[] = ['path' => "$i.kind", 'message' => 'Niepoprawny rodzaj dnia.'];
            continue;
        }
        $entry = ['date' => $day['date'], 'kind' => $day['kind']];
        if (array_key_exists('label', $day) && $day['label'] !== null) {
            if (!is_string($day['label']) || str_len(trim($day['label'])) > 160) {
                $issues[] = ['path' => "$i.label", 'message' => 'Opis: maks. 160 znaków.'];
                continue;
            }
            $entry['label'] = trim($day['label']);
        }
        $byDate[$day['date']] = $entry;
    }
    if ($issues) {
        return [null, $issues];
    }
    ksort($byDate);
    return [array_values($byDate), []];
}

<?php
// Ustawienia API (hosting PHP). Edytuj ten plik przez FTP PRZED pierwszym uruchomieniem.
//
// Hasło administratora: zmień wartość poniżej na długie, własne hasło.
// Po pierwszym zalogowaniu możesz je zmienić w panelu (Konto i kopie) — wtedy ten plik
// przestaje mieć znaczenie, chyba że ustawisz 'admin_password_reset' => true.
return [
    'admin_user' => 'admin',
    'admin_password' => 'ZMIEN-TO-HASLO-NA-WLASNE',
    'admin_password_reset' => false,

    // Sesja panelu admina w godzinach i limit prób logowania na minutę (na adres IP).
    'session_hours' => 8,
    'login_rate_limit' => 8,

    // Katalog na dane (ustawienia, kalendarz, skrót hasła). Domyślnie api/data (zabezpieczony).
    // Można wskazać ścieżkę POZA katalogiem WWW, np. '/home/uzytkownik/nadgodziny-dane'.
    'data_dir' => __DIR__ . '/data',
];

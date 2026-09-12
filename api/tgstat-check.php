<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow, noarchive');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

set_error_handler(static function (): bool {
    // Never let warnings reveal server paths or configuration details.
    return true;
});

$root = dirname(__DIR__);
$publicRoot = $_SERVER['DOCUMENT_ROOT'] ?? $root;
if (!is_dir($publicRoot)) {
    $publicRoot = $root;
}
$private = dirname($root) . '/.romanulin-private';
$configFile = $private . '/tgstat.php';

$resolvePath = static function (string $path): string {
    $resolved = realpath($path);
    return str_replace('\\', '/', $resolved !== false ? $resolved : $path);
};

$privateExists = is_dir($private);
$configExists = is_file($configFile);
$configReadable = $configExists && is_readable($configFile);
$configFileSizeRaw = $configExists ? filesize($configFile) : false;
$configFileSize = is_int($configFileSizeRaw) ? $configFileSizeRaw : null;
$configStartsWithPhpTag = false;
$configHasReturnKeyword = false;
$configLoadedType = null;
$configLoadErrorClass = null;
$config = [];
$configLoadedAsArray = false;

if ($configReadable) {
    $configSource = file_get_contents($configFile);
    if (is_string($configSource)) {
        $configStartsWithPhpTag = str_starts_with($configSource, '<?php');
        $configHasReturnKeyword = preg_match('/\breturn\b/i', $configSource) === 1;
    }
    unset($configSource);

    $bufferLevel = ob_get_level();
    try {
        // Discard any accidental output from the private file.
        if (!ob_start(static function (string $buffer): string { return ''; })) {
            throw new RuntimeException('Output buffer unavailable');
        }
        try {
            $loaded = require $configFile;
        } finally {
            ob_end_clean();
        }
        $configLoadedType = gettype($loaded);
        if (is_array($loaded)) {
            $config = $loaded;
            $configLoadedAsArray = true;
        }
    } catch (Throwable $error) {
        while (ob_get_level() > $bufferLevel) {
            ob_end_clean();
        }
        $errorClass = get_class($error);
        $separator = strrpos($errorClass, '\\');
        $configLoadErrorClass = $separator === false
            ? $errorClass
            : substr($errorClass, $separator + 1);
    }
}

// Match the effective token and cache settings used by api/tgstat.php.
$token = trim((string) (getenv('TGSTAT_TOKEN') ?: ($config['TGSTAT_TOKEN'] ?? '')));
$cacheDirectory = (string) (getenv('TGSTAT_CACHE_DIR') ?: ($config['TGSTAT_CACHE_DIR'] ?? $private . '/cache'));
$cacheExists = is_dir($cacheDirectory);
$curlAvailable = function_exists('curl_init');

$result = [
    'private_directory_exists' => $privateExists,
    'config_file_exists' => $configExists,
    'config_file_readable' => $configReadable,
    'config_file_size' => $configFileSize,
    'config_starts_with_php_tag' => $configStartsWithPhpTag,
    'config_loaded_type' => $configLoadedType,
    'config_load_error_class' => $configLoadErrorClass,
    'config_has_return_keyword' => $configHasReturnKeyword,
    'config_loaded_as_array' => $configLoadedAsArray,
    'token_present' => $token !== '',
    'token_length' => strlen($token),
    'cache_directory_exists' => $cacheExists,
    'cache_directory_writable' => $cacheExists && is_writable($cacheDirectory),
    'curl_available' => $curlAvailable,
    'resolved_private_path' => $resolvePath($private),
    'resolved_public_root' => $resolvePath($publicRoot),
];

$localChecksPassed = $result['private_directory_exists']
    && $result['config_file_exists']
    && $result['config_file_readable']
    && $result['config_loaded_as_array']
    && $result['token_present']
    && $result['cache_directory_exists']
    && $result['cache_directory_writable']
    && $result['curl_available'];

if ($localChecksPassed) {
    $curl = null;
    try {
        // Exactly one request during this execution. The URL and response body
        // are never returned or logged by this endpoint.
        $query = http_build_query([
            'token' => $token,
            'channelId' => '@direct_ulin',
        ]);
        $curl = curl_init('https://api.tgstat.ru/channels/stat?' . $query);
        if ($curl === false) {
            throw new RuntimeException('cURL initialization failed');
        }
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $raw = curl_exec($curl);
        $result['upstream_http_status'] = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $decoded = is_string($raw) && strlen($raw) <= 1048576
            ? json_decode($raw, true)
            : null;

        $tgstatStatus = is_array($decoded) && is_scalar($decoded['status'] ?? null)
            ? (string) $decoded['status']
            : null;
        $result['tgstat_status'] = $tgstatStatus !== null
            ? substr($tgstatStatus, 0, 64)
            : null;

        $errorCode = null;
        if (is_array($decoded)) {
            if (is_scalar($decoded['error_code'] ?? null)) {
                $errorCode = $decoded['error_code'];
            } elseif (is_array($decoded['error'] ?? null) && is_scalar($decoded['error']['code'] ?? null)) {
                $errorCode = $decoded['error']['code'];
            }
        }
        if ($errorCode !== null) {
            $result['tgstat_error_code'] = substr((string) $errorCode, 0, 64);
        }
    } catch (Throwable $error) {
        $result['upstream_http_status'] = 0;
        $result['tgstat_status'] = null;
    } finally {
        if ($curl !== null && $curl !== false) {
            curl_close($curl);
        }
    }
}

restore_error_handler();
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

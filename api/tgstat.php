<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

$empty = ['channel' => '@direct_ulin', 'metrics' => null, 'updatedAt' => null, 'stale' => false];
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode($empty);
    exit;
}
set_error_handler(static function (): bool { return true; });
try {
    require_once __DIR__ . '/tgstat-lib.php';
    $root = dirname(__DIR__);
    $publicRoot = $_SERVER['DOCUMENT_ROOT'] ?? $root;
    if (!is_dir($publicRoot)) $publicRoot = $root;
    $private = dirname($root) . '/.romanulin-private';
    $configFile = $private . '/tgstat.php';
    $config = [];
    if (is_file($configFile)) {
        if (!tgstat_outside_root(dirname($configFile), $root)
            || !tgstat_outside_root(dirname($configFile), $publicRoot)) throw new RuntimeException('Private config required');
        $loaded = require $configFile;
        if (is_array($loaded)) $config = $loaded;
    }
    $token = trim((string)(getenv('TGSTAT_TOKEN') ?: ($config['TGSTAT_TOKEN'] ?? '')));
    $rawTtl = getenv('TGSTAT_CACHE_TTL') ?: ($config['TGSTAT_CACHE_TTL'] ?? 86400);
    $ttl = filter_var($rawTtl, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 86400;
    $cacheDirectory = (string)(getenv('TGSTAT_CACHE_DIR') ?: ($config['TGSTAT_CACHE_DIR'] ?? $private . '/cache'));
    if (!is_dir($cacheDirectory)) {
        // Check parent before creating anything; never create a public cache.
        if (!is_dir($private)) mkdir($private, 0700, true);
        if (!tgstat_outside_root(dirname($cacheDirectory), $root)
            || !tgstat_outside_root(dirname($cacheDirectory), $publicRoot)) throw new RuntimeException('Private cache required');
        mkdir($cacheDirectory, 0700, true);
    }
    if (!tgstat_outside_root($cacheDirectory, $root)
        || !tgstat_outside_root($cacheDirectory, $publicRoot)) throw new RuntimeException('Private cache required');
    $result = tgstat_cached($cacheDirectory, $token, $ttl);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    echo json_encode($empty);
} finally {
    restore_error_handler();
}

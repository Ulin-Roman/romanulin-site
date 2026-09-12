<?php
declare(strict_types=1);

// No credentials live in this library. The live config/cache are accepted only
// outside the web root or in the explicitly protected .romanulin-private folder.
function tgstat_outside_root(string $directory, string $root): bool
{
    $path = realpath($directory);
    $public = realpath($root);
    if ($path === false || $public === false) return false;
    $path = strtolower(str_replace('\\', '/', $path));
    $public = rtrim(strtolower(str_replace('\\', '/', $public)), '/');
    return $path !== $public && strpos($path, $public . '/') !== 0;
}

function tgstat_inside_private(string $path, string $private): bool
{
    $resolved = realpath($path);
    $resolvedPrivate = realpath($private);
    if ($resolved === false || $resolvedPrivate === false) return false;
    $resolved = str_replace('\\', '/', $resolved);
    $resolvedPrivate = rtrim(str_replace('\\', '/', $resolvedPrivate), '/');
    if (DIRECTORY_SEPARATOR === '\\') {
        $resolved = strtolower($resolved);
        $resolvedPrivate = strtolower($resolvedPrivate);
    }
    return $resolved === $resolvedPrivate || strpos($resolved, $resolvedPrivate . '/') === 0;
}

function tgstat_private_guarded(string $private, string $root): bool
{
    $resolvedPrivate = realpath($private);
    $expectedPrivate = realpath(rtrim($root, '/\\') . '/.romanulin-private');
    if ($resolvedPrivate === false || $expectedPrivate === false) return false;
    $resolvedPrivate = str_replace('\\', '/', $resolvedPrivate);
    $expectedPrivate = str_replace('\\', '/', $expectedPrivate);
    if (DIRECTORY_SEPARATOR === '\\') {
        $resolvedPrivate = strtolower($resolvedPrivate);
        $expectedPrivate = strtolower($expectedPrivate);
    }
    if ($resolvedPrivate !== $expectedPrivate) return false;
    $guard = $private . '/.htaccess';
    if (!is_file($guard) || !is_readable($guard)) return false;
    $rules = file_get_contents($guard);
    return is_string($rules) && preg_match('/^\s*Require\s+all\s+denied\s*$/mi', $rules) === 1;
}

function tgstat_metrics(array $response): ?array
{
    if (($response['status'] ?? '') !== 'ok' || !is_array($response['response'] ?? null)) return null;
    $data = $response['response'];
    if (strtolower(ltrim((string)($data['username'] ?? ''), '@')) !== 'direct_ulin'
        || ($data['peer_type'] ?? '') !== 'channel') return null;
    $metrics = [];
    foreach (['participants_count', 'avg_post_reach', 'adv_post_reach_24h', 'err_percent', 'err24_percent', 'ci_index'] as $field) {
        $value = $data[$field] ?? null;
        $metrics[$field] = is_numeric($value) && is_finite((float)$value) && (float)$value >= 0 ? 0 + $value : null;
    }
    if ($metrics['participants_count'] === null || $metrics['avg_post_reach'] === null) return null;
    return $metrics;
}

function tgstat_fetch(string $token): ?array
{
    if (!function_exists('curl_init')) return null;
    $query = http_build_query(['token' => $token, 'channelId' => '@direct_ulin']);
    $curl = curl_init('https://api.tgstat.ru/channels/stat?' . $query);
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
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    // Never pass an upstream response/error (which may mention credentials) to the caller.
    if ($status !== 200 || !is_string($raw) || strlen($raw) > 1048576) return null;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? tgstat_metrics($decoded) : null;
}

function tgstat_read_cache(string $path): ?array
{
    if (!is_file($path)) return null;
    $data = json_decode((string)file_get_contents($path), true);
    if (!is_array($data) || !is_array($data['metrics'] ?? null)
        || !is_int($data['fetchedAt'] ?? null) || $data['fetchedAt'] <= 0) return null;
    // Only the six allowed numeric fields can leave the server, including from cache.
    $clean = tgstat_metrics(['status' => 'ok', 'response' => array_merge($data['metrics'], [
        'username' => '@direct_ulin', 'peer_type' => 'channel'
    ])]);
    return $clean === null ? null : ['metrics' => $clean, 'fetchedAt' => $data['fetchedAt']];
}

function tgstat_result(?array $cache, int $now, int $ttl): array
{
    return [
        'channel' => '@direct_ulin',
        'metrics' => $cache['metrics'] ?? null,
        'updatedAt' => $cache ? gmdate('Y-m-d\TH:i:s\Z', $cache['fetchedAt']) : null,
        'stale' => $cache ? $now - $cache['fetchedAt'] >= $ttl : false,
    ];
}

function tgstat_store(string $path, array $data): bool
{
    $temp = tempnam(dirname($path), 'tgstat-');
    if ($temp === false) return false;
    try {
        chmod($temp, 0600);
        if (file_put_contents($temp, json_encode($data, JSON_THROW_ON_ERROR), LOCK_EX) === false) return false;
        return rename($temp, $path);
    } finally {
        if (is_file($temp)) unlink($temp);
    }
}

// Clock and fetch callback are injectable only by server-side tests, never by HTTP input.
function tgstat_cached(string $directory, string $token, int $ttl, ?callable $fetch = null, ?int $now = null): array
{
    $now = $now ?? time();
    $ttl = $ttl > 0 ? $ttl : 86400;
    $empty = tgstat_result(null, $now, $ttl);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) return $empty;
    $path = $directory . '/direct-ulin.json';
    $cache = tgstat_read_cache($path);
    if ($cache && $now >= $cache['fetchedAt'] && $now - $cache['fetchedAt'] < $ttl) return tgstat_result($cache, $now, $ttl);
    if ($token === '') return tgstat_result($cache, $now, $ttl);
    $lock = fopen($directory . '/direct-ulin.lock', 'c+');
    if ($lock === false) return tgstat_result($cache, $now, $ttl);
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        return tgstat_result($cache, $now, $ttl);
    }
    try {
        $cache = tgstat_read_cache($path);
        if ($cache && $now >= $cache['fetchedAt'] && $now - $cache['fetchedAt'] < $ttl) return tgstat_result($cache, $now, $ttl);
        $retryFile = $directory . '/direct-ulin-retry.json';
        $retry = is_file($retryFile) ? json_decode((string)file_get_contents($retryFile), true) : null;
        if (($retry['after'] ?? 0) > $now) return tgstat_result($cache, $now, $ttl);
        // Persist cooldown before requesting: outages or quota errors cannot trigger a request storm.
        if (!tgstat_store($retryFile, ['after' => $now + 300])) return tgstat_result($cache, $now, $ttl);
        $metrics = ($fetch ?? 'tgstat_fetch')($token);
        if ($metrics !== null) {
            $fresh = ['metrics' => $metrics, 'fetchedAt' => $now];
            if (tgstat_store($path, $fresh)) $cache = $fresh;
        }
    } catch (Throwable $error) {
        // Keep the last successful snapshot. Do not log or expose token-bearing errors.
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    return tgstat_result($cache, $now, $ttl);
}

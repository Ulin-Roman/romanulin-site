<?php
declare(strict_types=1);
require __DIR__ . '/../api/tgstat-lib.php';
function check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException($label);
    echo "OK: $label\n";
}
$dir = sys_get_temp_dir() . '/romanulin-tgstat-test-' . bin2hex(random_bytes(6));
mkdir($dir, 0700);
$removeTree = function (string $path) use (&$removeTree): void {
    if (!is_dir($path)) return;
    foreach (scandir($path) ?: [] as $name) {
        if ($name === '.' || $name === '..') continue;
        $item = $path . '/' . $name;
        is_dir($item) ? $removeTree($item) : unlink($item);
    }
    rmdir($path);
};
try {
    $response = ['status' => 'ok', 'response' => ['username' => '@direct_ulin', 'peer_type' => 'channel', 'participants_count' => 100, 'avg_post_reach' => 50, 'err_percent' => 0, 'token' => 'must-not-leak']];
    $metrics = tgstat_metrics($response);
    check(count($metrics) === 6 && $metrics['err_percent'] === 0 && $metrics['ci_index'] === null, 'numeric whitelist, zero and missing metrics');
    $response['response']['username'] = '@other';
    check(tgstat_metrics($response) === null, 'wrong channel rejected');
    $calls = 0;
    $fetch = function () use (&$calls, $metrics) { $calls++; return $metrics; };
    check(tgstat_cached($dir, '', 86400, $fetch, 100000)['metrics'] === null && $calls === 0, 'no token: neutral state, no request');
    $first = tgstat_cached($dir, 'test-only', 86400, $fetch, 100000);
    check($first['metrics'] === $metrics && $calls === 1, 'cold cache populated');
    $fresh = tgstat_cached($dir, 'test-only', 86400, $fetch, 100100);
    check($calls === 1 && $fresh['updatedAt'] === $first['updatedAt'], 'fresh cache avoids upstream');
    $failure = function () use (&$calls) { $calls++; throw new RuntimeException('test outage'); };
    $stale = tgstat_cached($dir, 'test-only', 86400, $failure, 200000);
    check($stale['stale'] && $stale['metrics'] === $metrics && $stale['updatedAt'] === $first['updatedAt'], 'failure preserves data and successful timestamp');
    tgstat_cached($dir, 'test-only', 86400, $fetch, 200001);
    check($calls === 2, 'outage cooldown prevents request storm');
    $renewed = tgstat_cached($dir, 'test-only', 86400, $fetch, 200301);
    check($calls === 3 && !$renewed['stale'] && $renewed['updatedAt'] !== $first['updatedAt'], 'expired cache renews after cooldown');
    $lock = fopen($dir . '/direct-ulin.lock', 'c+');
    flock($lock, LOCK_EX);
    tgstat_cached($dir, 'test-only', 1, $fetch, 300000);
    check($calls === 3, 'concurrent refresh serves cache');
    flock($lock, LOCK_UN); fclose($lock);
    check(!tgstat_outside_root(__DIR__, dirname(__DIR__)) && tgstat_outside_root($dir, dirname(__DIR__)), 'public cache forbidden');
    $public = $dir . '/public';
    $private = $public . '/.romanulin-private';
    mkdir($private, 0700, true);
    file_put_contents($private . '/.htaccess', "Require all denied\n");
    file_put_contents($private . '/tgstat.php', "<?php return [];\n");
    mkdir($private . '/cache');
    check(tgstat_private_guarded($private, $public), 'exact protected public_html directory accepted');
    check(tgstat_inside_private($private . '/tgstat.php', $private)
        && tgstat_inside_private($private . '/cache', $private)
        && !tgstat_inside_private($public, $private), 'only protected subtree accepted');
} finally {
    $removeTree($dir);
}

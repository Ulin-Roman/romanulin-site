<?php
// Copy as public_html/.romanulin-private/tgstat.php on Timeweb.
// That directory must contain the supplied .htaccess with Require all denied.
// Never enter a real token in this template or in a tracked/public file.
return [
    'TGSTAT_TOKEN' => 'YOUR_TGSTAT_TOKEN',
    'TGSTAT_CACHE_TTL' => 86400,
    // Optional absolute path inside public_html/.romanulin-private:
    // 'TGSTAT_CACHE_DIR' => '/absolute/public_html/.romanulin-private/cache',
];

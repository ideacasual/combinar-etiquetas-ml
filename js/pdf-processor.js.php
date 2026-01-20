<?php
// Define cache duration (7 days)
$expires = 60 * 60 * 24 * 7;
// Use absolute path for security and reliability
$js_file_path = __DIR__ . '/pdf-processor.js';

// 1. SECURITY: Check if the file exists and is readable FIRST
if (!is_file($js_file_path) || !is_readable($js_file_path)) {
    // Send a 404 to the client without revealing the path
    header("HTTP/1.1 404 Not Found");
    header("Content-type: text/plain");
    echo "// Resource not found.";
    exit;
}

// 2. Now it's safe to get the file's metadata
$last_modified_time = filemtime($js_file_path);

// Set content headers
header("Content-type: application/javascript; charset: UTF-8");
header("Cache-Control: max-age=" . $expires);
header("Last-Modified: " . gmdate("D, d M Y H:i:s", $last_modified_time) . " GMT");
header("Expires: " . gmdate("D, d M Y H:i:s", time() + $expires) . " GMT");

// 3. Check if the client's cache is valid
if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && 
    (strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) === $last_modified_time)) {
    header("HTTP/1.1 304 Not Modified");
    exit;
}

// 4. Add a security comment at the top
echo "/* PDF Processor - Served via secure wrapper */\n";

// 5. If we get here, send the full JavaScript file
readfile($js_file_path);
?>
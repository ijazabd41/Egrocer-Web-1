<?php
// proxy.php
// A simple PHP proxy to forward requests to the Odoo ERP and bypass CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Session-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            } else if ($name == "CONTENT_TYPE") {
                $headers["Content-Type"] = $value;
            } else if ($name == "CONTENT_LENGTH") {
                $headers["Content-Length"] = $value;
            }
        }
        return $headers;
    }
}

// Safe URL parsing from REQUEST_URI without Apache URL-decoding
$uri = $_SERVER['REQUEST_URI'];
$parsedUrl = parse_url($uri);
$path = isset($parsedUrl['path']) ? $parsedUrl['path'] : '';
$prefix = '/proxy.php';
$pos = strpos($path, $prefix);
if ($pos !== false) {
    $pathInfo = substr($path, $pos + strlen($prefix));
} else {
    $pathInfo = $path; // Fallback
}

function isImage($p) {
    return strpos($p, '/web/image/') !== false || strpos($p, '/web/binary/') !== false;
}

$queryString = isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '';

// Fix: Odoo backend fails to decode %40 in email fields, so we must pass @ unencoded
$queryString = str_replace('%40', '@', $queryString);

if (!isImage($pathInfo)) {
    if (strpos($queryString, 'by_AJR=') === false) {
        if (!empty($queryString)) {
            $queryString .= '&by_AJR=1';
        } else {
            $queryString = 'by_AJR=1';
        }
    }
}

$targetUrl = 'http://cooperp.freeddns.org:8076' . $pathInfo;
if (!empty($queryString)) {
    $targetUrl .= '?' . $queryString;
}

$ch = curl_init($targetUrl);

$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$sessionToken = '';
foreach (getallheaders() as $name => $value) {
    $lowerName = strtolower($name);
    if ($lowerName === 'x-session-token') {
        $sessionToken = $value;
    }
}

$headers = array();
foreach (getallheaders() as $name => $value) {
    $lowerName = strtolower($name);
    if ($lowerName !== 'host' && $lowerName !== 'content-length' && $lowerName !== 'connection' && $lowerName !== 'x-session-token' && $lowerName !== 'accept-encoding') {
        if ($lowerName === 'cookie' && $sessionToken) {
            $value .= '; session_id=' . $sessionToken;
            $sessionToken = ''; // prevent adding it twice
        }
        $headers[] = "$name: $value";
    }
}
if ($sessionToken) {
    $headers[] = "Cookie: session_id=$sessionToken";
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_ENCODING, ""); // Automatically handle gzip/deflate decoding

$responseHeaders = array();
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders) {
    $len = strlen($header);
    $headerParts = explode(':', $header, 2);
    if (count($headerParts) < 2) return $len;
    $name = strtolower(trim($headerParts[0]));
    $responseHeaders[$name][] = trim($headerParts[1]);
    return $len;
});

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $httpCode = 500;
    $response = json_encode(['error' => 'Proxy cURL Error: ' . curl_error($ch)]);
}
curl_close($ch);

// Expose headers for frontend
header('Access-Control-Expose-Headers: Set-Cookie, Content-Type, Content-Disposition, X-Set-Session-Token');

if (isset($responseHeaders['set-cookie'])) {
    foreach ($responseHeaders['set-cookie'] as $cookie) {
        if (preg_match('/session_id=([^;]+)/', $cookie, $matches)) {
            header('X-Set-Session-Token: ' . $matches[1]);
        }
        header('Set-Cookie: ' . $cookie, false);
    }
}

if (isset($responseHeaders['content-type'])) {
    header('Content-Type: ' . $responseHeaders['content-type'][0]);
} else {
    header('Content-Type: application/json');
}

http_response_code($httpCode);
echo $response;
?>

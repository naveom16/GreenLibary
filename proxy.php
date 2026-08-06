<?php
/**
 * [OPTIONAL] proxy.php
 * ใช้ไฟล์นี้เฉพาะเมื่อ deploy บนโฮสต์ที่รองรับ PHP (เช่น cPanel, VPS) เท่านั้น
 * GitHub Pages เป็น Static Hosting ไม่รองรับการรัน PHP — บน GitHub Pages ให้ปล่อย
 * PROXY_URL ว่างไว้ใน index.html เพื่อให้เรียก Google Apps Script (API_URL) ตรง ๆ แทน
 * (ดูคอมเมนต์อธิบายกลไก CORS ที่ getHeaders() ในไฟล์ index.html)
 *
 * ถ้าต้องการใช้ไฟล์นี้ ให้ตั้งค่า window.NRRU_GREEN_CONFIG.PROXY_URL ใน index.html
 * ให้ชี้มาที่ URL ของไฟล์นี้ เช่น '/proxy.php'
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$targetApiUrl = 'https://script.google.com/macros/s/AKfycbzGXDz4aAfSxNxJ7Kq0AJNrieQ8SVVQiNfAnXIAK5FtXZidBu1rEROHJ0EVzCM9O1am/exec';
$targetApiKey = 'AIzaSyCXCHIB8bLk27t9_pVQ7LK3jX4F64lbyH4';

$payload = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    if ($rawBody !== '') {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded)) {
            $payload = $decoded;
        }
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $payload = [
        'action' => $_GET['action'] ?? '',
        'payload' => []
    ];

    if (isset($_GET['payload'])) {
        $decodedPayload = json_decode($_GET['payload'], true);
        if (is_array($decodedPayload)) {
            $payload['payload'] = $decodedPayload;
        }
    }

    if (isset($_GET['apiKey'])) {
        $payload['apiKey'] = $_GET['apiKey'];
    }
}

$forwardPayload = [
    'action' => $payload['action'] ?? '',
    'payload' => $payload['payload'] ?? [],
    'apiKey' => $payload['apiKey'] ?? $targetApiKey
];

$ch = curl_init($targetApiUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($forwardPayload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ' . ($payload['apiKey'] ?? $targetApiKey)
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'Upstream request failed']);
    exit;
}

http_response_code($httpCode ?: 200);
echo $response;

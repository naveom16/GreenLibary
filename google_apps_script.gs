// Google Apps Script for NRRU Green Library
// 1) Create a Google Spreadsheet and copy its ID.
// 2) In Apps Script > Project Settings > Script Properties, add:
//    - SPREADSHEET_ID: <your-sheet-id>
//    - API_KEY: <your-secret-key>
// 3) Deploy as a Web App and set the deployment URL in the HTML config.

function doGet(e) {
  if (isPreflightRequest(e)) {
    return createCorsResponse('', 204);
  }
  return createTextResponse('NRRU Green Library API is ready.');
}

function doPost(e) {
  if (isPreflightRequest(e)) {
    return createCorsResponse('', 204);
  }

  try {
    const data = typeof e.postData?.contents === 'string' ? JSON.parse(e.postData.contents) : {};
    const action = data.action || 'getDashboardData';
    const payload = data.payload || {};
    const providedKey = data.apiKey || e.parameter?.apiKey || e.headers?.['x-api-key'] || e.parameter?.['X-API-Key'];
    const expectedKey = PropertiesService.getScriptProperties().getProperty('API_KEY');

    if (expectedKey && providedKey && providedKey !== expectedKey) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    switch (action) {
      case 'loginUser':
        return jsonResponse(loginUser(payload));
      case 'registerUser':
        return jsonResponse(registerUser(payload));
      case 'getDashboardData':
        return jsonResponse(getDashboardData(payload));
      case 'getUserProfile':
        return jsonResponse(getUserProfile(payload));
      case 'getCarbonHistory':
        return jsonResponse(getCarbonHistory(payload));
      case 'saveCarbonLog':
        return jsonResponse(saveCarbonLog(payload));
      case 'updateCarbonLog':
        return jsonResponse(updateCarbonLog(payload));
      case 'deleteCarbonLog':
        return jsonResponse(deleteCarbonLog(payload));
      case 'getFacultyRanking':
        return jsonResponse(getFacultyRanking(payload));
      case 'getMajorRanking':
        return jsonResponse(getMajorRanking(payload));
      case 'getUserRank':
        return jsonResponse(getUserRankForPayload(payload));
      case 'getPublicDashboardData':
        return jsonResponse(getPublicDashboardData());
      case 'getPublicStats':
        return jsonResponse(getPublicStats());
      case 'getLevelStats':
        return jsonResponse(getLevelStats());
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// หมายเหตุสำคัญเรื่อง CORS:
// Google Apps Script Web App ไม่สามารถตอบสนอง Preflight (OPTIONS) request ได้อย่างสมบูรณ์
// (แม้จะมี doOptions ด้านล่าง แต่ Apps Script runtime มักไม่เรียกใช้งานจริงตามที่เบราว์เซอร์คาดหวัง)
// ดังนั้นวิธีแก้ปัญหาหลักคือฝั่ง "ไคลเอนต์ (index.html)" ต้องส่งคำขอแบบ Simple Request เท่านั้น
// (Content-Type: text/plain และไม่มี Custom Header เช่น X-API-Key) เพื่อไม่ให้เบราว์เซอร์ส่ง Preflight มาก่อน
// เมื่อเป็น Simple Request แล้ว Apps Script จะตอบกลับพร้อม Access-Control-Allow-Origin: * โดยอัตโนมัติ
function doOptions(e) {
  return createCorsResponse('', 204);
}

function isPreflightRequest(e) {
  const method = e?.parameter?.method || e?.parameter?.httpMethod || '';
  return method.toUpperCase() === 'OPTIONS';
}

function createCorsResponse(content, statusCode) {
  const output = ContentService.createTextOutput(content);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function createTextResponse(content) {
  const output = ContentService.createTextOutput(content);
  output.setMimeType(ContentService.MimeType.TEXT);
  return output;
}

function jsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getSpreadsheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Set SPREADSHEET_ID in Script Properties.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSheet(name) {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length === 0) {
    sheet.appendRow(headers);
    return;
  }
  const existing = values[0];
  if (existing.join('') !== headers.join('')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function getUsersSheet() {
  const sheet = getSheet('Users');
  // [NEW] เพิ่มคอลัมน์ StudentID และ Phone ต่อท้าย เพื่อไม่ให้กระทบตำแหน่งคอลัมน์เดิมของชีตที่มีอยู่แล้ว
  ensureHeaders(sheet, ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password', 'StudentID', 'Phone']);
  return sheet;
}

function getCarbonLogsSheet() {
  const sheet = getSheet('CarbonLogs');
  ensureHeaders(sheet, ['LogID', 'UserID', 'DateTime', 'WasteType', 'Quantity', 'CarbonSaved', 'GreenPoint', 'ImageURL', 'Status']);
  return sheet;
}

function rowsToObjects(rows, headers) {
  return rows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}

function getHeaderIndex(headers, headerName) {
  return headers.indexOf(headerName);
}

function getCellValue(row, headers, headerName, fallback = '') {
  const index = getHeaderIndex(headers, headerName);
  return index >= 0 ? (row[index] ?? fallback) : fallback;
}

function getOrCreateUser(userEmail, username) {
  const sheet = getUsersSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password', 'StudentID', 'Phone'];
  const rows = values.slice(1);
  // ทำให้เป็นตัวพิมพ์เล็กเสมอ ให้สอดคล้องกับ registerUser()/loginUser() ป้องกันการสร้าง user ซ้ำจากตัวพิมพ์ใหญ่/เล็กต่างกัน
  const userId = String(userEmail || `user-${Date.now()}`).trim().toLowerCase();

  const existing = rows.find((row) => String(getCellValue(row, headers, 'UserID', '')) === String(userId));
  if (existing) {
    return rowsToObjects([existing], headers)[0];
  }

  const now = new Date().toISOString();
  const newRow = [
    userId,
    username || userEmail || 'Guest',
    'คณะวิทยาศาสตร์',
    'CS',
    now,
    0,
    0,
    now,
    userEmail || '',
    '',
    '',
    ''
  ];
  sheet.appendRow(newRow);
  return {
    UserID: userId,
    Username: username || userEmail || 'Guest',
    Faculty: 'คณะวิทยาศาสตร์',
    Major: 'CS',
    JoinDate: now,
    TotalGreenPoint: 0,
    TotalCarbonSaved: 0,
    LastActive: now,
    Email: userEmail || '',
    Password: '',
    StudentID: '',
    Phone: ''
  };
}

function registerUser(payload) {
  const userEmail = String(payload.email || payload.userEmail || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const username = String(payload.name || payload.username || userEmail.split('@')[0] || 'Guest');
  const faculty = String(payload.faculty || 'คณะวิทยาศาสตร์');
  const major = String(payload.major || 'CS');
  const studentId = String(payload.studentId || payload.studentID || '');
  const phone = String(payload.phone || '');

  if (!userEmail || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const sheet = getUsersSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password', 'StudentID', 'Phone'];
  const rows = values.slice(1);
  const existing = rows.find((row) => String(getCellValue(row, headers, 'Email', '')).toLowerCase() === userEmail);
  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const now = new Date().toISOString();
  sheet.appendRow([userEmail, username, faculty, major, now, 0, 0, now, userEmail, password, studentId, phone]);
  invalidatePublicStatsCache();
  const profile = {
    UserID: userEmail,
    Username: username,
    Faculty: faculty,
    Major: major,
    JoinDate: now,
    TotalGreenPoint: 0,
    TotalCarbonSaved: 0,
    LastActive: now,
    Email: userEmail,
    Password: password,
    StudentID: studentId,
    Phone: phone
  };
  return { success: true, userProfile: profile };
}

function loginUser(payload) {
  const userEmail = String(payload.email || payload.userEmail || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!userEmail || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const sheet = getUsersSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password'];
  const rows = values.slice(1);
  const match = rows.find((row) => {
    const storedEmail = String(getCellValue(row, headers, 'Email', '')).toLowerCase();
    const storedPassword = String(getCellValue(row, headers, 'Password', ''));
    return storedEmail === userEmail && storedPassword === password;
  });

  if (!match) {
    return { success: false, error: 'Invalid email or password' };
  }

  const profile = rowsToObjects([match], headers)[0];
  return { success: true, userProfile: profile };
}

function getCarbonLogsByUser(userId) {
  const sheet = getCarbonLogsSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return rowsToObjects(values.slice(1).filter((row) => String(row[1]) === String(userId)), headers).reverse();
}

function getDashboardData(payload) {
  const userEmail = payload.userEmail || payload.email || '';
  const user = getOrCreateUser(userEmail, payload.username || userEmail || 'Guest');
  const logs = getCarbonLogsByUser(user.UserID);
  const facultyRanking = getFacultyRanking(payload);
  const majorRanking = getMajorRanking(payload);
  const rankInfo = getUserRankInfo(user.UserID, user.Faculty, user.Major);
  return {
    success: true,
    userProfile: user,
    carbonLogs: logs,
    facultyRanking: facultyRanking.ranking || [],
    majorRanking: majorRanking.ranking || [],
    rankInfo: rankInfo
  };
}

// [NEW] คำนวณอันดับส่วนตัวของผู้ใช้ "ภายในคณะ" และ "ภายในสาขา" ของตัวเอง
// หมายเหตุ: คืนค่าเฉพาะตัวเลขอันดับ/จำนวนคนทั้งหมด ไม่เปิดเผยชื่อหรือคะแนนของผู้ใช้คนอื่น
function getUserRankInfo(userId, faculty, major) {
  const usersSheet = getUsersSheet();
  const values = usersSheet.getDataRange().getDisplayValues();
  if (values.length <= 1) {
    return { facultyRank: 0, facultyTotal: 0, majorRank: 0, majorTotal: 0 };
  }
  const headers = values[0];
  const rows = values.slice(1);

  const buildRanked = (groupField, groupValue) => rows
    .filter((row) => String(getCellValue(row, headers, groupField, '')) === String(groupValue))
    .map((row) => ({
      UserID: getCellValue(row, headers, 'UserID', ''),
      TotalGreenPoint: Number(getCellValue(row, headers, 'TotalGreenPoint', 0)) || 0
    }))
    .sort((a, b) => b.TotalGreenPoint - a.TotalGreenPoint);

  const facultyMembers = buildRanked('Faculty', faculty);
  const majorMembers = buildRanked('Major', major);

  const facultyRank = facultyMembers.findIndex((m) => String(m.UserID) === String(userId)) + 1;
  const majorRank = majorMembers.findIndex((m) => String(m.UserID) === String(userId)) + 1;

  return {
    facultyRank: facultyRank || 0,
    facultyTotal: facultyMembers.length,
    majorRank: majorRank || 0,
    majorTotal: majorMembers.length
  };
}

// Wrapper สำหรับเรียกผ่าน action: 'getUserRank' โดยตรง (ไม่ผ่าน getDashboardData)
function getUserRankForPayload(payload) {
  const userEmail = payload.userEmail || payload.email || '';
  const user = getOrCreateUser(userEmail, payload.username || userEmail || 'Guest');
  const rankInfo = getUserRankInfo(user.UserID, user.Faculty, user.Major);
  return { success: true, rankInfo: rankInfo };
}

function getUserProfile(payload) {
  const userEmail = payload.userEmail || payload.email || '';
  const user = getOrCreateUser(userEmail, payload.username || userEmail || 'Guest');
  return { success: true, userProfile: user };
}

function getCarbonHistory(payload) {
  const userEmail = payload.userEmail || payload.email || '';
  const user = getOrCreateUser(userEmail, payload.username || userEmail || 'Guest');
  return { success: true, carbonLogs: getCarbonLogsByUser(user.UserID) };
}

function calculateCarbonAndGreenPoint(quantity, wasteType) {
  const emissionFactor = {
    cap: 0.02,
    snack: 0.02,
    milk: 0.15,
    can: 0.20,
    pet: 0.02
  }[String(wasteType).toLowerCase()] || 0.02;

  const carbonSaved = Number((quantity * emissionFactor).toFixed(3));
  let greenPoint = Math.round(carbonSaved * 100);

  if (quantity >= 50) {
    greenPoint += 50;
  } else if (quantity >= 25) {
    greenPoint += 25;
  } else if (quantity >= 10) {
    greenPoint += 10;
  }

  return { carbonSaved, greenPoint };
}

function recalculateUserTotals(userId) {
  const sheet = getCarbonLogsSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return;

  const logs = values.slice(1).filter((row) => String(row[1]) === String(userId));
  let totalGreenPoint = 0;
  let totalCarbonSaved = 0;
  logs.forEach((row) => {
    totalGreenPoint += Number(row[6]) || 0;
    totalCarbonSaved += Number(row[5]) || 0;
  });

  const usersSheet = getUsersSheet();
  const userValues = usersSheet.getDataRange().getDisplayValues();
  const headers = userValues[0];
  const rows = userValues.slice(1);
  const index = rows.findIndex((row) => String(getCellValue(row, headers, 'UserID', '')) === String(userId));
  if (index >= 0) {
    const rowIndex = index + 2;
    const totalGreenIndex = getHeaderIndex(headers, 'TotalGreenPoint');
    const totalCarbonIndex = getHeaderIndex(headers, 'TotalCarbonSaved');
    const lastActiveIndex = getHeaderIndex(headers, 'LastActive');
    usersSheet.getRange(rowIndex, totalGreenIndex + 1).setValue(totalGreenPoint);
    usersSheet.getRange(rowIndex, totalCarbonIndex + 1).setValue(Number(totalCarbonSaved.toFixed(3)));
    usersSheet.getRange(rowIndex, lastActiveIndex + 1).setValue(new Date().toISOString());
    invalidatePublicStatsCache();
  }
}

function saveCarbonLog(payload) {
  const userEmail = payload.userEmail || payload.email || '';
  const user = getOrCreateUser(userEmail, payload.username || userEmail || 'Guest');
  const { carbonSaved, greenPoint } = calculateCarbonAndGreenPoint(Number(payload.quantity || 0), payload.wasteType);
  const sheet = getCarbonLogsSheet();
  const logId = `log-${Date.now()}`;
  const row = [
    logId,
    user.UserID,
    payload.dateTime || new Date().toISOString(),
    payload.wasteType || '',
    payload.quantity || 0,
    carbonSaved,
    greenPoint,
    payload.imageUrl || '',
    payload.status || 'Approved'
  ];
  sheet.appendRow(row);
  recalculateUserTotals(user.UserID);
  return { success: true, logId, userProfile: user, carbonSaved, greenPoint };
}

function updateCarbonLog(payload) {
  const sheet = getCarbonLogsSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0];
  const targetIndex = values.slice(1).findIndex((row) => String(row[0]) === String(payload.logId));
  if (targetIndex < 0) {
    return { success: false, error: 'Log not found' };
  }
  const rowIndex = targetIndex + 2;
  const userId = values[rowIndex - 1][1];
  const { carbonSaved, greenPoint } = calculateCarbonAndGreenPoint(Number(payload.quantity || 0), payload.wasteType);
  sheet.getRange(rowIndex, 3).setValue(payload.dateTime || new Date().toISOString());
  sheet.getRange(rowIndex, 4).setValue(payload.wasteType || '');
  sheet.getRange(rowIndex, 5).setValue(payload.quantity || 0);
  sheet.getRange(rowIndex, 6).setValue(carbonSaved);
  sheet.getRange(rowIndex, 7).setValue(greenPoint);
  sheet.getRange(rowIndex, 8).setValue(payload.imageUrl || '');
  sheet.getRange(rowIndex, 9).setValue(payload.status || 'Approved');
  recalculateUserTotals(userId);
  return { success: true, logId: payload.logId };
}

function deleteCarbonLog(payload) {
  const sheet = getCarbonLogsSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const targetIndex = values.slice(1).findIndex((row) => String(row[0]) === String(payload.logId));
  if (targetIndex < 0) {
    return { success: false, error: 'Log not found' };
  }
  const rowIndex = targetIndex + 2;
  const userId = values[rowIndex - 1][1];
  sheet.deleteRow(rowIndex);
  recalculateUserTotals(userId);
  return { success: true };
}

function getFacultyRanking() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('faculty_ranking');
  if (cached) return { success: true, ranking: JSON.parse(cached) };

  const usersSheet = getUsersSheet();
  const values = usersSheet.getDataRange().getDisplayValues();
  if (values.length <= 1) {
    cache.put('faculty_ranking', JSON.stringify([]), 300);
    return { success: true, ranking: [] };
  }
  const headers = values[0];
  const rows = values.slice(1);
  const map = {};
  rows.forEach((row) => {
    const faculty = getCellValue(row, headers, 'Faculty', 'Unknown');
    const point = Number(getCellValue(row, headers, 'TotalGreenPoint', 0)) || 0;
    if (!map[faculty]) {
      map[faculty] = { TotalGreenPoint: 0, MemberCount: 0 };
    }
    map[faculty].TotalGreenPoint += point;
    map[faculty].MemberCount += 1;
  });
  const ranking = Object.entries(map)
    .map(([Faculty, data]) => ({ Faculty, TotalGreenPoint: data.TotalGreenPoint, MemberCount: data.MemberCount }))
    .sort((a, b) => b.TotalGreenPoint - a.TotalGreenPoint)
    .slice(0, 10);
  cache.put('faculty_ranking', JSON.stringify(ranking), 300);
  return { success: true, ranking };
}

function getMajorRanking() {
  const usersSheet = getUsersSheet();
  const values = usersSheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return { success: true, ranking: [] };
  const headers = values[0];
  const rows = values.slice(1);
  const map = {};
  rows.forEach((row) => {
    const major = getCellValue(row, headers, 'Major', 'Unknown');
    const point = Number(getCellValue(row, headers, 'TotalGreenPoint', 0)) || 0;
    map[major] = (map[major] || 0) + point;
  });
  const ranking = Object.entries(map)
    .map(([Major, TotalGreenPoint]) => ({ Major, TotalGreenPoint }))
    .sort((a, b) => b.TotalGreenPoint - a.TotalGreenPoint)
    .slice(0, 10);
  return { success: true, ranking };
}

function getPublicDashboardData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('public_dashboard_data');
  if (cached) return { success: true, records: JSON.parse(cached) };

  const logsSheet = getCarbonLogsSheet();
  const usersSheet = getUsersSheet();
  const logsValues = logsSheet.getDataRange().getDisplayValues();
  const usersValues = usersSheet.getDataRange().getDisplayValues();

  if (logsValues.length <= 1) {
    cache.put('public_dashboard_data', JSON.stringify([]), 300);
    return { success: true, records: [] };
  }

  const logsHeaders = logsValues[0];
  const usersHeaders = usersValues[0] || [];
  const logs = logsValues.slice(1).filter((row) => String(getCellValue(row, logsHeaders, 'Status', '')).toLowerCase() === 'approved');
  const users = usersValues.length > 1 ? rowsToObjects(usersValues.slice(1), usersHeaders) : [];

  const typeNames = {
    cap: 'ฝาขวดน้ำ',
    snack: 'ซองขนม',
    milk: 'กล่องนม',
    can: 'กระป๋องอลูมิเนียม',
    pet: 'ขวด PET'
  };

  const avgWeightPerItem = {
    cap: 0.005,
    snack: 0.003,
    milk: 0.010,
    can: 0.015,
    pet: 0.015
  };

  function maskUsername(name) {
    if (!name || name === 'คุณ') return 'คุณ';
    const trimmed = name.trim();
    if (trimmed.length <= 2) return trimmed;
    return trimmed.substring(0, 2) + ' ***' + trimmed.substring(trimmed.length - 2);
  }

  const records = logs.map((row) => {
    const userId = String(getCellValue(row, logsHeaders, 'UserID', ''));
    const user = users.find((u) => String(u.UserID || u.Email || '') === userId) || {};
    const wasteType = String(getCellValue(row, logsHeaders, 'WasteType', '')).toLowerCase();
    const qty = Number(getCellValue(row, logsHeaders, 'Quantity', 0)) || 0;
    const weight = Number((qty * (avgWeightPerItem[wasteType] || 0)).toFixed(3));

    return {
      id: getCellValue(row, logsHeaders, 'LogID', ''),
      userMask: maskUsername(user.Username || user.Email || userId),
      type: typeNames[wasteType] || getCellValue(row, logsHeaders, 'WasteType', ''),
      typeId: wasteType,
      qty: qty,
      weight: weight,
      point: Number(getCellValue(row, logsHeaders, 'GreenPoint', 0)) || 0,
      carbon: Number(getCellValue(row, logsHeaders, 'CarbonSaved', 0)) || 0,
      dateTime: getCellValue(row, logsHeaders, 'DateTime', ''),
      date: getCellValue(row, logsHeaders, 'DateTime', ''),
      img: getCellValue(row, logsHeaders, 'ImageURL', ''),
      username: user.Username || user.Email || userId,
      status: getCellValue(row, logsHeaders, 'Status', 'Approved')
    };
  }).reverse();

  cache.put('public_dashboard_data', JSON.stringify(records), 300);
  return { success: true, records };
}

function getPublicStats() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('public_stats');
  if (cached) return { success: true, stats: JSON.parse(cached) };

  const usersSheet = getUsersSheet();
  const logsSheet = getCarbonLogsSheet();
  const usersValues = usersSheet.getDataRange().getDisplayValues();
  const logsValues = logsSheet.getDataRange().getDisplayValues();

  const participants = usersValues.length > 1 ? usersValues.length - 1 : 0;

  let totalItems = 0;
  let totalWeight = 0;
  let totalCarbon = 0;
  let totalPoints = 0;

  if (logsValues.length > 1) {
    const headers = logsValues[0];
    const statusIndex = getHeaderIndex(headers, 'Status');
    const qtyIndex = getHeaderIndex(headers, 'Quantity');
    const carbonIndex = getHeaderIndex(headers, 'CarbonSaved');
    const pointIndex = getHeaderIndex(headers, 'GreenPoint');
    const wasteTypeIndex = getHeaderIndex(headers, 'WasteType');

    const avgWeightPerItem = { cap: 0.005, snack: 0.003, milk: 0.010, can: 0.015, pet: 0.015 };

    logsValues.slice(1).forEach((row) => {
      const status = statusIndex >= 0 ? String(row[statusIndex] || '').toLowerCase() : '';
      if (status !== 'approved') return;

      const qty = qtyIndex >= 0 ? Number(row[qtyIndex] || 0) || 0 : 0;
      const wasteType = wasteTypeIndex >= 0 ? String(row[wasteTypeIndex] || '').toLowerCase() : '';
      const weight = qty * (avgWeightPerItem[wasteType] || 0);
      const carbon = carbonIndex >= 0 ? Number(row[carbonIndex] || 0) || 0 : 0;
      const point = pointIndex >= 0 ? Number(row[pointIndex] || 0) || 0 : 0;

      totalItems += qty;
      totalWeight += weight;
      totalCarbon += carbon;
      totalPoints += point;
    });
  }

  const stats = {
    participants,
    totalItems,
    totalWeight: Number(totalWeight.toFixed(2)),
    totalCarbon: Number(totalCarbon.toFixed(3)),
    totalPoints
  };

  cache.put('public_stats', JSON.stringify(stats), 300);
  return { success: true, stats };
}

// [Hero Level] แหล่งข้อมูลกลางของระดับ Badge ทั้งระบบ (ใช้ทั้ง getLevelStats และในอนาคตกับ
// Faculty Ranking / Major Ranking / Weekly Challenge / Team Challenge / Friend System ได้โดยไม่ต้อง
// ออกแบบโครงสร้างระดับใหม่ — แก้เกณฑ์คะแนนหรือชื่อ/ไอคอนที่จุดเดียวนี้พอ)
const HERO_LEVEL_DEFS = [
  { name: 'Green Seed', icon: '🌱', min: 0, max: 99 },
  { name: 'Green Tree', icon: '🌿', min: 100, max: 499 },
  { name: 'Forest Guardian', icon: '🌳', min: 500, max: 999 },
  { name: 'Carbon Hero', icon: '🏆', min: 1000, max: 1999 },
  { name: 'Earth Legend', icon: '👑', min: 2000, max: Infinity }
];

function getHeroLevelForPoints(points) {
  const p = Number(points) || 0;
  for (let i = 0; i < HERO_LEVEL_DEFS.length; i++) {
    const def = HERO_LEVEL_DEFS[i];
    if (p >= def.min && p <= def.max) return def;
  }
  return HERO_LEVEL_DEFS[0];
}

function getLevelStats() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('level_stats');
  if (cached) return JSON.parse(cached);

  const usersSheet = getUsersSheet();
  const values = usersSheet.getDataRange().getDisplayValues();
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password', 'StudentID', 'Phone'];
  const rows = values.length > 1 ? values.slice(1) : [];
  const participants = rows.length;

  // นับจำนวนผู้ใช้ในแต่ละระดับ โดยยึด TotalGreenPoint สะสมของ User แต่ละคนจากตาราง Users เท่านั้น
  const counts = HERO_LEVEL_DEFS.map(() => 0);
  rows.forEach((row) => {
    const points = Number(getCellValue(row, headers, 'TotalGreenPoint', 0)) || 0;
    const idx = HERO_LEVEL_DEFS.findIndex((def) => points >= def.min && points <= def.max);
    counts[idx >= 0 ? idx : 0]++;
  });

  const levels = HERO_LEVEL_DEFS.map((def, idx) => ({
    name: def.name,
    icon: def.icon,
    count: counts[idx],
    percent: participants > 0 ? Number(((counts[idx] / participants) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count);

  const result = { success: true, participants, levels };
  cache.put('level_stats', JSON.stringify(result), 300);
  return result;
}

// เคลียร์ Cache ที่เกี่ยวกับข้อมูลสาธารณะ (ผู้เข้าร่วม / Hero Levels) เพื่อให้อัปเดตแบบ Real-time
// ทุกครั้งที่มีผู้สมัครใหม่ หรือ Green Point ของผู้ใช้เปลี่ยนแปลง (ซึ่งอาจทำให้ระดับ Badge เปลี่ยนไปด้วย)
function invalidatePublicStatsCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('public_stats');
  cache.remove('level_stats');
}

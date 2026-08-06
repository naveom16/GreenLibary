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
      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

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
  ensureHeaders(sheet, ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password']);
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
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password'];
  const rows = values.slice(1);
  const userId = userEmail || `user-${Date.now()}`;

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
    Password: ''
  };
}

function registerUser(payload) {
  const userEmail = String(payload.email || payload.userEmail || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const username = String(payload.name || payload.username || userEmail.split('@')[0] || 'Guest');
  const faculty = String(payload.faculty || 'คณะวิทยาศาสตร์');
  const major = String(payload.major || 'CS');

  if (!userEmail || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const sheet = getUsersSheet();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0] || ['UserID', 'Username', 'Faculty', 'Major', 'JoinDate', 'TotalGreenPoint', 'TotalCarbonSaved', 'LastActive', 'Email', 'Password'];
  const rows = values.slice(1);
  const existing = rows.find((row) => String(getCellValue(row, headers, 'Email', '')).toLowerCase() === userEmail);
  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const now = new Date().toISOString();
  sheet.appendRow([userEmail, username, faculty, major, now, 0, 0, now, userEmail, password]);
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
    Password: password
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
  return {
    success: true,
    userProfile: user,
    carbonLogs: logs,
    facultyRanking: facultyRanking.ranking || [],
    majorRanking: majorRanking.ranking || []
  };
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
  const usersSheet = getUsersSheet();
  const values = usersSheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return { success: true, ranking: [] };
  const headers = values[0];
  const rows = values.slice(1);
  const map = {};
  rows.forEach((row) => {
    const faculty = getCellValue(row, headers, 'Faculty', 'Unknown');
    const point = Number(getCellValue(row, headers, 'TotalGreenPoint', 0)) || 0;
    map[faculty] = (map[faculty] || 0) + point;
  });
  const ranking = Object.entries(map)
    .map(([Faculty, TotalGreenPoint]) => ({ Faculty, TotalGreenPoint }))
    .sort((a, b) => b.TotalGreenPoint - a.TotalGreenPoint)
    .slice(0, 10);
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

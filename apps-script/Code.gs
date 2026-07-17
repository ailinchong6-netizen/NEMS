const CONFIG = {
  SPREADSHEET_NAME: "NAGA Equipment Database",
  EQUIPMENT_SHEET: "Equipment",
  MAINTENANCE_SHEET: "Maintenance",
  SITES_SHEET: "Sites",
  USERS_SHEET: "Users",
  DRIVE_FOLDER_NAME: "NAGA Equipment Photos",
  ADMIN_EMAILS: ["admin@naga.local"]
};

const EQUIPMENT_HEADERS = [
  "equipmentId",
  "equipmentName",
  "category",
  "brand",
  "model",
  "serialNumber",
  "purchaseDate",
  "siteLocation",
  "status",
  "condition",
  "remarks",
  "photoUrls",
  "createdAt",
  "updatedAt",
  "createdBy"
];

const MAINTENANCE_HEADERS = [
  "maintenanceId",
  "equipmentId",
  "date",
  "description",
  "cost",
  "performedBy",
  "remarks",
  "createdAt",
  "updatedAt"
];

const SITE_HEADERS = [
  "siteId",
  "siteName",
  "location",
  "pic",
  "contact",
  "status",
  "remarks",
  "createdAt",
  "updatedAt"
];

const USERS_HEADERS = [
  "userId",
  "name",
  "email",
  "password",
  "role",
  "status"
];

function doGet(event) {
  const action = event.parameter.action;
  Logger.log("GET ACTION:");
  Logger.log(action);
  Logger.log("equipmentId:");
  Logger.log(event.parameter.equipmentId);
  try {
    if (action === "getAllEquipment") return jsonResponse(true, getAllEquipment());
    if (action === "getEquipmentById") return jsonResponse(true, getEquipmentById(event.parameter.equipmentId));
    if (action === "getMaintenance") return jsonResponse(true, getMaintenance(event.parameter.equipmentId));
    if (action === "getSites") return jsonResponse(true, getSites());
    return jsonResponse(false, null, "Unknown GET action.");
  } catch (error) {
    return jsonResponse(false, null, error.message);
  }
}

function doPost(event) {
  try {
    Logger.log(event.postData.contents);
    const request = JSON.parse(event.postData.contents || "{}");
    const action = request.action;
    const user = request.user;
    Logger.log("REQUEST RECEIVED:");
    Logger.log(JSON.stringify(request));
    Logger.log("User received:");
    Logger.log(JSON.stringify(user));
    Logger.log("USER RECEIVED:");
    Logger.log(JSON.stringify(user));
    Logger.log("ADMIN RESULT:");
    Logger.log(String(isAdmin(user)));
    if (["addEquipment", "updateEquipment", "deleteEquipment", "uploadPhoto", "addMaintenance", "updateMaintenance", "deleteMaintenance", "addSite", "updateSite", "deleteSite"].includes(action)) {
      if (!isAdmin(user)) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: "Admin permission required"
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (action === "addEquipment") return jsonResponse(true, addEquipment(request.equipment || request.data, user));
    if (action === "updateEquipment") return jsonResponse(true, updateEquipment(request.equipment || request.data, user));
    if (action === "deleteEquipment") return jsonResponse(true, deleteEquipment(request.equipmentId));
    if (action === "uploadPhoto") return jsonResponse(true, uploadPhoto(request.equipmentId, request.fileName, request.mimeType, request.photoData));
    if (action === "addMaintenance") return jsonResponse(true, addMaintenance(request.record || request.data));
    if (action === "updateMaintenance") return jsonResponse(true, updateMaintenance(request.record || request.data));
    if (action === "deleteMaintenance") return jsonResponse(true, deleteMaintenance(request.maintenanceId));
    if (action === "addSite") return jsonResponse(true, addSite(request.site || request.data));
    if (action === "updateSite") return jsonResponse(true, updateSite(request.site || request.data));
    if (action === "deleteSite") return jsonResponse(true, deleteSite(request.siteId || (request.data && request.data.siteId)));
    if (action === "login") return jsonResponse(true, loginUser(request));
    return jsonResponse(false, null, "Unknown POST action.");
  } catch (error) {
    return jsonResponse(false, null, error.message);
  }
}

function setupNemsDatabase() {
  const spreadsheet = getSpreadsheet();
  ensureSheet(spreadsheet, CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS);
  ensureSheet(spreadsheet, CONFIG.MAINTENANCE_SHEET, MAINTENANCE_HEADERS);
  ensureSheet(spreadsheet, CONFIG.SITES_SHEET, SITE_HEADERS);
  ensureSheet(spreadsheet, CONFIG.USERS_SHEET, USERS_HEADERS);
  getRootPhotoFolder();
}

function getAllEquipment() {
  return readRows(CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS).map(parseEquipment);
}

function getEquipmentById(equipmentId) {
  const targetId = String(equipmentId || "").trim();
  return getAllEquipment().find(function(item) {
    return String(item.equipmentId || "").trim() === targetId;
  }) || null;
}

function addEquipment(equipment, user) {
  const sheet = getSheet(CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS);
  const rows = readRows(CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS);
  const now = new Date().toISOString();
  const normalized = normalizeEquipment(equipment || {});
  const item = Object.assign({}, normalized, {
    equipmentId: normalized.equipmentId || nextEquipmentId(rows),
    photoUrls: JSON.stringify(normalized.photoUrls || []),
    createdAt: now,
    updatedAt: now,
    createdBy: normalized.createdBy || (user && user.email) || ""
  });
  sheet.appendRow(EQUIPMENT_HEADERS.map((header) => item[header] || ""));
  ensureEquipmentFolder(item.equipmentId);
  return parseEquipment(item);
}

function updateEquipment(equipment, user) {
  equipment = normalizeEquipment(equipment || {});
  const sheet = getSheet(CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = EQUIPMENT_HEADERS.indexOf("equipmentId");
  Logger.log("UPDATE EQUIPMENT SEARCH ID:");
  Logger.log(String(equipment.equipmentId));
  Logger.log("SHEET EQUIPMENT IDS:");
  for (let i = 1; i < values.length; i++) {
    Logger.log(String(values[i][idColumn]));
    if (
      String(values[i][idColumn] || "").trim() ===
      String(equipment.equipmentId || "").trim()
    ) {
      const existing = rowToObject(values[i], EQUIPMENT_HEADERS);
      const next = Object.assign({}, existing, equipment, {
        photoUrls: JSON.stringify(equipment.photoUrls || []),
        updatedAt: new Date().toISOString(),
        createdBy: existing.createdBy || equipment.createdBy || (user && user.email) || ""
      });
      sheet.getRange(i + 1, 1, 1, EQUIPMENT_HEADERS.length).setValues([EQUIPMENT_HEADERS.map((header) => next[header] || "")]);
      return parseEquipment(next);
    }
  }
  throw new Error("Equipment not found.");
}

function deleteEquipment(equipmentId) {
  const sheet = getSheet(CONFIG.EQUIPMENT_SHEET, EQUIPMENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = EQUIPMENT_HEADERS.indexOf("equipmentId");
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][idColumn] === equipmentId) sheet.deleteRow(i + 1);
  }
  return { equipmentId };
}

function uploadPhoto(equipmentId, fileName, mimeType, photoData) {
  const folder = ensureEquipmentFolder(equipmentId);
  const base64 = String(photoData).split(",").pop();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: "https://drive.google.com/uc?export=view&id=" + file.getId(), fileId: file.getId() };
}

function getMaintenance(equipmentId) {
  return readRows(CONFIG.MAINTENANCE_SHEET, MAINTENANCE_HEADERS).filter((record) => !equipmentId || record.equipmentId === equipmentId);
}

function addMaintenance(record) {
  const sheet = getSheet(CONFIG.MAINTENANCE_SHEET, MAINTENANCE_HEADERS);
  const now = new Date().toISOString();
  const item = Object.assign({}, record, {
    maintenanceId: "MNT-" + Date.now(),
    createdAt: now,
    updatedAt: now
  });
  sheet.appendRow(MAINTENANCE_HEADERS.map((header) => item[header] || ""));
  return item;
}

function updateMaintenance(record) {
  const sheet = getSheet(CONFIG.MAINTENANCE_SHEET, MAINTENANCE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = MAINTENANCE_HEADERS.indexOf("maintenanceId");
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColumn] === record.maintenanceId) {
      const next = Object.assign({}, rowToObject(values[i], MAINTENANCE_HEADERS), record, { updatedAt: new Date().toISOString() });
      sheet.getRange(i + 1, 1, 1, MAINTENANCE_HEADERS.length).setValues([MAINTENANCE_HEADERS.map((header) => next[header] || "")]);
      return next;
    }
  }
  throw new Error("Maintenance record not found.");
}

function deleteMaintenance(maintenanceId) {
  const sheet = getSheet(CONFIG.MAINTENANCE_SHEET, MAINTENANCE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = MAINTENANCE_HEADERS.indexOf("maintenanceId");
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][idColumn] === maintenanceId) sheet.deleteRow(i + 1);
  }
  return { maintenanceId };
}

function getSites() {
  return readRows(CONFIG.SITES_SHEET, SITE_HEADERS);
}

function addSite(site) {
  const sheet = getSheet(CONFIG.SITES_SHEET, SITE_HEADERS);
  const rows = readRows(CONFIG.SITES_SHEET, SITE_HEADERS);
  const now = new Date().toISOString();
  const item = Object.assign({}, normalizeSite(site || {}), {
    siteId: nextSiteId(rows),
    createdAt: now,
    updatedAt: now
  });
  sheet.appendRow(SITE_HEADERS.map(function(header) {
    return item[header] || "";
  }));
  return item;
}

function updateSite(site) {
  const normalized = normalizeSite(site || {});
  const sheet = getSheet(CONFIG.SITES_SHEET, SITE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = SITE_HEADERS.indexOf("siteId");
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][idColumn] || "").trim() ===
      String(normalized.siteId || "").trim()
    ) {
      const existing = rowToObject(values[i], SITE_HEADERS);
      const next = Object.assign({}, existing, normalized, {
        updatedAt: new Date().toISOString()
      });
      sheet.getRange(i + 1, 1, 1, SITE_HEADERS.length).setValues([SITE_HEADERS.map(function(header) {
        return next[header] || "";
      })]);
      return next;
    }
  }
  throw new Error("Site not found.");
}

function deleteSite(siteId) {
  const sheet = getSheet(CONFIG.SITES_SHEET, SITE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const idColumn = SITE_HEADERS.indexOf("siteId");
  for (let i = values.length - 1; i >= 1; i--) {
    if (
      String(values[i][idColumn] || "").trim() ===
      String(siteId || "").trim()
    ) {
      sheet.deleteRow(i + 1);
    }
  }
  return { siteId: siteId };
}

function normalizeSite(site) {
  return Object.assign({}, site, {
    siteId: site.siteId || site["Site ID"] || "",
    siteName: site.siteName || site.name || site.Name || site["Site Name"] || "",
    location: site.location || site.Location || "",
    pic: site.pic || site.PIC || "",
    contact: site.contact || site.Contact || "",
    status: site.status || site.Status || "Active",
    remarks: site.remarks || site.Remarks || ""
  });
}

function nextSiteId(rows) {
  const max = rows.reduce((highest, item) => {
    const value = Number(String(item.siteId || "").split("-").pop());
    return isNaN(value) ? highest : Math.max(highest, value);
  }, 0);
  return "SITE-" + String(max + 1).padStart(4, "0");
}

function loginUser(request) {
  const email = String((request && request.email) || "").trim().toLowerCase();
  const password = String((request && request.password) || "");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const users = readRows(CONFIG.USERS_SHEET, USERS_HEADERS);
  const match = users.find(function(user) {
    return String(user.email || "").trim().toLowerCase() === email && String(user.password || "") === password;
  });

  if (!match) {
    throw new Error("Invalid email or password.");
  }

  if (String(match.status || "Active").trim().toLowerCase() !== "active") {
    throw new Error("This account is disabled. Contact an administrator.");
  }

  return {
    userId: match.userId,
    name: match.name,
    email: match.email,
    role: match.role
  };
}

function isAdmin(user) {
  if (!user) {
    return false;
  }

  const role = String(user.role || "").trim().toUpperCase();
  const email = String(user.email || "").trim().toLowerCase();
  const admins = CONFIG.ADMIN_EMAILS.map(function(adminEmail) {
    return String(adminEmail).trim().toLowerCase();
  });

  return role === "ADMIN" || admins.includes(email);
}

let _spreadsheetCache = null;

function getSpreadsheet() {
  if (_spreadsheetCache) return _spreadsheetCache;

  const properties = PropertiesService.getScriptProperties();
  const cachedId = properties.getProperty("SPREADSHEET_ID");
  if (cachedId) {
    try {
      _spreadsheetCache = SpreadsheetApp.openById(cachedId);
      return _spreadsheetCache;
    } catch (error) {
      // Cached ID is stale (file moved/deleted) — fall through and re-resolve by name.
    }
  }

  const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  const spreadsheet = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  _spreadsheetCache = spreadsheet;
  return spreadsheet;
}

function getSheet(name, headers) {
  return ensureSheet(getSpreadsheet(), name, headers);
}

function ensureSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const firstRow = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || headers.length)).getValues()[0];
  if (firstRow.join("") === "") {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach(function(header) {
      if (!firstRow.includes(header)) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
  }
  return sheet;
}

function readRows(sheetName, headers) {
  const sheet = getSheet(sheetName, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.filter((row) => row.join("") !== "").map((row) => rowToObject(row, headers));
}

function rowToObject(row, headers) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function parseEquipment(item) {
  const next = Object.assign({}, item);
  try {
    next.photoUrls = Array.isArray(next.photoUrls) ? next.photoUrls : JSON.parse(next.photoUrls || "[]");
  } catch (error) {
    next.photoUrls = String(next.photoUrls || "").split(",").map((url) => url.trim()).filter(Boolean);
  }
  return next;
}

function normalizeEquipment(equipment) {
  const photoUrls = equipment.photoUrls || equipment.photoUrl || [];
  return Object.assign({}, equipment, {
    equipmentId: equipment.equipmentId || equipment["Equipment ID"] || "",
    equipmentName: equipment.equipmentName || equipment.name || equipment.Name || equipment["Equipment Name"] || "",
    category: equipment.category || equipment.Category || "",
    brand: equipment.brand || equipment.Brand || "",
    model: equipment.model || equipment.Model || "",
    serialNumber: equipment.serialNumber || equipment["Serial Number"] || "",
    purchaseDate: equipment.purchaseDate || equipment["Purchase Date"] || "",
    siteLocation: equipment.siteLocation || equipment.location || equipment.Location || "",
    status: equipment.status || equipment.Status || "",
    condition: equipment.condition || equipment.Condition || "",
    remarks: equipment.remarks || equipment.Remarks || "",
    photoUrls: Array.isArray(photoUrls) ? photoUrls : String(photoUrls || "").split(",").map(function(url) {
      return url.trim();
    }).filter(Boolean),
    createdBy: equipment.createdBy || equipment["Created By"] || ""
  });
}

function nextEquipmentId(rows) {
  const max = rows.reduce((highest, item) => {
    const value = Number(String(item.equipmentId || "").split("-").pop());
    return isNaN(value) ? highest : Math.max(highest, value);
  }, 0);
  return "NAGA-EQ-" + String(max + 1).padStart(4, "0");
}

function getRootPhotoFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
}

function ensureEquipmentFolder(equipmentId) {
  const root = getRootPhotoFolder();
  const folders = root.getFoldersByName(equipmentId);
  return folders.hasNext() ? folders.next() : root.createFolder(equipmentId);
}

function jsonResponse(success, data, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, data, message: message || "", error: success ? "" : (message || "") }))
    .setMimeType(ContentService.MimeType.JSON);
}

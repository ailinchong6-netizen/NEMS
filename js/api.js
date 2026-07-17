(function () {
  const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbyTjXUMd1tcMR3mLTlGLW5zDek7shoF8nh4S7ro8CCF43_08CNn4PQw0GDqVDrEjcHR/exec",
    DEMO_MODE: false,
    DEBUG: true
  };

  const DEMO_MODE =
    typeof CONFIG !== "undefined"
      ? Boolean(CONFIG?.DEMO_MODE ?? false)
      : false;

  const STORE_KEY = "nems_demo_equipment";
  const MAINT_KEY = "nems_demo_maintenance";
  const SITE_KEY = "nems_demo_sites";

  const seedEquipment = [
    {
      equipmentId: "NAGA-EQ-0001",
      equipmentName: "Generator",
      category: "Generator",
      brand: "Honda",
      model: "EG6500",
      serialNumber: "HN-EG6500-1102",
      purchaseDate: "2025-03-12",
      siteLocation: "SCC Bertam",
      status: "Available",
      condition: "Good",
      remarks: "Ready for site deployment.",
      photoUrls: ["https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80"],
      createdAt: "2026-01-08T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z"
    },
    {
      equipmentId: "NAGA-EQ-0002",
      equipmentName: "Excavator ZX200",
      category: "Excavator",
      brand: "Hitachi",
      model: "ZX200",
      serialNumber: "ZX200-8942",
      purchaseDate: "2024-09-20",
      siteLocation: "Kuantan",
      status: "In Use",
      condition: "Good",
      remarks: "Assigned to earthwork team.",
      photoUrls: ["https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80"],
      createdAt: "2026-02-02T08:00:00.000Z",
      updatedAt: "2026-07-12T08:00:00.000Z"
    },
    {
      equipmentId: "NAGA-EQ-0003",
      equipmentName: "Welding Set",
      category: "Welding Machine",
      brand: "Miller",
      model: "Bobcat 250",
      serialNumber: "MLR-250-7721",
      purchaseDate: "2023-11-05",
      siteLocation: "Tanah Merah",
      status: "Under Maintenance",
      condition: "Fair",
      remarks: "Cable replacement pending.",
      photoUrls: ["https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=80"],
      createdAt: "2026-03-16T08:00:00.000Z",
      updatedAt: "2026-07-14T08:00:00.000Z"
    }
  ];

  const CACHE_TTL_MS = 60 * 1000;

  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(`nems_cache_${key}`);
      if (!raw) return null;
      const { value, expiresAt } = JSON.parse(raw);
      if (Date.now() > expiresAt) return null;
      return value;
    } catch (error) {
      return null;
    }
  }

  function cacheSet(key, value) {
    try {
      sessionStorage.setItem(`nems_cache_${key}`, JSON.stringify({ value, expiresAt: Date.now() + CACHE_TTL_MS }));
    } catch (error) {
      // sessionStorage unavailable or full — silently skip caching.
    }
  }

  function cacheClear(key) {
    try {
      sessionStorage.removeItem(`nems_cache_${key}`);
    } catch (error) {}
  }

  async function cachedRequest(key, action, payload) {
    const cached = cacheGet(key);
    if (cached) return cached;
    const result = await request(action, payload);
    cacheSet(key, result);
    return result;
  }

  function isDemo() {
    return DEMO_MODE || String(CONFIG?.API_URL || "").includes("PASTE_");
  }

  function currentUser() {
    return window.NEMS_AUTH?.getUser?.() || null;
  }

  function isAdminAction(action) {
    return [
      "addEquipment",
      "updateEquipment",
      "deleteEquipment",
      "uploadPhoto",
      "addMaintenance",
      "updateMaintenance",
      "deleteMaintenance",
      "addSite",
      "updateSite",
      "deleteSite"
    ].includes(action);
  }

  function assertCanPerform(action) {
    if (!isAdminAction(action)) return;
    const user = currentUser();
    if (!window.NEMS_AUTH?.isAdmin?.(user)) {
      console.log("Current user:", user);
      throw new Error(`Admin permission required. Current role: ${user?.role}, email: ${user?.email}`);
    }
  }

  function requestUser() {
    const user = currentUser();
    if (!user) return null;
    return {
      name: user.name || "",
      email: user.email || "",
      role: user.role || ""
    };
  }

  function postBodyFor(action, payload) {
    const user = requestUser();
    const token = currentUser()?.token || "";

    if (action === "login") {
      return { action, email: payload.email, password: payload.password };
    }

    let body;
    if (action === "addEquipment" || action === "updateEquipment") {
      body = { action, user, equipment: payload.equipment };
    } else if (action === "deleteEquipment") {
      body = { action, user, equipmentId: payload.equipmentId };
    } else if (action === "uploadPhoto") {
      body = {
        action,
        user,
        equipmentId: payload.equipmentId,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        photoData: payload.photoData
      };
    } else if (action === "addMaintenance" || action === "updateMaintenance") {
      body = { action, user, record: payload.record };
    } else if (action === "deleteMaintenance") {
      body = { action, user, maintenanceId: payload.maintenanceId };
    } else if (action === "addSite" || action === "updateSite") {
      body = { action, user, site: payload.site };
    } else if (action === "deleteSite") {
      body = { action, user, siteId: payload.siteId };
    } else if (action === "logout") {
      body = { action };
    } else {
      body = { action, user, data: payload };
    }

    return { ...body, token };
  }

  function readStore(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function nextEquipmentId(items) {
    const max = items.reduce((highest, item) => {
      const num = Number(String(item.equipmentId || "").split("-").pop());
      return Number.isFinite(num) ? Math.max(highest, num) : highest;
    }, 0);
    return `NAGA-EQ-${String(max + 1).padStart(4, "0")}`;
  }

  function nextSiteId(items) {
    const max = items.reduce((highest, item) => {
      const num = Number(String(item.siteId || "").split("-").pop());
      return Number.isFinite(num) ? Math.max(highest, num) : highest;
    }, 0);
    return `SITE-${String(max + 1).padStart(4, "0")}`;
  }

  async function request(action, payload = {}) {
    assertCanPerform(action);

    if (isDemo()) {
      return demoRequest(action, payload);
    }

    const user = requestUser();
    const token = currentUser()?.token || "";
    const method = action.startsWith("get") ? "GET" : "POST";
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set("action", action);
    if (method === "GET") {
      Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("token", token);
    }
    if (action === "getEquipmentById") {
      console.log("GET EQUIPMENT URL:", url.toString());
    }

    console.log("API URL:", CONFIG.API_URL);
    console.log("Action:", action);
    console.log("Payload:", payload);
    const requestBody = method === "POST" ? postBodyFor(action, payload) : undefined;
    console.log("===== NEMS REQUEST DEBUG =====");
    console.log("URL:", CONFIG.API_URL);
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(url.toString(), {
      method,
      headers: method === "POST" ? { "Content-Type": "text/plain;charset=utf-8" } : undefined,
      body: method === "POST" ? JSON.stringify(requestBody) : undefined
    });
    console.log("Backend response:", response);
    const responseText = await response.text();
    console.log("===== NEMS RESPONSE DEBUG =====");
    console.log(responseText);
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Invalid backend response: ${responseText || response.statusText}`);
    }
    console.log("Backend response data:", data);
    if (!data.success) {
      if (isAdminAction(action)) console.log("Current user:", user);
      const message = data.error || data.message || "NEMS API request failed.";
      throw new Error(action === "login" ? message : `${message} Current role: ${user?.role}, email: ${user?.email}`);
    }
    return data;
  }

  async function demoRequest(action, payload) {
    const equipment = readStore(STORE_KEY, seedEquipment);
    const maintenance = readStore(MAINT_KEY, []);
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (action === "getAllEquipment") return { success: true, data: equipment };
    if (action === "getEquipmentById") return { success: true, data: equipment.find((item) => item.equipmentId === payload.equipmentId) || null };
    if (action === "addEquipment") {
      const now = new Date().toISOString();
      const item = { ...payload.equipment, equipmentId: nextEquipmentId(equipment), createdAt: now, updatedAt: now };
      const next = [item, ...equipment];
      writeStore(STORE_KEY, next);
      return { success: true, data: item };
    }
    if (action === "updateEquipment") {
      const next = equipment.map((item) => item.equipmentId === payload.equipment.equipmentId ? { ...item, ...payload.equipment, updatedAt: new Date().toISOString() } : item);
      writeStore(STORE_KEY, next);
      return { success: true, data: next.find((item) => item.equipmentId === payload.equipment.equipmentId) };
    }
    if (action === "deleteEquipment") {
      writeStore(STORE_KEY, equipment.filter((item) => item.equipmentId !== payload.equipmentId));
      return { success: true };
    }
    if (action === "getMaintenance") return { success: true, data: maintenance.filter((item) => !payload.equipmentId || item.equipmentId === payload.equipmentId) };
    if (action === "addMaintenance") {
      const record = { ...payload.record, maintenanceId: `MNT-${Date.now()}` };
      writeStore(MAINT_KEY, [record, ...maintenance]);
      return { success: true, data: record };
    }
    if (action === "updateMaintenance") {
      const next = maintenance.map((item) => item.maintenanceId === payload.record.maintenanceId ? { ...item, ...payload.record } : item);
      writeStore(MAINT_KEY, next);
      return { success: true, data: next.find((item) => item.maintenanceId === payload.record.maintenanceId) };
    }
    if (action === "deleteMaintenance") {
      writeStore(MAINT_KEY, maintenance.filter((item) => item.maintenanceId !== payload.maintenanceId));
      return { success: true };
    }
    if (action === "uploadPhoto") return { success: true, data: { url: payload.photoData } };

    const sites = readStore(SITE_KEY, []);
    if (action === "getSites") return { success: true, data: sites };
    if (action === "addSite") {
      const now = new Date().toISOString();
      const item = { ...payload.site, siteId: nextSiteId(sites), status: payload.site?.status || "Active", createdAt: now, updatedAt: now };
      writeStore(SITE_KEY, [item, ...sites]);
      return { success: true, data: item };
    }
    if (action === "updateSite") {
      const next = sites.map((item) => item.siteId === payload.site.siteId ? { ...item, ...payload.site, updatedAt: new Date().toISOString() } : item);
      writeStore(SITE_KEY, next);
      return { success: true, data: next.find((item) => item.siteId === payload.site.siteId) };
    }
    if (action === "deleteSite") {
      writeStore(SITE_KEY, sites.filter((item) => item.siteId !== payload.siteId));
      return { success: true };
    }
    if (action === "login") {
      const demoUsers = [
        { userId: "001", name: "NAGA Administrator", email: "admin@naga.local", password: "123456", role: "ADMIN" },
        { userId: "002", name: "NAGA Viewer", email: "viewer@naga.local", password: "123456", role: "VIEWER" }
      ];
      const match = demoUsers.find((user) => user.email === String(payload.email || "").trim().toLowerCase() && user.password === payload.password);
      if (!match) return { success: false, error: "Invalid email or password." };
      const { password, ...user } = match;
      return { success: true, data: user };
    }

    throw new Error(`Unsupported action: ${action}`);
  }

  window.NEMS_CONFIG = CONFIG;
  console.log("DEMO_MODE:", DEMO_MODE);
  window.NEMS_API = {
    getAllEquipment: () => cachedRequest("equipment", "getAllEquipment"),
    getEquipmentList: () => cachedRequest("equipment", "getAllEquipment"),
    getEquipmentById: (equipmentId) => request("getEquipmentById", { equipmentId }),
    addEquipment: (equipment) => request("addEquipment", { equipment }).then((result) => { cacheClear("equipment"); return result; }),
    updateEquipment: (equipment) => request("updateEquipment", { equipment }).then((result) => { cacheClear("equipment"); return result; }),
    deleteEquipment: (equipmentId) => request("deleteEquipment", { equipmentId }).then((result) => { cacheClear("equipment"); return result; }),
    getMaintenance: (equipmentId) => request("getMaintenance", { equipmentId }),
    addMaintenance: (record) => request("addMaintenance", { record }),
    updateMaintenance: (record) => request("updateMaintenance", { record }),
    deleteMaintenance: (maintenanceId) => request("deleteMaintenance", { maintenanceId }),
    uploadPhoto: (equipmentId, fileName, mimeType, photoData) => request("uploadPhoto", { equipmentId, fileName, mimeType, photoData }),
    getSites: () => cachedRequest("sites", "getSites"),
    getAllSites: () => cachedRequest("sites", "getSites"),
    addSite: (site) => request("addSite", { site }).then((result) => { cacheClear("sites"); return result; }),
    updateSite: (site) => request("updateSite", { site }).then((result) => { cacheClear("sites"); return result; }),
    deleteSite: (siteId) => request("deleteSite", { siteId }).then((result) => { cacheClear("sites"); return result; }),
    login: (email, password) => request("login", { email, password }),
    logout: () => request("logout")
  };
})();

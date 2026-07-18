(function () {
  const STATUS = ["Available", "In Use", "Under Maintenance", "Broken", "Disposed"];
  const CONDITION = ["Excellent", "Good", "Fair", "Poor"];
  const SITE_STATUS = ["Active", "Inactive", "Completed"];
  const USER_ROLES = ["ADMIN", "VIEWER"];
  const USER_STATUS = ["Active", "Inactive"];
  let SITES = ["SCC Bertam", "Tanah Merah", "Kuantan", "Batu 3 MHC", "Others"];
  let SITE_RECORDS = [];
  const CATEGORIES = ["Generator", "Excavator", "Heavy Equipment", "Compressor", "Welding Machine", "Air Compressor", "Vehicle", "Power Tools", "Scaffolding", "Safety Equipment", "Others"];
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23dce4ec'/%3E%3Cpath d='M128 322h384v44H128zM178 177h284v120H178z' fill='%231E3A5F' opacity='.22'/%3E%3Ccircle cx='238' cy='237' r='34' fill='%23F5A623' opacity='.75'/%3E%3C/svg%3E";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    registerServiceWorker();
    setupInstallPrompt();
    wireLogin();
    const user = window.NEMS_AUTH.requireAuth();
    applyRole(user);

    const page = document.body.dataset.page;
    if (page === "dashboard") renderDashboard();
    if (page === "equipment") renderEquipmentList();
    if (page === "detail") renderDetail();
    if (page === "add") renderEquipmentForm();
    if (page === "edit") renderEquipmentForm(true);
    if (page === "maintenance") renderMaintenance();
    if (page === "profile") renderProfile();
    if (page === "sites") renderSitesList();
    if (page === "site-detail") renderSiteDetail();
    if (page === "site-add") renderSiteForm();
    if (page === "site-edit") renderSiteForm(true);
    if (page === "users") renderUsersList();
    if (page === "user-add") renderUserForm();
    if (page === "user-edit") renderUserForm(true);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("assets/service-worker.js", { scope: "./" }).catch(() => {});
    }
  }

  function setupInstallPrompt() {
    let deferredPrompt;
    const installBtn = document.getElementById("installBtn");
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      if (installBtn) installBtn.hidden = false;
    });
    installBtn?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      installBtn.hidden = true;
      deferredPrompt = null;
    });
  }

  function wireLogin() {
    document.getElementById("googleSignInBtn")?.addEventListener("click", window.NEMS_AUTH.loginGooglePlaceholder);
    document.querySelectorAll("[data-demo-login]").forEach((button) => {
      button.addEventListener("click", () => window.NEMS_AUTH.loginDemo(button.dataset.demoLogin));
    });
    document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorBox = document.getElementById("loginError");
      const submitBtn = document.getElementById("loginBtn");
      if (errorBox) errorBox.hidden = true;
      if (submitBtn) submitBtn.disabled = true;
      try {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const { data } = await window.NEMS_API.login(email, password);
        window.NEMS_AUTH.setUser(data);
        window.location.href = "dashboard.html";
      } catch (error) {
        if (errorBox) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
        } else {
          alert(error.message);
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function applyRole(user) {
    const admin = window.NEMS_AUTH.isAdmin(user);
    document.querySelectorAll(".admin-only").forEach((element) => element.classList.toggle("hidden", !admin));
    if (!admin && ["add", "edit", "site-add", "site-edit", "users", "user-add", "user-edit"].includes(document.body.dataset.page)) {
      window.location.href = "equipment.html";
    }
  }

  async function loadSites() {
    try {
      const { data } = await window.NEMS_API.getSites();
      if (Array.isArray(data) && data.length) {
        SITE_RECORDS = data;
        SITES = [...data.map((site) => site.siteName).filter(Boolean), "Others"];
      }
    } catch (error) {
      console.error("Failed to load sites, using fallback list.", error);
    }
    return SITES;
  }

  function refreshSiteLocationOptions(form, originalValue) {
    const select = form.querySelector('select[name="siteLocation"]');
    if (!select) return;
    const currentValue = select.value || originalValue;
    const missing = Boolean(currentValue) && !SITES.includes(currentValue);
    const options = missing ? [currentValue, ...SITES] : SITES;
    select.innerHTML = options.map((option) => `<option ${option === currentValue ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
  }

  async function renderDashboard() {
    const [{ data }] = await Promise.all([window.NEMS_API.getAllEquipment(), loadSites()]);
    const counts = {
      "Total Equipment": data.length,
      Available: data.filter((item) => item.status === "Available").length,
      "In Use": data.filter((item) => item.status === "In Use").length,
      Maintenance: data.filter((item) => item.status === "Under Maintenance").length,
      Broken: data.filter((item) => item.status === "Broken").length,
      Sites: SITE_RECORDS.length
    };
    document.getElementById("dashboardStats").innerHTML = Object.entries(counts).map(([label, value]) => `
      <article class="stat-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>
    `).join("");
    document.getElementById("recentEquipment").innerHTML = data.slice(0, 6).map(cardTemplate).join("") || emptyState("No equipment found.");
    const recentSites = document.getElementById("recentSites");
    if (recentSites) {
      recentSites.innerHTML = SITE_RECORDS.slice(0, 4).map(siteCardTemplate).join("") || emptyState("No sites found.");
    }
  }

  async function renderEquipmentList() {
    const [{ data }] = await Promise.all([window.NEMS_API.getAllEquipment(), loadSites()]);
    fillSelect("statusFilter", ["All Status", ...STATUS]);
    fillSelect("siteFilter", ["All Sites", ...SITES]);
    fillSelect("categoryFilter", ["All Categories", ...CATEGORIES]);
    const search = document.getElementById("searchInput");
    const params = new URLSearchParams(location.search);
    if (params.get("focus") === "search") setTimeout(() => search.focus(), 200);

    const update = () => {
      const term = search.value.trim().toLowerCase();
      const status = valueOrBlank("statusFilter", "All Status");
      const site = valueOrBlank("siteFilter", "All Sites");
      const category = valueOrBlank("categoryFilter", "All Categories");
      const filtered = data.filter((item) => {
        const text = [item.equipmentId, item.equipmentName, item.brand, item.model, item.serialNumber, item.siteLocation].join(" ").toLowerCase();
        return (!term || text.includes(term)) && (!status || item.status === status) && (!site || item.siteLocation === site) && (!category || item.category === category);
      });
      document.getElementById("equipmentList").innerHTML = filtered.map(cardTemplate).join("") || emptyState("No matching equipment.");
    };
    ["searchInput", "statusFilter", "siteFilter", "categoryFilter"].forEach((id) => document.getElementById(id).addEventListener("input", update));
    update();
  }

  async function renderDetail() {
    const params = new URLSearchParams(location.search);
    const equipmentId = params.get("equipmentId") || params.get("id");
    console.log("DETAIL EQUIPMENT ID:", equipmentId);
    const { data } = await window.NEMS_API.getEquipmentById(equipmentId);
    if (!data) {
      document.getElementById("detailRoot").innerHTML = emptyState("Equipment not found.");
      return;
    }
    const equipment = data;
    console.log("DETAIL EQUIPMENT:", equipment);
    console.log("DETAIL PHOTO:", equipment.photoUrls);
    document.getElementById("editLink").href = `edit-equipment.html?equipmentId=${encodeURIComponent(equipment.equipmentId)}`;
    const detailPhotoUrls = Array.isArray(equipment.photoUrls)
      ? equipment.photoUrls
      : normalizePhotos(equipment.photoUrls).filter((url) => url !== placeholder);
    const detailPhotoUrl = detailPhotoUrls.length > 0 ? convertDriveImage(detailPhotoUrls[0]) : placeholder;
    const container = document.getElementById("detailRoot");
    console.log("RENDER FUNCTION:", "renderDetail");
    console.log("RENDER CONTAINER:", container);
    container.innerHTML = `
      <div class="equipment-card">
        <img src="${escapeAttr(detailPhotoUrl)}" class="equipment-photo" alt="${escapeAttr(equipment.equipmentName)}">
        <div class="equipment-info">
          ${detailRow("Equipment ID", equipment.equipmentId)}
          ${detailRow("Equipment Name", equipment.equipmentName)}
          ${detailRow("Category", equipment.category)}
          ${detailRow("Brand", equipment.brand)}
          ${detailRow("Model", equipment.model)}
          ${detailRow("Serial Number", equipment.serialNumber)}
          ${detailRow("Location", equipment.siteLocation)}
          ${detailRow("Status", equipment.status)}
          ${detailRow("Condition", equipment.condition)}
          ${detailRow("Remarks", equipment.remarks)}
        </div>
      </div>
      <section class="detail-actions admin-only">
        <a class="secondary-action" href="edit-equipment.html?equipmentId=${encodeURIComponent(equipment.equipmentId)}">Edit Equipment</a>
        <button class="danger-action" id="deleteDetailBtn" type="button">Delete Equipment</button>
      </section>
      <div class="section-row"><h2>Maintenance</h2><a class="text-action" href="maintenance.html?equipmentId=${encodeURIComponent(equipment.equipmentId)}">Open</a></div>
    `;
    document.getElementById("closePhoto")?.addEventListener("click", () => document.getElementById("photoDialog").close());
    applyRole(window.NEMS_AUTH.getUser());
    document.getElementById("deleteDetailBtn")?.addEventListener("click", () => deleteEquipmentAndRedirect(equipment.equipmentId));
  }

  async function renderEquipmentForm(edit = false) {
    const form = document.getElementById("equipmentForm");
    const params = new URLSearchParams(location.search);
    const equipmentId = params.get("equipmentId") || params.get("id");
    const existing = edit ? (await window.NEMS_API.getEquipmentById(equipmentId)).data : {};
    const siteLocationMissing = Boolean(existing.siteLocation) && !SITES.includes(existing.siteLocation);
    const siteOptions = siteLocationMissing ? [existing.siteLocation, ...SITES] : SITES;
    form.innerHTML = `
      <div class="form-grid">
        ${field("equipmentId", "Equipment ID", existing.equipmentId, false)}
        ${field("equipmentName", "Equipment Name", existing.equipmentName, true)}
        ${selectField("category", "Category", CATEGORIES, existing.category)}
        ${field("brand", "Brand", existing.brand)}
        ${field("model", "Model", existing.model)}
        ${field("serialNumber", "Serial Number", existing.serialNumber)}
        ${field("purchaseDate", "Purchase Date", existing.purchaseDate, false, "date")}
        <div>
          ${selectField("siteLocation", "Site Location", siteOptions, existing.siteLocation)}
          ${siteLocationMissing ? `<small class="muted">"${escapeHtml(existing.siteLocation)}" is not in your Sites list. Add it under Sites, or pick a different one here.</small>` : ""}
        </div>
        ${selectField("status", "Status", STATUS, existing.status)}
        ${selectField("condition", "Condition", CONDITION, existing.condition)}
      </div>
      <label><span>Remarks</span><textarea name="remarks">${escapeHtml(existing.remarks || "")}</textarea></label>
      <label><span>Photos</span><input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" capture="environment" multiple></label>
      <div class="preview-grid" id="previewGrid"></div>
      <div class="form-actions">
        <button class="primary-action" type="submit">${edit ? "Update" : "Save"} Equipment</button>
        ${edit ? '<button class="danger-action" id="deleteEquipmentBtn" type="button">Delete</button>' : ""}
      </div>
    `;

    loadSites().then(() => refreshSiteLocationOptions(form, existing.siteLocation));

    const photoInput = document.getElementById("photoInput");
    const previewGrid = document.getElementById("previewGrid");
    let photoItems = normalizePhotos(existing.photoUrls)
      .filter((url) => url !== placeholder)
      .map((url, index) => ({ url, name: `Photo ${index + 1}` }));
    renderPhotoPreviews(previewGrid, photoItems);
    photoInput.addEventListener("change", async () => {
      const files = [...photoInput.files];
      console.log("Selected files:", files);
      const previews = await Promise.all(files.map(createImagePreview));
      photoItems = [...photoItems, ...previews];
      renderPhotoPreviews(previewGrid, photoItems);
      photoInput.value = "";
    });
    previewGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-photo]");
      if (!button) return;
      photoItems.splice(Number(button.dataset.removePhoto), 1);
      renderPhotoPreviews(previewGrid, photoItems);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const formData = Object.fromEntries(new FormData(form).entries());
        const photoUrls = photoItems.map((item) => item.url);
        const savedUrls = photoUrls.filter((url) => !url.startsWith("data:"));
        const localUrls = photoUrls.filter((url) => url.startsWith("data:"));
        const user = window.NEMS_AUTH.getUser();
        const initialPayload = { ...existing, ...formData, createdBy: user?.email || "", photoUrls: isDemoMode() ? photoUrls : savedUrls };
        console.log("ADD EQUIPMENT DATA:", initialPayload);
        const result = edit ? await window.NEMS_API.updateEquipment(initialPayload) : await window.NEMS_API.addEquipment(initialPayload);
        console.log("NEW EQUIPMENT RESULT:", result);
        console.log("ADD RESULT:");
        console.log(result);
        const savedEquipment = result?.data || {};
        const equipmentId = extractEquipmentId(savedEquipment, initialPayload);
        console.log("EXTRACTED EQUIPMENT ID:");
        console.log(equipmentId);
        if (!equipmentId) {
          throw new Error("Equipment saved, but backend did not return an equipmentId.");
        }
        if (!isDemoMode() && localUrls.length) {
          const existingPhotos = [...savedUrls];
          const uploadedPhotos = [...existingPhotos];
          for (const [index, dataUrl] of localUrls.entries()) {
            const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
            const extension = mimeType.split("/").pop().replace("jpeg", "jpg");
            console.log("UPLOAD PHOTO EQUIPMENT ID:", equipmentId);
            const uploadResult = await window.NEMS_API.uploadPhoto(equipmentId, `photo-${Date.now()}-${index}.${extension}`, mimeType, dataUrl);
            const photoUrl =
              uploadResult.data?.url ||
              uploadResult.url ||
              "";
            console.log("UPLOADED PHOTO URL:", photoUrl);
            if (photoUrl) uploadedPhotos.push(photoUrl);
          }
          const updatePayload = {
            equipmentId,
            photoUrls: uploadedPhotos
          };
          console.log("UPDATE EQUIPMENT DATA:", updatePayload);
          console.log("FINAL PHOTO UPDATE:");
          console.log(JSON.stringify({
            equipmentId,
            photoUrls: uploadedPhotos
          }, null, 2));
          console.log("UPDATE PAYLOAD:");
          console.log(JSON.stringify({
            equipmentId,
            photoUrls: uploadedPhotos
          }, null, 2));
          await window.NEMS_API.updateEquipment(updatePayload);
        }
        alert("Equipment saved successfully");
        window.location.href = `equipment-detail.html?equipmentId=${encodeURIComponent(equipmentId)}`;
      } catch (error) {
        alert(`Save failed: ${error.message}`);
        console.error(error);
      }
    });

    document.getElementById("deleteEquipmentBtn")?.addEventListener("click", async () => {
      deleteEquipmentAndRedirect(existing.equipmentId);
    });
  }

  async function deleteEquipmentAndRedirect(equipmentId) {
    if (!equipmentId) return;
    if (!confirm(`Delete equipment ${equipmentId}? This action cannot be undone.`)) return;
    await window.NEMS_API.deleteEquipment(equipmentId);
    window.location.href = "equipment.html";
  }

  async function renderMaintenance() {
    const params = new URLSearchParams(location.search);
    const equipmentId = params.get("equipmentId") || params.get("id") || "";
    const form = document.getElementById("maintenanceForm");
    form.innerHTML = `
      <div class="form-grid">
        ${field("equipmentId", "Equipment ID", equipmentId, true)}
        ${field("date", "Date", new Date().toISOString().slice(0, 10), true, "date")}
        ${field("cost", "Cost", "", false, "number")}
        ${field("performedBy", "Performed By", "")}
      </div>
      <label><span>Description</span><textarea name="description" required></textarea></label>
      <label><span>Remarks</span><textarea name="remarks"></textarea></label>
      <button class="primary-action" type="submit">Add Maintenance</button>
    `;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await window.NEMS_API.addMaintenance(Object.fromEntries(new FormData(form).entries()));
      renderMaintenanceList(equipmentId);
      form.reset();
    });
    renderMaintenanceList(equipmentId);
  }

  async function renderMaintenanceList(equipmentId) {
    const { data } = await window.NEMS_API.getMaintenance(equipmentId);
    const admin = window.NEMS_AUTH.isAdmin();
    const list = document.getElementById("maintenanceList");
    list.innerHTML = data.map((record) => `
      <article class="equipment-card">
        <img src="${placeholder}" alt="">
        <div class="equipment-card-body">
          <span class="badge">${escapeHtml(record.date || "No date")}</span>
          <h3>${escapeHtml(record.equipmentId)}</h3>
          <p class="meta-line">${escapeHtml(record.description || "")}</p>
          <p class="meta-line">${escapeHtml(record.performedBy || "")} ${record.cost ? "· RM " + escapeHtml(record.cost) : ""}</p>
          ${admin ? `<div class="demo-grid"><button class="secondary-action" type="button" data-edit-maint="${escapeAttr(record.maintenanceId)}">Edit</button><button class="danger-action" type="button" data-delete-maint="${escapeAttr(record.maintenanceId)}">Delete</button></div>` : ""}
        </div>
      </article>
    `).join("") || emptyState("No maintenance records yet.");
    list.querySelectorAll("[data-delete-maint]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (confirm("Delete this maintenance record?")) {
          await window.NEMS_API.deleteMaintenance(button.dataset.deleteMaint);
          renderMaintenanceList(equipmentId);
        }
      });
    });
    list.querySelectorAll("[data-edit-maint]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = data.find((item) => item.maintenanceId === button.dataset.editMaint);
        const description = prompt("Update maintenance description", record.description || "");
        if (description === null) return;
        await window.NEMS_API.updateMaintenance({ ...record, description });
        renderMaintenanceList(equipmentId);
      });
    });
  }

  function renderProfile() {
    const user = window.NEMS_AUTH.getUser();
    document.getElementById("profileCard").innerHTML = `
      <h2>${escapeHtml(user.name)}</h2>
      <p class="muted">${escapeHtml(user.email)}</p>
      <p><span class="badge">${escapeHtml(user.role)}</span></p>
      <button class="secondary-action" id="signOutBtn" type="button">Sign Out</button>
    `;
    document.getElementById("signOutBtn").addEventListener("click", window.NEMS_AUTH.signOut);
  }

  async function renderSitesList() {
    const { data } = await window.NEMS_API.getSites();
    SITE_RECORDS = Array.isArray(data) ? data : [];
    const search = document.getElementById("siteSearchInput");
    const statusFilter = document.getElementById("siteStatusFilter");
    if (statusFilter) fillSelect("siteStatusFilter", ["All Status", ...SITE_STATUS]);

    const update = () => {
      const term = (search?.value || "").trim().toLowerCase();
      const status = statusFilter ? valueOrBlank("siteStatusFilter", "All Status") : "";
      const filtered = SITE_RECORDS.filter((site) => {
        const text = [site.siteId, site.siteName, site.location, site.pic, site.contact].join(" ").toLowerCase();
        return (!term || text.includes(term)) && (!status || site.status === status);
      });
      document.getElementById("siteList").innerHTML = filtered.map(siteCardTemplate).join("") || emptyState("No matching sites.");
    };
    [search, statusFilter].filter(Boolean).forEach((element) => element.addEventListener("input", update));
    update();
  }

  async function renderSiteDetail() {
    const params = new URLSearchParams(location.search);
    const siteId = params.get("siteId") || params.get("id");
    const { data } = await window.NEMS_API.getSites();
    const site = (data || []).find((item) => item.siteId === siteId);
    if (!site) {
      document.getElementById("siteDetailRoot").innerHTML = emptyState("Site not found.");
      return;
    }
    document.getElementById("editSiteLink").href = `edit-site.html?siteId=${encodeURIComponent(site.siteId)}`;
    document.getElementById("siteDetailRoot").innerHTML = `
      <div class="equipment-card">
        <div class="equipment-info">
          ${detailRow("Site ID", site.siteId)}
          ${detailRow("Site Name", site.siteName)}
          ${detailRow("Status", site.status)}
          ${detailRow("PIC", site.pic)}
          ${detailRow("Contact", site.contact)}
          ${detailRow("Location", site.location)}
          ${detailRow("Remarks", site.remarks)}
        </div>
      </div>
      <section class="detail-actions admin-only">
        <a class="secondary-action" href="edit-site.html?siteId=${encodeURIComponent(site.siteId)}">Edit Site</a>
        <button class="danger-action" id="deleteSiteDetailBtn" type="button">Delete Site</button>
      </section>
    `;
    applyRole(window.NEMS_AUTH.getUser());
    document.getElementById("deleteSiteDetailBtn")?.addEventListener("click", () => deleteSiteAndRedirect(site.siteId));
  }

  async function renderSiteForm(edit = false) {
    const form = document.getElementById("siteForm");
    const params = new URLSearchParams(location.search);
    const siteId = params.get("siteId") || params.get("id");
    let existing = {};
    if (edit) {
      const { data } = await window.NEMS_API.getSites();
      existing = (data || []).find((item) => item.siteId === siteId) || {};
    }
    form.innerHTML = `
      <div class="form-grid">
        ${field("siteId", "Site ID", existing.siteId, false)}
        ${field("siteName", "Site Name", existing.siteName, true)}
        ${field("location", "Location", existing.location)}
        ${field("pic", "PIC", existing.pic)}
        ${field("contact", "Contact", existing.contact)}
        ${selectField("status", "Status", SITE_STATUS, existing.status || "Active")}
      </div>
      <label><span>Remarks</span><textarea name="remarks">${escapeHtml(existing.remarks || "")}</textarea></label>
      <div class="form-actions">
        <button class="primary-action" type="submit">${edit ? "Update" : "Save"} Site</button>
        ${edit ? '<button class="danger-action" id="deleteSiteBtn" type="button">Delete</button>' : ""}
      </div>
    `;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const formData = Object.fromEntries(new FormData(form).entries());
        const payload = { ...existing, ...formData };
        const result = edit ? await window.NEMS_API.updateSite(payload) : await window.NEMS_API.addSite(payload);
        const savedSite = result?.data || {};
        const savedSiteId = savedSite.siteId || payload.siteId;
        if (!savedSiteId) {
          throw new Error("Site saved, but backend did not return a siteId.");
        }
        alert("Site saved successfully");
        window.location.href = `site-detail.html?siteId=${encodeURIComponent(savedSiteId)}`;
      } catch (error) {
        alert(`Save failed: ${error.message}`);
        console.error(error);
      }
    });

    document.getElementById("deleteSiteBtn")?.addEventListener("click", () => {
      deleteSiteAndRedirect(existing.siteId);
    });
  }

  async function deleteSiteAndRedirect(siteId) {
    if (!siteId) return;
    if (!confirm(`Delete site ${siteId}? This action cannot be undone.`)) return;
    await window.NEMS_API.deleteSite(siteId);
    window.location.href = "site.html";
  }

  async function renderUsersList() {
    const { data } = await window.NEMS_API.getUsers();
    const search = document.getElementById("userSearchInput");
    const update = () => {
      const term = (search?.value || "").trim().toLowerCase();
      const filtered = data.filter((user) => {
        const text = [user.userId, user.name, user.email, user.role].join(" ").toLowerCase();
        return !term || text.includes(term);
      });
      document.getElementById("userList").innerHTML = filtered.map(userCardTemplate).join("") || emptyState("No users found.");
    };
    search?.addEventListener("input", update);
    update();
  }

  async function renderUserForm(edit = false) {
    const form = document.getElementById("userForm");
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId") || params.get("id");
    let existing = {};
    if (edit) {
      const { data } = await window.NEMS_API.getUsers();
      existing = (data || []).find((item) => item.userId === userId) || {};
    }
    form.innerHTML = `
      <div class="form-grid">
        ${field("userId", "User ID", existing.userId, false)}
        ${field("name", "Full Name", existing.name, true)}
        ${field("email", "Email", existing.email, true, "email")}
        ${selectField("role", "Role", USER_ROLES, existing.role || "VIEWER")}
        ${selectField("status", "Status", USER_STATUS, existing.status || "Active")}
      </div>
      <label>
        <span>${edit ? "New Password (leave blank to keep current)" : "Password"}</span>
        <input name="password" type="password" autocomplete="new-password" ${edit ? "" : "required"}>
      </label>
      <div class="form-actions">
        <button class="primary-action" type="submit">${edit ? "Update" : "Save"} User</button>
        ${edit ? '<button class="danger-action" id="deleteUserBtn" type="button">Delete</button>' : ""}
      </div>
    `;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const formData = Object.fromEntries(new FormData(form).entries());
        if (edit && !formData.password) delete formData.password;
        const payload = { ...existing, ...formData };
        const result = edit ? await window.NEMS_API.updateUser(payload) : await window.NEMS_API.addUser(payload);
        const savedUser = result?.data || {};
        const savedUserId = savedUser.userId || payload.userId;
        if (!savedUserId) {
          throw new Error("User saved, but backend did not return a userId.");
        }
        alert("User saved successfully");
        window.location.href = "users.html";
      } catch (error) {
        alert(`Save failed: ${error.message}`);
        console.error(error);
      }
    });

    document.getElementById("deleteUserBtn")?.addEventListener("click", () => {
      deleteUserAndRedirect(existing.userId);
    });
  }

  async function deleteUserAndRedirect(userId) {
    if (!userId) return;
    if (!confirm(`Delete user ${userId}? This action cannot be undone.`)) return;
    try {
      await window.NEMS_API.deleteUser(userId);
      window.location.href = "users.html";
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  }

  function userCardTemplate(user) {
    return `
      <a class="equipment-card" href="edit-user.html?userId=${encodeURIComponent(user.userId)}">
        <div class="equipment-card-body">
          <span class="badge ${slug(user.status || "Active")}">${escapeHtml(user.status || "Active")}</span>
          <h3>${escapeHtml(user.name)}</h3>
          <p class="meta-line">${escapeHtml(user.email)}</p>
          <p class="meta-line">${escapeHtml(user.role)}</p>
        </div>
      </a>
    `;
  }

  function siteCardTemplate(site) {
    return `
      <a class="equipment-card" href="site-detail.html?siteId=${encodeURIComponent(site.siteId)}">
        <div class="equipment-card-body">
          <span class="badge ${slug(site.status || "")}">${escapeHtml(site.status || "Active")}</span>
          <h3>${escapeHtml(site.siteName)}</h3>
          <p class="meta-line">${escapeHtml(site.location || "")}</p>
          <p class="meta-line">${escapeHtml(site.pic || "")}</p>
        </div>
      </a>
    `;
  }

  function cardTemplate(item) {
    const equipment = item;
    console.log("EQUIPMENT CARD DATA:", equipment);
    console.log("PHOTO URL:", equipment.photoUrls);
    const photoUrls = Array.isArray(equipment.photoUrls)
      ? equipment.photoUrls
      : normalizePhotos(equipment.photoUrls).filter((url) => url !== placeholder);
    const photoUrl =
      Array.isArray(photoUrls) && photoUrls.length > 0
        ? photoUrls[0]
        : "";
    const photo = photoUrl ? convertDriveImage(photoUrl) : placeholder;
    return `
      <a class="equipment-card" href="equipment-detail.html?equipmentId=${encodeURIComponent(equipment.equipmentId)}">
        <img src="${escapeAttr(photo)}" class="equipment-photo" alt="${escapeAttr(equipment.equipmentName)}">
        <div class="equipment-card-body">
          <span class="badge ${slug(equipment.status)}">${escapeHtml(equipment.status)}</span>
          <h3>${escapeHtml(equipment.equipmentName)}</h3>
          <p class="meta-line">${escapeHtml(equipment.equipmentId)}</p>
          <p class="meta-line">${escapeHtml(equipment.siteLocation || "")}</p>
        </div>
      </a>
    `;
  }

  function fillSelect(id, values) {
    document.getElementById(id).innerHTML = values.map((value) => `<option>${escapeHtml(value)}</option>`).join("");
  }

  function valueOrBlank(id, allLabel) {
    const value = document.getElementById(id).value;
    return value === allLabel ? "" : value;
  }

  function normalizePhotos(value) {
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (error) {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }
    return [placeholder];
  }

  function convertDriveImage(url) {
    const match = String(url || "").match(/id=([^&]+)/);
    if (match) {
      return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w800";
    }
    return url;
  }

  function detailRow(label, value) {
    return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
  }

  function field(name, label, value = "", required = false, type = "text") {
    return `<label><span>${label}</span><input name="${name}" type="${type}" value="${escapeAttr(value || "")}" ${required ? "required" : ""}></label>`;
  }

  function selectField(name, label, options, selected = "") {
    return `<label><span>${label}</span><select name="${name}">${options.map((option) => `<option ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  }

  function openPhoto(url) {
    document.getElementById("dialogPhoto").src = url;
    document.getElementById("photoDialog").showModal();
  }

  function createImagePreview(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const max = 1400;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          const imageDataURL = canvas.toDataURL("image/jpeg", 0.78);
          console.log("Preview generated:", imageDataURL);
          resolve({ url: imageDataURL, name: file.name });
        };
        image.onerror = () => {
          console.log("Preview generated:", reader.result);
          resolve({ url: reader.result, name: file.name });
        };
        image.src = reader.result;
      };
      reader.onerror = () => {
        console.error("Photo preview failed:", file.name, reader.error);
        resolve({ url: placeholder, name: file.name });
      };
      reader.readAsDataURL(file);
    });
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderPhotoPreviews(container, photos) {
    container.innerHTML = photos.map((photo, index) => `
      <article class="preview-item">
        <img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.name || "Selected photo")}">
        <div class="preview-meta">
          <span>${escapeHtml(photo.name || `Photo ${index + 1}`)}</span>
          <button type="button" data-remove-photo="${index}">Remove</button>
        </div>
      </article>
    `).join("");
  }

  function extractEquipmentId(savedEquipment = {}, fallbackEquipment = {}) {
    return String(
      savedEquipment.equipmentId ||
      savedEquipment["Equipment ID"] ||
      savedEquipment.id ||
      fallbackEquipment.equipmentId ||
      fallbackEquipment["Equipment ID"] ||
      fallbackEquipment.id ||
      ""
    ).trim();
  }

  function isDemoMode() {
    const config = window.NEMS_CONFIG || {};
    return Boolean(config?.DEMO_MODE ?? false) || String(config?.API_URL || "").includes("PASTE_");
  }

  function slug(value = "") {
    return value.toLowerCase().replace(/\s+/g, "-");
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value = "") {
    return escapeHtml(value);
  }
})();

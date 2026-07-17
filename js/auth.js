(function () {
  const AUTH_KEY = "nems_user";

  const approvedAdmins = [
    "admin@naga.local"
  ];

  const fallbackUsers = {
    ADMIN: { name: "NAGA Administrator", email: "admin@naga.local", role: "ADMIN" },
    VIEWER: { name: "NAGA Viewer", email: "viewer@naga.local", role: "VIEWER" }
  };

  function normalizeUser(user) {
    if (!user || typeof user !== "object") return null;
    return {
      name: user.name || "",
      email: String(user.email || "").trim().toLowerCase(),
      role: String(user.role || "VIEWER").trim().toUpperCase(),
      token: user.token || ""
    };
  }

  function getUser() {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    try {
      const user = normalizeUser(JSON.parse(raw));
      if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  }

  function setUser(user) {
    const nextUser = normalizeUser(user);
    localStorage.removeItem(AUTH_KEY);
    localStorage.setItem(AUTH_KEY, JSON.stringify(nextUser));
    return nextUser;
  }

  function signOut() {
    const user = getUser();
    if (user?.token && window.NEMS_API?.logout) {
      window.NEMS_API.logout(user.token).catch(() => {});
    }
    localStorage.removeItem(AUTH_KEY);
    window.location.href = "index.html";
  }

  function loginDemo(role) {
    const selectedRole = String(role || "VIEWER").trim().toUpperCase();
    setUser(fallbackUsers[selectedRole] || fallbackUsers.VIEWER);
    console.log("Login user:", window.NEMS_AUTH.getUser());
    console.log("Is Admin:", window.NEMS_AUTH.isAdmin());
    window.location.href = "dashboard.html";
  }

  function loginGooglePlaceholder() {
    alert("Production Google login setup: add your Google Client ID and call Google Identity Services here. Demo login is available for setup testing.");
  }

  function isAdmin(user = getUser()) {
    const normalized = normalizeUser(user);
    const adminEmails = approvedAdmins.map((email) => String(email).trim().toLowerCase());
    return Boolean(
      normalized &&
      (
        String(normalized.role).toUpperCase() === "ADMIN" ||
        adminEmails.includes(normalized.email)
      )
    );
  }

  function requireAuth() {
    const publicPage = location.pathname.endsWith("/") || location.pathname.endsWith("index.html");
    const user = getUser();
    if (!publicPage && !user) {
      window.location.href = "index.html";
      return null;
    }
    if (publicPage && user) {
      window.location.href = "dashboard.html";
      return user;
    }
    return user;
  }

  window.NEMS_AUTH = {
    getUser,
    setUser,
    signOut,
    loginDemo,
    loginGooglePlaceholder,
    isAdmin,
    normalizeUser,
    requireAuth
  };
})();

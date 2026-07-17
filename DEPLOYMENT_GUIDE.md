# NAGA Equipment Management System (NEMS)

NEMS is a mobile-first Progressive Web App for managing NAGA construction equipment, photos, status, and maintenance records.

## Files

- `index.html` login page
- `dashboard.html` dashboard
- `equipment.html` equipment register
- `equipment-detail.html` equipment detail and gallery
- `add-equipment.html` admin add form
- `edit-equipment.html` admin edit form
- `maintenance.html` maintenance records
- `profile.html` user profile
- `css/style.css` mobile-first interface
- `js/api.js` frontend API connector and setup demo data
- `js/auth.js` Google login integration point and role handling
- `js/app.js` page behavior
- `assets/manifest.json` PWA manifest
- `assets/service-worker.js` offline app shell
- `apps-script/Code.gs` Google Apps Script backend

## 1. Google Sheet Setup

1. Create a Google Sheet named `NAGA Equipment Database`.
2. Create a sheet tab named `Equipment`.
3. Add these columns in row 1:

   `equipmentId`, `equipmentName`, `category`, `brand`, `model`, `serialNumber`, `purchaseDate`, `siteLocation`, `status`, `condition`, `remarks`, `photoUrls`, `createdAt`, `updatedAt`

4. Create a second tab named `Maintenance`.
5. Add these columns in row 1:

   `maintenanceId`, `equipmentId`, `date`, `description`, `cost`, `performedBy`, `remarks`, `createdAt`, `updatedAt`

The Apps Script backend can also create these tabs automatically by running `setupNemsDatabase()`.

## 2. Google Drive Setup

1. Create a Google Drive folder named `NAGA Equipment Photos`.
2. For each equipment item, the backend creates a subfolder using the equipment ID:

   `NAGA Equipment Photos / NAGA-EQ-0001`

3. Uploaded JPG, PNG, and WEBP images are stored in the matching equipment folder.

## 3. Google Apps Script Deployment

1. Open [Google Apps Script](https://script.google.com/).
2. Create a new project named `NEMS API`.
3. Replace the default script with the contents of `apps-script/Code.gs`.
4. Update `CONFIG.ADMIN_EMAILS` with approved admin Google accounts.
5. Run `setupNemsDatabase()` once and approve permissions.
6. Select **Deploy > New deployment > Web app**.
7. Set:
   - Execute as: `Me`
   - Who has access: your organization or approved users
8. Deploy and copy the Web App URL.
9. Paste the URL into `js/api.js` as `CONFIG.API_URL`.
10. Set `CONFIG.DEMO_MODE` to `false`.

## 4. Google Account Login

The current frontend includes setup demo login buttons so the app can be tested immediately.

For production:

1. Create an OAuth Client ID in Google Cloud Console.
2. Add your Cloudflare Pages domain to authorized JavaScript origins.
3. Load Google Identity Services in `index.html`.
4. Replace `loginGooglePlaceholder()` in `js/auth.js` with token handling.
5. Send the signed-in email to the Apps Script API and match it against `CONFIG.ADMIN_EMAILS`.

Admins can create, edit, delete, upload photos, and manage maintenance. Viewers are read-only.

## 5. Cloudflare Pages Deployment

1. Push this folder to a Git repository.
2. In Cloudflare Pages, create a new project from that repository.
3. Use these settings:
   - Framework preset: `None`
   - Build command: leave empty
   - Output directory: `/`
4. Deploy.
5. Open the Cloudflare Pages URL on Android, iPhone, tablet, or desktop.
6. Use the browser menu to add NEMS to the home screen.

## 6. Admin User Guide

1. Sign in with an approved Google admin account.
2. Open **Equipment**.
3. Tap **Add** to create an equipment record.
4. Add photos from the phone camera or gallery.
5. Open an equipment detail page and tap **Edit** to update status, condition, location, or remarks.
6. Open **Maintenance** from the detail page to add service records.

## 7. Viewer User Guide

1. Sign in with an approved Google viewer account.
2. Open **Dashboard** to view equipment summary.
3. Open **Equipment** to browse assets.
4. Use search and filters for status, site, and category.
5. Open an equipment card to view details, photos, and maintenance history.

## Future Expansion

The Google Sheets and Apps Script structure can be extended with new tabs and API actions for:

- NAGA Material Management System
- NAGA Vehicle Tracking System
- NAGA Document Management System
- NAGA Site Progress System
- NAGA Worker Attendance System
- NAGA QR Code Asset Tracking System

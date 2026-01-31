# Deployment Guide for SME TalentFlow

This guide covers deploying the application to **Hostinger**.

## Option 1: Hostinger VPS (Recommended)
VPS gives you full control and is best for Node.js apps.

### Prerequisites
- SSH Access to your VPS
- Git (optional, or upload zip)
- Node.js & NPM installed on VPS (v18+)
- PM2 installed globally (`npm install -g pm2`)
- Nginx (as reverse proxy)

### Steps
1. **Prepare the Code**
   - Ensure your local `package.json` has the updated scripts (done).
   - Zip the project (excluding `node_modules`, `.git`, `_backups`).
   
2. **Upload**
   - Upload the zip to `/var/www/talentflow` (or your preferred path).
   - Unzip it.

3. **Install & Build**
   ```bash
   cd /var/www/talentflow
   npm install      # Installs root (server) deps
   npm run build    # Installs client deps and builds React app
   ```

4. **Environment Variables**
   - Create a `.env` file in the root:
     ```bash
     PORT=3001
     JWT_SECRET=your_secure_random_string
     SMTP_HOST=your_smtp_host
     SMTP_USER=your_email
     SMTP_PASS=your_password
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
     FRONTEND_URL=https://your-domain.com
     ```

5. **Start with PM2**
   ```bash
   pm2 start server/index.js --name "talentflow"
   pm2 save
   pm2 startup
   ```

6. **Configure Nginx**
   - Point your domain to the VPS IP.
   - Edit Nginx config (`/etc/nginx/sites-available/default`):
     ```nginx
     server {
         listen 80;
         server_name your-domain.com;

         location / {
             proxy_pass http://localhost:3001;
             proxy_http_version 1.1;
             proxy_set_header Upgrade $http_upgrade;
             proxy_set_header Connection 'upgrade';
             proxy_set_header Host $host;
             proxy_cache_bypass $http_upgrade;
         }
     }
     ```
   - Restart Nginx: `sudo systemctl restart nginx`

---

## Option 2: Hostinger Shared Hosting (Node.js Support)
Hostinger's shared plans have specific Node.js setups.

1. **Create Node.js App**
   - Go to hPanel > Websites > Manage > Node.js.
   - Create Application:
     - Version: 18+
     - Application Root: `domains/yourdomain.com/public_html`
     - Application Startup File: `server/index.js`

2. **Upload Files**
   - Use File Manager to upload your code to `public_html`.
   - **Important**: Do NOT upload `node_modules`.

3. **Install Dependencies**
   - In the Node.js settings, click **NPM Install**.
   - This only installs root dependencies.
   - For the client, you should **build locally** and upload the `client/dist` folder.
   
   **Local Build Step:**
   ```bash
   npm run build
   ```
   - Upload the resulting `client/dist` folder to `public_html/client/dist`.

4. **Environment Variables**
   - In Node.js settings, add your environment variables (PORT, DB credentials, etc.).
   
5. **Start**
   - Click "Restart" or "Start" in hPanel.

## Troubleshooting
- **"Client not found"**: Ensure `client/dist` exists. The server code specifically checks for `../client/dist` relative to `server/index.js`.
- **Database**: This app uses SQLite (`database.sqlite`). Ensure the file is writable by the server process. On VPS, `chmod 775 database.sqlite`.

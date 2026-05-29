```markdown
# Campus OS 🎓

> **A unified, real-time campus management ecosystem engineered for IIIT Vadodara - International Campus Diu.**

![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_PostgreSQL-2ea44f?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active_Development-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)

Campus OS is a scalable, full-stack management platform designed to centralize and automate university operations. By replacing fragmented spreadsheets and legacy apps, it delivers a single, cohesive portal with real-time data synchronization for five distinct campus roles: **Students, Faculty, Admins, Maintenance Workers, and Security Guards**.

Designed with a high-contrast, brutalist UI/UX, the system prioritizes speed, accessibility, and operational efficiency.

---

## 🚀 Key Features

* **Strict Role-Based Access Control (RBAC):** Secure, segmented dashboards tailored to five specific user roles with custom capabilities and data views.
* **Real-Time Subsystems (SSE):** Utilizes Server-Sent Events (SSE) for instant campus-wide broadcast messages, live security alerts, and dynamic timetable updates without client polling.
* **Geofenced Operations:** Location-validated punch-ins for staff and security personnel to ensure operational compliance.
* **Automated Issue Ticketing:** A centralized hub where students can report issues (with camera integration/photo capture), which are automatically routed to relevant maintenance workers or security guards.
* **Academic Communications:** Direct, course-filtered Q&A threads between students and faculty, alongside a public campus forum.
* **Authentication Security:** Secure local authentication coupled with Google OAuth integration, enforcing strict password policies and credential management.

## 🛠️ Technical Architecture

### Backend
* **Runtime:** Node.js 
* **Framework:** Express.js
* **Database:** PostgreSQL (Hosted on Neon DB). *Migrated from SQLite for better concurrent connection handling and scalability.*
* **Real-Time:** Server-Sent Events (SSE) for unidirectional real-time data streams.
* **Integrations:** `nodemailer` for automated SMTP system emails (welcome credentials, alerts).

### Frontend
* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Design Language:** Custom Brutalist aesthetic utilizing `Plus Jakarta Sans` and `Outfit` typography, optimized for clarity and high contrast.
* **Device APIs:** HTML5 MediaDevices API for live image capture and Geolocation API for spatial validation.

---

## 🛡️ Role Modules

1. **SysAdmin (`/dashboard-admin`):** Root access command center. Manage users, oversee live dispatch queues, publish the campus blueprint, and broadcast global notices.
2. **Faculty (`/dashboard-faculty`):** Manage weekly teaching schedules, take bulk attendance with analytics, and resolve student academic queries.
3. **Student (`/dashboard-student`):** View real-time timetables, track attendance percentages, file maintenance/security tickets, and interact with the campus forum.
4. **Worker (`/dashboard-worker`):** Interactive stepper-based task management for assigned maintenance duties.
5. **Guard (`/dashboard-guard`):** Monitor live shift schedules, file critical security alerts, and track campus safety queues.

---

## ⚙️ Local Development Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher)
* [PostgreSQL](https://www.postgresql.org/) (Local instance or Neon DB connection URI)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/campus-os-live.git](https://github.com/yourusername/campus-os-live.git)
   cd campus-os-live

```

2. **Install dependencies:**
```bash
npm install

```


3. **Configure Environment:**
Update the database connection string in `database.js` to point to your PostgreSQL instance, and configure the SMTP credentials in `server.js` for Nodemailer.
4. **Initialize the Database:**
The application will automatically build the schema and seed default mock users upon the first run.
```bash
node migrate-pg.js 

```


5. **Start the Server:**
```bash
npm start

```


The application will be live at `http://localhost:3000`.

---

## 👨‍💻 Project Lead

**Mehul Krishna** *Project Lead & Full-Stack Developer* B.Tech Computer Science and Engineering @ IIIT Vadodara - ICD

*Responsible for system architecture, database design, backend API development, and UI/UX implementation.*

```

```

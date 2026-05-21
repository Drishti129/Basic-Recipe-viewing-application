# Gourmet Passport — Full-Stack Recipe Application

Gourmet Passport is a responsive, modern web application designed with a warm cream theme. It visualizes curated recipe profiles and interactive selection analytics from a custom culinary dataset. The platform includes full search-by-dish matching, dynamic dataset card filtration rows, and real-time interactive selection tracking dashboard meters.

---

## 🛠️ Tech Stack & Dependencies

### Frontend Dashboard
- **Library:** React (Functional components with Hooks)
- **Styling:** Custom CSS Flexbox/Grid architectures (`index.css`)
- **Package Runner:** Create React App / Vite compilation

### Backend API Server
- **Runtime Environment:** Node.js
- **Framework:** Express.js
- **Database File Mapping:** CSV Dataset Engine

---

## 📂 Project Directory Structure

```text
recipes.app/
├── backend/
│   ├── data/
│   │   └── recipes.csv         # Core dataset backend stream
│   ├── server.js               # Node.js Express server code
│   └── package.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── App.jsx             # React structural dashboard view 
    │   ├── index.css           # Global layout typography stylesheet
    │   └── main.jsx / index.js # Client-side entry wrapper point
    └── package.json

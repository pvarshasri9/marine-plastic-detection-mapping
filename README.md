# 🌊 Marine Plastic Detection & Mapping System

> **B.Tech Mini Project** — Computer Vision & Geographic Mapping System for Ocean Debris Analysis.

---

## ⚡ Run the Complete Project (ONE COMMAND)

From the project root directory:

```bash
npm install
npm run dev
```

That single command automatically starts both the React/Vite frontend and FastAPI backend concurrently!

### Service URLs:
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠 Tech Stack

- **Backend**: Python 3.13, FastAPI, SQLite, SQLAlchemy 2.1, OpenCV, ReportLab PDF, Pytest
- **Frontend**: React 18, TypeScript, Vite 8, Tailwind CSS, Leaflet Maps, Recharts Analytics, Axios
- **Orchestration**: `concurrently` (Cross-platform simultaneous startup)
- **Authentication**: JWT Bearer Tokens & Passwords hashed via Bcrypt

---

## 📁 Project Structure

```
marine-plastic-detection/
├── package.json              # ROOT startup configuration ("npm run dev")
├── README.md
├── .env.example
├── frontend/                 # Vite + React + TypeScript App
│   ├── package.json
│   ├── src/
│   └── ...
└── backend/                  # FastAPI Python Server
    ├── main.py
    ├── requirements.txt
    ├── tests/
    └── ...
```

---

## 🧪 Testing & Build Verification

### Run Backend Unit Tests

```bash
cd backend
python -m pytest tests/test_api.py -v
```

### Run Frontend Production Build Check

```bash
cd frontend
npm run build
```

---

## 📊 Core Features & Modules

1. **User Authentication**: Secure Login & Registration with JWT session management.
2. **Marine Plastic Image Detector**: Drag-and-drop image analysis with OpenCV contour detection and pre-configured Demo Mode.
3. **Detection Storage & History**: Filterable table of past scans with bounding box previews and deletion controls.
4. **Geographic Mapping**: Leaflet interactive map with density-coded markers and hotspot radius overlays.
5. **Debris Analytics**: KPI cards, plastic category pie charts, monthly trend lines, and location density bar charts.
6. **Hotspot Analysis**: Spatial proximity clustering algorithm ranking high-density ocean regions and recommending environmental intervention steps.
7. **Report & CSV Center**: Single-click PDF audit report downloads and full CSV dataset export.

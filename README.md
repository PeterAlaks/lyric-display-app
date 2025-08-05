# 🎤 Lyric Display App

A real-time lyric display web app built with **React**, **Zustand**, **Tailwind CSS**, **Socket.IO**, and **Vite**. This project enables a control panel (used on a scripture system) to push live lyrics to multiple output systems (Stream and House) via WebSocket, rendered as transparent browser sources for **OBS**.

---

## 📁 Folder Structure

```
lyric-display-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── LyricDisplayApp.jsx
│   │   ├── LyricsList.jsx
│   │   ├── OutputSettingsPanel.jsx
│   ├── context/
│   │   └── LyricsStore.js
│   ├── hooks/
│   │   ├── useFileUpload.js
│   │   └── useSocket.js
│   ├── lib/
│   │   └── utils.js
│   ├── pages/
│   │   ├── ControlPanel.jsx
│   │   ├── Output1.jsx
│   │   ├── Output2.jsx
│   ├── utils/
│   │   └── parseLyrics.js
│   ├── index.css
│   ├── App.jsx
│   └── main.jsx
├── server/
│   ├── index.js
│   └── events.js
├── .env
├── components.json
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/lyric-display-app.git
cd lyric-display-app
npm install
```

### 2. Start WebSocket Server
```bash
npm run server
```

### 3. Start React App
```bash
npm run dev
```

> The app runs at: `http://localhost:5173`
> The server runs at: `http://localhost:4000`

Ensure both the Control Panel and Outputs are connected to the same WebSocket server.

---

## 📦 Features
- Live lyrics loading and control
- Clickable lines push updates to all screens
- Per-output styling control (font, colour, drop shadow, background, margins)
- Fully transparent lyrics for browser sources in OBS
- Smooth, real-time updates via WebSockets

---

## 🧪 Outputs in OBS
1. Open **OBS Studio**
2. Add a **Browser Source**
3. Set URL to:
   - `http://localhost:5173/output1` (for Stream system)
   - `http://localhost:5173/output2` (for House system)
4. Set **Width** and **Height** (e.g., 1920x1080)
5. Check **"Custom CSS"** to transparent (if needed)

---

## 👤 Author
**Peter Alakembi**  
[Portfolio](https://behance.net/peteralaks)  
[GitHub](https://github.com/peteralaks)

---

## 📄 License
MIT © 2025

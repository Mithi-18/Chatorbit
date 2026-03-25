# 🪐 Chatorbit 

A real-time, End-to-End Encrypted chat application built with React, Node.js, Socket.io, and WebRTC.

![Home Screen Capture](https://github.com/Mithi-18/Chatorbit/blob/main/client/public/favicon.svg)

## 🚀 One-Click Deployments

The easiest way to get Chatorbit running online is to use the buttons below. We have separated the Frontend and Backend so they operate perfectly on their ideal hosting environments.

### 1. Deploy the Frontend (Vercel)
Click the button below to instantly deploy the React Chat interface to Vercel. 
*(Vercel is pre-configured to build the `client` directory automatically!)*

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMithi-18%2FChatorbit&project-name=chatorbit&repository-name=chatorbit&root-directory=client)

**Important:** During the Vercel deployment, you will be prompted to add Environment Variables. You must add:
- `VITE_API_URL`: (Leave this blank for now, or set it to `http://localhost:5000`. You will update this to your Render URL after Step 2).

---

### 2. Deploy the Backend (Render)
Because real-time chat requires persistent WebSockets (Socket.io) and our database uses SQLite, the backend must be hosted on Render (Vercel does not support WebSockets).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Mithi-18/Chatorbit)

*(To use the Render button, you must first create a `render.yaml` file, or simply go to Render.com -> New Web Service -> Connect this GitHub repo -> Select the `server` folder as your Root Directory -> Start command: `node index.js`).*

**After backend deployment:**
1. Copy the live URL Render gives you (e.g., `https://chatorbit-server.onrender.com`).
2. Go back to your **Vercel** project settings -> Environment Variables.
3. Add/Update `VITE_API_URL` to your new Render URL.
4. Redeploy the Vercel frontend!

---

## 🛠️ Local Development

If you prefer to run Chatorbit locally on your own machine:

**1. Clone the repository**
```bash
git clone https://github.com/Mithi-18/Chatorbit.git
cd Chatorbit
```

**2. Start the Backend Server**
```bash
cd server
npm install
npm run dev
# or `node index.js` if nodemon isn't globally installed
```

**3. Start the Frontend Client**
```bash
cd ../client
npm install
npm run dev
```

The frontend will start at `http://localhost:5173` and automatically connect to your local backend on port `5000`.

## 🔒 Features
- **WebRTC Calling**: Peer-to-peer Audio & Video calls using `simple-peer`.
- **E2E Encryption**: Voice and Video connections are secured via `DTLS-SRTP` encryption natively.
- **Media Support**: Send Emojis, Images, Videos, and record Voice Notes right in the browser.
- **Live Presence**: Instantly see when your friends come online or go offline.

🚀 O1 Project — Full Stack + Chrome Extension (Dockerized Setup)

This repository contains the complete O1 application, including:

🖥 Frontend (React + Extension build)

⚙️ Backend (FastAPI + PostgreSQL)

🧱 Database (Postgres in container)

🧩 Chrome Extension (automatically built via Docker)

Everything is fully containerized — no manual npm install or pip install needed.
Your teammates only need Docker Desktop installed to run it.

🧭 Directory Overview
O1/
├─ docker-compose.yml               # full local build version
├─ docker-compose.team.yml          # prebuilt (team) version
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ .env.docker.example
│  └─ app/...
├─ info/
│  ├─ Dockerfile                    # builds frontend + extension
│  ├─ package.json
│  ├─ webpack.config.js
│  ├─ .env
│  ├─ src/, public/, extension/...
│  └─ extension-artifacts/
│       └─ extension-dist.tgz
├─ .dockerignore
├─ .gitignore
└─ README-runbook.md  👈 (this file)

🧩 Tech Stack
Layer	Tech
Frontend	React (built with react-scripts)
Backend	FastAPI + SQLAlchemy
Database	PostgreSQL
Extension	Chrome Extension (Webpack build)
Containerization	Docker + Docker Compose
🧱 1. Prerequisites

Install Docker Desktop
 (Windows/Mac)
or Docker Engine (Linux)

Ensure Docker Desktop is running

Optional: Git for cloning the repo

⚙️ 2. Clone the Project
git clone https://github.com/<your-username>/o1.git
cd o1

🧩 3. Create Environment Files

In the backend/ folder, create your .env.docker file.

If you have the example file committed, just copy it:

cp backend/.env.docker.example backend/.env.docker


Confirm this file contains your development credentials (safe ones):

ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:3000
SECRET_KEY=<keep your generated key>
DATABASE_URL=postgresql://postgres:9640715869@db:5432/app_db
SMTP_SERVER=sandbox.smtp.mailtrap.io
SMTP_PORT=587
EMAIL_USER=c9b1d5d5bdc639
EMAIL_PASS=d4a22ade511f6a


💡 Do not commit secrets. Keep .env.docker.example public and .env.docker private.

🐳 4. Pull Prebuilt Images and Run (Easiest way for team)

We host prebuilt images on Docker Hub under
doc9640
 namespace.

docker compose -f docker-compose.team.yml pull
docker compose -f docker-compose.team.yml up -d


This will:

Start Postgres

Start the FastAPI backend

Start the React frontend

🌐 5. Access the Application
Component	URL
🖥 Frontend	http://localhost:3000

⚙️ Backend (API Docs)	http://localhost:8000/docs

🗃 Postgres	localhost:9640 (username: postgres, password: 9640715869)

To check running containers:

docker ps


To stop everything:

docker compose -f docker-compose.team.yml down

⚡ 6. Database Migrations (optional)

If you’re using Alembic:

docker compose -f docker-compose.team.yml exec backend alembic upgrade head

🧩 7. Chrome Extension (load manually)

The extension build artifact is already generated at:

info/extension-artifacts/extension-dist.tgz


Unpack it:

mkdir -p extension-dist
tar -xzf info/extension-artifacts/extension-dist.tgz -C extension-dist


Then open Chrome:

Go to chrome://extensions

Enable Developer mode

Click Load unpacked

Select the extension-dist/ folder

🧠 8. Developer Mode (Optional – local rebuilds)

If you want to build your own images:

# rebuild all locally
docker compose build

# or just backend/frontend
docker compose build backend
docker compose build frontend


Then push updates to Docker Hub (for team):

docker push doc9640/o1-frontend:latest
docker push doc9640/o1-backend:latest


Teammates just run:

docker compose -f docker-compose.team.yml pull
docker compose -f docker-compose.team.yml up -d

🧹 9. Common Commands
Task	Command
Check logs	docker compose logs -f backend
Rebuild & restart	docker compose build && docker compose up -d
Stop all	docker compose down
Delete everything (including volumes)	docker compose down -v
🛠 Troubleshooting
🧱 Port already in use

Change ports in docker-compose.team.yml (e.g. 3001:80, 8001:8000).

🕸 Slow Docker push (proxy)

If behind a proxy (port 3128), add this to daemon.json:

{
  "max-concurrent-uploads": 1
}


Then restart Docker Desktop.

👩‍💻 Credits

Developed by Sahithi Maddula
Docker Hub: doc9640

Version: 1.0.0

💡 Tip

To make onboarding instant for teammates:

Commit this file to your repo root (README-runbook.md)

Include .env.docker.example

Ensure docker-compose.team.yml references your Docker Hub images

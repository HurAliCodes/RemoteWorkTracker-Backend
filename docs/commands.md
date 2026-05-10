docker exec -it backend-db-1 psql -U postgres -d database_project
docker compose up -d --build 
docker compose down 
docker ps 
docker logs backend-backend-1
npx react-native run-android
npx react-native doctor
docker compose logs -f
cd C:\ngrok-v3-stable-windows-amd64
netstat -ano | findstr :5000
netstat -ano | findstr :3000

docker exec -i postgres_db psql -U admin mydb < dump.sql

## Security-related env

- `CORS_ORIGIN` — comma-separated allowed browser origins (overrides `FRONTEND_URL` for CORS). Example: `https://app.example.com,http://localhost:5173`. Use `*` only in dev to allow any origin (reflects `Origin` header).
- `FRONTEND_URL` — used as CORS origin when `CORS_ORIGIN` is unset.
- `TRUST_PROXY` — set to `1` or `true` when behind nginx/Cloudflare so rate limiting uses the real client IP (`X-Forwarded-For`).

//.*$
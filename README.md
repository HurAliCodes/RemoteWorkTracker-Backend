
# Remote Work Compliance & Task Tracker – Backend

## Docker Usage

### Build the Docker Image

```bash
docker build -t remote-work-backend .
```

### Run the Container

```bash
docker run -p 5000:5000 --env-file .env remote-work-backend
```

### Dockerfile Notes

- Uses Node 20 Alpine and multi-stage build.
- Installs dependencies and copies all files.
- Exposes port **5000** (portal API default).
- Runs database migrations (scripts/migrate.js) before starting the server (src/main.js).

> **Important:**
> If you use TypeScript, you must build your project (`npm run build` or `tsc`) before running in production. Update the Dockerfile to copy and run the compiled JavaScript (e.g., `dist/server.js`).

---

## Local Development

1. Install dependencies:
	```bash
	npm install
	```
2. Create a `.env` file with your environment variables (see example below).
3. Start the development server:
	```bash
	npm run dev
	```
4. Optional — refresh the OpenAPI spec after you change routes or Zod request bodies:
	```bash
	npm run openapi:generate
	```
	This writes [public/swagger/openapi.json](public/swagger/openapi.json). Swagger UI reads that file.

---

## API documentation (Swagger / OpenAPI)

Interactive docs are served by the same process as the API (static Swagger UI + generated spec):

| Resource | URL |
| -------- | --- |
| Swagger UI | `GET /docs/` (trailing slash helps load `openapi.json` relative to the page) |
| Same UI (alias) | `GET /swagger/` |
| OpenAPI JSON | `GET /docs/openapi.json` |
| Root (links + JSON) | `GET /` — browsers get a small HTML page with links; API clients get JSON including `documentationUrl` |

**Regenerate the spec** when you add or change routes / validation schemas:

```bash
npm run openapi:generate
```

The generator is [scripts/generate-openapi.ts](scripts/generate-openapi.ts). Prefer regenerating over editing `openapi.json` by hand.

**Compiled / `dist` builds:** Static files live under `public/swagger`. If you run `node dist/...`, start the process with the **backend directory as the current working directory** (so `public/swagger` resolves), or ensure `swaggerCandidates` in `src/app.ts` can find the folder—paths are probed for `src`, `dist/src`, package root, and monorepo `backend/public/swagger`.

**Optional `swagger-ui-express`:** Not bundled by default; static `/docs` is enough for typical deployments. Add it only if your host cannot serve the `public/swagger` static folder or CDN-based Swagger UI.

---

## Environment Variables Example

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
AI_SERVER_BASE_URL=http://localhost:8000
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

### AI microservice connectivity

The backend calls the FastAPI analytics service (`ai-server`) over HTTP:

- Set **`AI_SERVER_BASE_URL`** to the uvicorn URL (default **`http://localhost:8000`**; see [`.env.example`](.env.example)).
- **`AI_SERVICE_CLIENT_ID`** / **`AI_SERVICE_CLIENT_SECRET`** must match **`SERVICE_CLIENT_ID`** / **`SERVICE_CLIENT_SECRET`** on the AI server ([`ai-server/config.py`](../ai-server/config.py)).

**Automated tests** (mocked HTTP, safe in CI):

```bash
npx jest src/modules/ai/ --no-cache
```

**Manual smoke** with a running AI server and `.env` credentials:

```bash
npx ts-node scripts/check-ai-connection.ts [optionalTenantId]
```

More context: [`docs/TELEMETRY_CROSS_MODULE.md`](docs/TELEMETRY_CROSS_MODULE.md) (telemetry → AI payloads).

---

## Project Structure

- `src/` – Application source code (TypeScript)
- `scripts/` – Migration and seed scripts
- `server.ts` – Main server entry point

---

## Production Notes

- Ensure your build process compiles TypeScript to JavaScript before running in Docker.
- Adjust the Dockerfile CMD to match your compiled output (e.g., `node dist/server.js`).

---

## Project Structure

- `src/app.js`: Express application setup
- `src/routes/`: Route definitions
- `src/controllers/`: Request handlers
- `src/services/`: Business logic
- `src/models/`: Database models (Mongoose)
- `src/middleware/`: Custom middleware
- `src/utils/`: Utility functions
- `src/config/`: Configuration files
- `src/validators/`: Request validation

## Available Endpoints

- `GET /health`: Health check
- `POST /api/v1/auth/register`: Register new user
- `POST /api/v1/auth/login`: User login
- `GET /api/v1/users`: Get all users (authenticated)
- `GET /api/v1/users/:id`: Get user by ID (authenticated)
- `POST /api/v1/users`: Create user (authenticated)
- `PUT /api/v1/users/:id`: Update user (authenticated)
- `DELETE /api/v1/users/:id`: Delete user (authenticated)

## Available Scripts

- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon
- `npm test`: Run tests
- `npm run lint`: Lint code
- `npm run format`: Format code with Prettier

## Development

- Use async/await for asynchronous operations
- Follow RESTful conventions
- Implement proper error handling
- Use middleware for cross-cutting concerns
- Validate all inputs

## Testing

```bash
npm test
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use process manager (PM2) for running the app
3. Set up proper logging
4. Configure CORS properly
5. Use HTTPS
6. Set up monitoring and error tracking


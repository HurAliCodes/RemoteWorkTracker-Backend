# Agent API

Base route: `/api/v1/agent`

## Pairing code (authenticated user)

Employees obtain a one-time code from the mobile app (or any client using a **user** JWT that includes `userId`). Organization-admin tokens cannot call this endpoint.

**POST** `/pairing-code`

Headers: `Authorization: Bearer <user access token>`

Body (optional):

```json
{
  "expiresInMinutes": 10
}
```

Response `200` (flat JSON):

```json
{
  "pairingCode": "ABCD1234",
  "expiresAt": "2026-05-09T12:00:00.000Z",
  "expiresInMinutes": 10
}
```

## Register device

**POST** `/register`

Unauthenticated. Links a workstation to the user who generated the pairing code (or accepts an explicit `userId` for trusted setups).

Body:

```json
{
  "deviceId": "uuid",
  "hostname": "DESKTOP-ABC",
  "os": "windows",
  "pairingCode": "ABCD1234"
}
```

Either `userId` (UUID) **or** `pairingCode` is required.

Response `200`:

```json
{
  "deviceId": "uuid",
  "userId": "uuid",
  "accessToken": "...",
  "refreshToken": "..."
}
```

The device should store tokens and send `Authorization: Bearer <accessToken>` on subsequent telemetry calls.

## Heartbeat

**POST** `/heartbeat`

```json
{
  "deviceId": "uuid",
  "status": "online"
}
```

## Activity logs

**POST** `/activity`

Body:

```json
{
  "activities": [
    {
      "deviceId": "uuid",
      "userId": "uuid",
      "windowTitle": "Window title",
      "app": "Optional app label",
      "startTime": "2026-05-09T12:00:00.000Z",
      "endTime": "2026-05-09T12:00:30.000Z",
      "duration": 30,
      "isIdle": false
    }
  ]
}
```

Alternatively each item may use normalized fields: `action`, `description`, `timestamp` (ISO string).

The server maps agent-style payloads into `activity_logs` (`action` is truncated to 100 characters; extra fields are stored in `description` as JSON).

## Idle

**POST** `/idle`

```json
{
  "deviceId": "uuid",
  "idleDuration": 120
}
```

Either `idleDuration` or `idleTime` (seconds) is required. `userId` is optional; if omitted, the server resolves it from the `devices` row for `deviceId`.

Optional: `timestamp` (ISO string).

## Database

- `devices` — registered machines per user.
- `device_pairing_codes` — short-lived, single-use codes.
- `activity_logs` — user and device keyed activity rows.
- `idle_logs` — idle samples (seconds + timestamp).

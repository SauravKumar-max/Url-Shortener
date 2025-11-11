# URL Shortener

## Installation

Clone the repository:

```bash
git clone https://github.com/SauravKumar-max/Url-Shortener.git
cd Url-Shortener
```

Install dependencies:

```bash
yarn install
```

Generate the Prisma client

```bash
yarn prisma:generate
```

Start the development server:

```bash
yarn dev
```

This will run a server at [http://localhost:7070/](http://localhost:7070/)

## Testing

Run tests:

```bash
yarn test
```

## API Endpoints

### Create a Short URL

**POST** `/shorten`

Request Body:
```json
{
  "url": "https://example.com",
  "expiryDate": "2025-01-01",
  "customCode": "mycode",
  "password": "secret"
}
```

Response:
```json
{ "short_code": "mycode" }
```

---

### Redirect

**GET** `/redirect?code=<short_code>[&password=...]`

- Redirects to the original URL  
- Returns error if:
  - The short code is expired or deleted
  - A password is required and not provided / incorrect

---

### Delete a Short URL

**DELETE** `/shorten/<short_code>`

- Only the owner of the code can delete it  
- Marks the entry as soft-deleted

---

### Update Expiry / Password

**PUT** `/shorten/<short_code>`

Request Body:
```json
{
  "expiryDate": "2025-12-30",
  "password": "newpass"
}
```

---

### List URLs for the User

**GET** `/list`

Returns all active URLs belonging to the user.

---

### Analytics (Latest 10 URLs)

**GET** `/analytics`

Returns the latest 10 non-deleted shortened URLs.

---

### Bulk Shorten (Enterprise Tier Only)

**POST** `/shorten/batch`

Request Body:
```json
{
  "urls": ["https://a.com", "https://b.com"]
}
```

Response:
```json
{
  "urls": [
    { "url": "https://a.com", "short_code": "abc123" },
    { "url": "https://b.com", "short_code": "xyz890" }
  ]
}
```

---

### Health Check

**GET** `/health`

Response:
```json
{ "status": "ok", "server": "running", "database": "connected" }
```

----------------------------------------------------------------------------------------

## Performance

Load test results for 10 concurrent requests:

### /shorten endpoint

| Percentile | Response Time |
|------------|---------------|
| P50        | 19.9293 ms    |
| P90        | 25.8405 ms    |
| P95        | 25.8405 ms    |
| P99        | 25.8405 ms    |

### /redirect endpoint

| Percentile | Response Time |
|------------|---------------|
| P50        | 859.1003 ms   |
| P90        | 954.4932 ms   |
| P95        | 954.4932 ms   |
| P99        | 954.4932 ms   |

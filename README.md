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

### Creating a short code

**POST** `http://localhost:7070/shorten`

Request body:
```json
{
  "url": "https://saurav-kumar.vercel.com"
}
```

### Redirecting using the short code

**GET** `http://localhost:7070/redirect?code=<short_code>`

### Deleting a code

**DELETE** `http://localhost:7070/shorten/<short_code>`

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

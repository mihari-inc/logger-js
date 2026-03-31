# @mihari/browser

Browser client for the mihari log collection library with sendBeacon support.

## Installation

```bash
npm install @mihari/browser
```

## Usage

```typescript
import { BrowserMihari } from "@mihari/browser";

const logger = new BrowserMihari({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

logger.info("Page loaded", { route: "/dashboard" });
```

## Features

- Automatic capture of userAgent, url, and referrer
- Uses `navigator.sendBeacon` for reliable flush on page unload
- Gzip compression via pako

## License

MIT

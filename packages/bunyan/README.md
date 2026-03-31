# @mihari/bunyan

Bunyan stream for the mihari log collection library.

## Installation

```bash
npm install @mihari/bunyan bunyan
```

## Usage

```typescript
import bunyan from "bunyan";
import { MihariBunyanStream } from "@mihari/bunyan";

const mihariStream = new MihariBunyanStream({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

const logger = bunyan.createLogger({
  name: "my-app",
  streams: [{ type: "raw", stream: mihariStream }],
});

logger.info("Hello from bunyan");
```

## Level Mapping

| Bunyan Level | Mihari Level |
|-------------|-------------|
| 10 (trace) | debug |
| 20 (debug) | debug |
| 30 (info) | info |
| 40 (warn) | warn |
| 50 (error) | error |
| 60 (fatal) | fatal |

## License

MIT

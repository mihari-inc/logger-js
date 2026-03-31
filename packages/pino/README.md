# @mihari/pino

Pino transport for the mihari log collection library.

## Installation

```bash
npm install @mihari/pino pino
```

## Usage

```typescript
import pino from "pino";
import { createMihariTransport } from "@mihari/pino";

const transport = createMihariTransport({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

const logger = pino(transport);
logger.info("Hello from pino");
```

## Level Mapping

| Pino Level | Mihari Level |
|------------|-------------|
| 10 (trace) | debug |
| 20 (debug) | debug |
| 30 (info) | info |
| 40 (warn) | warn |
| 50 (error) | error |
| 60 (fatal) | fatal |

## License

MIT

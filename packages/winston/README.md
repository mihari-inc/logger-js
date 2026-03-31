# @mihari/logger-winston

Winston transport for the mihari log collection library.

## Installation

```bash
npm install @mihari/logger-winston winston
```

## Usage

```typescript
import winston from "winston";
import { MihariWinstonTransport } from "@mihari/logger-winston";

const logger = winston.createLogger({
  transports: [
    new MihariWinstonTransport({
      mihariConfig: {
        token: "your-api-token",
        endpoint: "https://logs.example.com",
      },
    }),
  ],
});

logger.info("Hello from winston");
```

## Level Mapping

| Winston Level | Mihari Level |
|--------------|-------------|
| silly, debug | debug |
| verbose, info | info |
| warn, warning | warn |
| error | error |
| crit, emerg, alert | fatal |

## License

MIT

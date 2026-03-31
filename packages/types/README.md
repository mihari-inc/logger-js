# @mihari/types

Shared TypeScript type definitions for the mihari log collection library.

## Installation

```bash
npm install @mihari/types
```

## Exports

- `LogLevel` - Enum: debug, info, warn, error, fatal
- `LogEntry` - Log entry with dt, level, message, and extra metadata
- `MihariConfig` - Configuration for mihari clients
- `TransportOptions` - HTTP transport configuration
- `BatchOptions` - Batching configuration
- `TransportResponse` - Successful API response shape
- `TransportError` - Error API response shape
- `CompressFn` - Compression function signature

## License

MIT

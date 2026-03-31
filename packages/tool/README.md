# @mihari/tool

CLI tool for the mihari log collection library.

## Installation

```bash
npm install -g @mihari/tool
```

## Configuration

Set the following environment variables:

```bash
export MIHARI_TOKEN="your-api-token"
export MIHARI_ENDPOINT="https://logs.example.com"
```

## Usage

### Send a single message

```bash
mihari send "Deployment completed" --level info
mihari send "Error detected" --level error
```

### Stream logs from stdin

```bash
# Pipe from a file
tail -f /var/log/app.log | mihari tail

# Pipe from another command
my-app 2>&1 | mihari tail --level warn

# Pipe from echo
echo "Quick log message" | mihari tail
```

### Options

- `--level <level>` - Log level: debug, info, warn, error, fatal (default: info)
- `--help` - Show help message

## License

MIT

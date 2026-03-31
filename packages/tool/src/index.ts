#!/usr/bin/env node

import * as readline from "readline";
import { MihariClient } from "@mihari/logger-core";
import { LogLevel, MihariConfig } from "@mihari/logger-types";

const USAGE = `
mihari - CLI tool for mihari log collection

Usage:
  mihari send <message> [--level <level>]    Send a single log message
  mihari tail                                 Read stdin line by line and send each as a log

Environment variables:
  MIHARI_TOKEN      Authentication token (required)
  MIHARI_ENDPOINT   API endpoint URL (required)

Options:
  --level <level>   Log level: debug, info, warn, error, fatal (default: info)
  --help            Show this help message

Examples:
  mihari send "Deployment completed" --level info
  echo "Error occurred" | mihari tail
  tail -f /var/log/app.log | mihari tail --level warn
`.trim();

function getConfig(): MihariConfig {
  const token = process.env.MIHARI_TOKEN;
  const endpoint = process.env.MIHARI_ENDPOINT;

  if (!token) {
    console.error("Error: MIHARI_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!endpoint) {
    console.error("Error: MIHARI_ENDPOINT environment variable is required");
    process.exit(1);
  }

  return { token, endpoint };
}

function parseLevel(levelStr: string): LogLevel {
  const normalized = levelStr.toLowerCase();
  const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    warn: LogLevel.Warn,
    error: LogLevel.Error,
    fatal: LogLevel.Fatal,
  };

  const level = levelMap[normalized];
  if (!level) {
    console.error(
      `Error: Invalid log level "${levelStr}". Valid levels: debug, info, warn, error, fatal`
    );
    process.exit(1);
  }

  return level;
}

async function sendCommand(args: readonly string[]): Promise<void> {
  const config = getConfig();
  const client = new MihariClient(config);

  let message = "";
  let level = LogLevel.Info;

  const mutableArgs = [...args];
  while (mutableArgs.length > 0) {
    const arg = mutableArgs.shift()!;
    if (arg === "--level" && mutableArgs.length > 0) {
      level = parseLevel(mutableArgs.shift()!);
    } else if (!message) {
      message = arg;
    }
  }

  if (!message) {
    console.error("Error: Message is required for send command");
    process.exit(1);
  }

  switch (level) {
    case LogLevel.Debug:
      client.debug(message);
      break;
    case LogLevel.Info:
      client.info(message);
      break;
    case LogLevel.Warn:
      client.warn(message);
      break;
    case LogLevel.Error:
      client.error(message);
      break;
    case LogLevel.Fatal:
      client.fatal(message);
      break;
  }

  await client.flush();
  console.log(`Sent: [${level}] ${message}`);
}

async function tailCommand(args: readonly string[]): Promise<void> {
  const config = getConfig();
  const client = new MihariClient(config);

  let level = LogLevel.Info;

  const mutableArgs = [...args];
  while (mutableArgs.length > 0) {
    const arg = mutableArgs.shift()!;
    if (arg === "--level" && mutableArgs.length > 0) {
      level = parseLevel(mutableArgs.shift()!);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  let lineCount = 0;

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    switch (level) {
      case LogLevel.Debug:
        client.debug(trimmed);
        break;
      case LogLevel.Info:
        client.info(trimmed);
        break;
      case LogLevel.Warn:
        client.warn(trimmed);
        break;
      case LogLevel.Error:
        client.error(trimmed);
        break;
      case LogLevel.Fatal:
        client.fatal(trimmed);
        break;
    }

    lineCount++;
  });

  rl.on("close", async () => {
    await client.shutdown();
    console.log(`Sent ${lineCount} log entries`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "send":
      await sendCommand(commandArgs);
      break;
    case "tail":
      await tailCommand(commandArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

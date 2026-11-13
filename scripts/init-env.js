// Creates .env from .env.example on first setup. Never overwrites an existing .env.
// A Node script (not `cp`) so `npm run setup` works the same on Windows, macOS and Linux.
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  console.log('.env already exists, leaving it alone.');
} else {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example.');
}

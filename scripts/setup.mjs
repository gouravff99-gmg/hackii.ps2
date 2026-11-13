// Copies .env.example -> .env if missing. Cross-platform (Windows/macOS/Linux).
import { copyFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  console.log("[setup] .env already exists, leaving it alone.");
} else {
  copyFileSync(".env.example", ".env");
  console.log("[setup] created .env from .env.example");
}
console.log("[setup] next: npm run db:up  &&  npm run db:init  &&  npm run dev");

#!/usr/bin/env node
// Genera el valor para FARMACIA_PASSWORD_HASH (ver .env.example).
//
// Uso:
//   node scripts/generar-hash-clave.mjs "tu-contraseña"

import { randomBytes, scryptSync } from "node:crypto";

const clave = process.argv[2];
if (!clave) {
  console.error("Uso: node scripts/generar-hash-clave.mjs <clave>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(clave, salt, 64);
// ":" y no "$": Next.js expande referencias "$variable" en los .env y
// truncaría el hash silenciosamente si usara "$" como separador.
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);

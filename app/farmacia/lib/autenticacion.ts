import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const NOMBRE_COOKIE_SESION = "farmacia_sesion";
export const DURACION_SESION_MS = 1000 * 60 * 60 * 12; // 12 horas.

interface CargaSesion {
  exp: number;
}

function firmar(payload: string, secreto: string): string {
  return createHmac("sha256", secreto).update(payload).digest("base64url");
}

/** Cookie de sesión: payload.firma, ambos en base64url, firmados con HMAC-SHA256. */
export function crearTokenSesion(
  secreto: string,
  ahora: number = Date.now(),
): string {
  const carga: CargaSesion = { exp: ahora + DURACION_SESION_MS };
  const payload = Buffer.from(JSON.stringify(carga), "utf8").toString(
    "base64url",
  );
  return `${payload}.${firmar(payload, secreto)}`;
}

export function verificarTokenSesion(
  token: string | undefined | null,
  secreto: string,
  ahora: number = Date.now(),
): boolean {
  if (!token) {
    return false;
  }

  const partes = token.split(".");
  if (partes.length !== 2) {
    return false;
  }
  const [payload, firma] = partes;

  const firmaEsperada = firmar(payload, secreto);
  const bufFirma = Buffer.from(firma);
  const bufEsperada = Buffer.from(firmaEsperada);
  if (
    bufFirma.length !== bufEsperada.length ||
    !timingSafeEqual(bufFirma, bufEsperada)
  ) {
    return false;
  }

  try {
    const carga = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as CargaSesion;
    return typeof carga.exp === "number" && ahora < carga.exp;
  } catch {
    return false;
  }
}

const LONGITUD_HASH = 64;

/**
 * Genera un hash en formato "scrypt:saltHex:hashHex" para
 * FARMACIA_PASSWORD_HASH.
 *
 * El separador es ":", no "$": Next.js expande referencias "$variable"
 * dentro de los archivos .env (vía dotenv-expand), así que un "$" en el
 * valor trunca silenciosamente el hash guardado.
 */
export function generarHashClave(clave: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(clave, salt, LONGITUD_HASH);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verificarClave(
  claveIngresada: string,
  hashAlmacenado: string,
): boolean {
  const partes = hashAlmacenado.split(":");
  if (partes.length !== 3 || partes[0] !== "scrypt") {
    return false;
  }
  const [, saltHex, hashHex] = partes;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const hashEsperado = Buffer.from(hashHex, "hex");
    const hashCalculado = scryptSync(claveIngresada, salt, hashEsperado.length);
    return (
      hashCalculado.length === hashEsperado.length &&
      timingSafeEqual(hashCalculado, hashEsperado)
    );
  } catch {
    return false;
  }
}

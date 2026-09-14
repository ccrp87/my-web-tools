import { describe, expect, it } from "vitest";
import {
  crearTokenSesion,
  DURACION_SESION_MS,
  generarHashClave,
  verificarClave,
  verificarTokenSesion,
} from "./autenticacion";

describe("token de sesión", () => {
  it("un token recién creado es válido", () => {
    const token = crearTokenSesion("secreto", 1000);
    expect(verificarTokenSesion(token, "secreto", 1000)).toBe(true);
  });

  it("expira pasada la duración de la sesión", () => {
    const token = crearTokenSesion("secreto", 0);
    expect(verificarTokenSesion(token, "secreto", DURACION_SESION_MS - 1)).toBe(
      true,
    );
    expect(verificarTokenSesion(token, "secreto", DURACION_SESION_MS + 1)).toBe(
      false,
    );
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = crearTokenSesion("secreto-a", 1000);
    expect(verificarTokenSesion(token, "secreto-b", 1000)).toBe(false);
  });

  it("rechaza un token manipulado", () => {
    const token = crearTokenSesion("secreto", 1000);
    const [payload] = token.split(".");
    const cargaFalsa = Buffer.from(
      JSON.stringify({ exp: Number.MAX_SAFE_INTEGER }),
      "utf8",
    ).toString("base64url");
    const tokenManipulado = `${cargaFalsa}.firma-inventada`;
    expect(verificarTokenSesion(tokenManipulado, "secreto", 1000)).toBe(false);
    expect(payload).toBeTruthy();
  });

  it("rechaza tokens vacíos o mal formados", () => {
    expect(verificarTokenSesion(undefined, "secreto")).toBe(false);
    expect(verificarTokenSesion("", "secreto")).toBe(false);
    expect(verificarTokenSesion("sin-punto", "secreto")).toBe(false);
  });
});

describe("hash de contraseña", () => {
  it("un hash generado valida su propia contraseña", () => {
    const hash = generarHashClave("clave-super-secreta");
    expect(verificarClave("clave-super-secreta", hash)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", () => {
    const hash = generarHashClave("clave-super-secreta");
    expect(verificarClave("otra-clave", hash)).toBe(false);
  });

  it("rechaza un hash con formato inválido", () => {
    expect(verificarClave("clave", "no-es-un-hash-valido")).toBe(false);
  });
});

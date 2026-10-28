/**
 * Integración con Google Drive 100% en el navegador (sin backend): OAuth vía
 * Google Identity Services (token client) y selección de archivos vía Google
 * Picker. El scope `drive.file` limita el acceso a los archivos que esta app
 * crea o a los que el usuario elige explícitamente en el Picker.
 */

const DRIVE_FILE_SCOPE: string = "https://www.googleapis.com/auth/drive.file";
const DBML_MIME_TYPE: string = "text/plain";

export interface DrivePickedFile {
  id: string;
  name: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOauth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => GoogleTokenClient;
}

interface GoogleGlobal {
  accounts: { oauth2: GoogleAccountsOauth2 };
  picker: unknown;
}

interface GapiGlobal {
  load: (apiName: string, callback: () => void) => void;
}

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GapiGlobal;
  }
}

const scriptLoadPromises = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const cached = scriptLoadPromises.get(src);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}.`));
    document.head.appendChild(script);
  });

  scriptLoadPromises.set(src, promise);
  return promise;
}

async function ensureGoogleIdentityLoaded(): Promise<void> {
  await loadScriptOnce("https://accounts.google.com/gsi/client");
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services no está disponible.");
  }
}

let pickerApiLoadPromise: Promise<void> | null = null;

async function ensureGooglePickerLoaded(): Promise<void> {
  await loadScriptOnce("https://apis.google.com/js/api.js");
  if (!pickerApiLoadPromise) {
    pickerApiLoadPromise = new Promise<void>((resolve, reject) => {
      if (!window.gapi) {
        reject(new Error("La librería de Google (gapi) no está disponible."));
        return;
      }
      window.gapi.load("picker", () => resolve());
    });
  }
  await pickerApiLoadPromise;
}

export function getGoogleOAuthClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID en las variables de entorno.",
    );
  }
  return clientId;
}

export function getGooglePickerApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY_GOOGLE_DRIVE;
  if (!apiKey) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_API_KEY_GOOGLE_DRIVE en las variables de entorno.",
    );
  }
  return apiKey;
}

let cachedAccessToken: string | null = null;

/**
 * Pide un token de acceso de Google con el scope `drive.file`. Reutiliza el
 * token de la sesión del navegador mientras sea válido; si una llamada a la
 * API falla por 401, el código debe limpiar `cachedAccessToken` y reintentar.
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;

  await ensureGoogleIdentityLoaded();
  const clientId = getGoogleOAuthClientId();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("No se pudo autorizar el acceso a Google Drive."));
          return;
        }
        cachedAccessToken = response.access_token;
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error?.message ?? "No se pudo autorizar el acceso a Google Drive.",
          ),
        );
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function clearGoogleDriveAccessToken(): void {
  cachedAccessToken = null;
}

/** Crea un archivo nuevo en Drive y devuelve su id/nombre para poder actualizarlo después. */
export async function createDbmlFileInDrive(
  accessToken: string,
  fileName: string,
  content: string,
): Promise<DrivePickedFile> {
  const boundary: string = "-------dbml-drive-upload-boundary";
  const metadata = { name: fileName, mimeType: DBML_MIME_TYPE };
  const body: string =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${DBML_MIME_TYPE}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo guardar el diagrama en Google Drive.");
  }
  return (await response.json()) as DrivePickedFile;
}

/** Sobrescribe el contenido de un archivo de Drive ya existente (mismo id, sin crear uno nuevo). */
export async function updateDbmlFileInDrive(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": DBML_MIME_TYPE,
      },
      body: content,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo actualizar el diagrama en Google Drive.");
  }
}

/** Abre el selector de archivos de Google; resuelve `null` si el usuario cancela. */
export async function openGoogleDrivePicker(
  accessToken: string,
): Promise<DrivePickedFile | null> {
  await ensureGooglePickerLoaded();
  const apiKey = getGooglePickerApiKey();

  interface PickerResponseDoc {
    id: string;
    name: string;
  }
  interface PickerResponse {
    action: string;
    docs?: PickerResponseDoc[];
  }
  interface PickerBuilderInstance {
    addView: (view: unknown) => PickerBuilderInstance;
    setOAuthToken: (token: string) => PickerBuilderInstance;
    setDeveloperKey: (key: string) => PickerBuilderInstance;
    setAppId: (appId: string) => PickerBuilderInstance;
    setCallback: (callback: (data: PickerResponse) => void) => PickerBuilderInstance;
    build: () => { setVisible: (visible: boolean) => void };
  }

  const google = window.google as unknown as {
    picker: {
      PickerBuilder: new () => PickerBuilderInstance;
      DocsView: new () => { setMimeTypes: (mimeTypes: string) => unknown };
      Action: { PICKED: string; CANCEL: string };
    };
  };

  // El project number (prefijo numérico del Client ID, antes del guion) es
  // obligatorio para que el Picker conceda acceso real al archivo elegido
  // bajo el scope `drive.file`; sin él, el archivo se ve y se selecciona
  // pero la descarga posterior falla con 403.
  const projectNumber: string = getGoogleOAuthClientId().split("-")[0];

  return new Promise<DrivePickedFile | null>((resolve, reject) => {
    try {
      const view = new google.picker.DocsView().setMimeTypes(
        "text/plain,text/x-sql,application/octet-stream",
      );
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(projectNumber)
        .setCallback((data: PickerResponse) => {
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            resolve({ id: data.docs[0].id, name: data.docs[0].name });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch {
      reject(new Error("No se pudo abrir el selector de archivos de Google Drive."));
    }
  });
}

export async function downloadDriveFileContent(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo desde Google Drive.");
  }
  return response.text();
}

const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

loadDotEnv(path.join(ROOT, ".env.local"));
loadDotEnv(path.join(ROOT, ".env"));

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
};

function loadDotEnv(filePath) {
    if (!fs.existsSync(filePath)) return;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = value;
    }
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(data));
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                request.destroy();
                reject(new Error("Payload troppo grande."));
            }
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error("JSON non valido."));
            }
        });
        request.on("error", reject);
    });
}

function googleApiKey(request) {
    return request.headers["x-google-tts-api-key"]
        || process.env.GOOGLE_TTS_API_KEY
        || process.env.GOOGLE_API_KEY;
}

function googleErrorMessage(data, fallback) {
    return data?.error?.message || fallback;
}

async function googleFetch(request, url, options = {}) {
    const key = googleApiKey(request);
    if (!key) {
        return {
            ok: false,
            status: 500,
            json: async () => ({ error: { message: "Inserisci e salva la chiave API Google nella pagina." } }),
        };
    }

    const separator = url.includes("?") ? "&" : "?";
    return fetch(`${url}${separator}key=${encodeURIComponent(key)}`, options);
}

async function handleVoices(request, response, url) {
    const languageCode = url.searchParams.get("languageCode") || "it-IT";
    const googleResponse = await googleFetch(
        request,
        `https://texttospeech.googleapis.com/v1/voices?languageCode=${encodeURIComponent(languageCode)}`,
    );
    const data = await googleResponse.json();

    if (!googleResponse.ok) {
        sendJson(response, googleResponse.status, {
            error: googleErrorMessage(data, "Impossibile leggere le voci Google."),
        });
        return;
    }

    sendJson(response, 200, data);
}

async function handleSynthesize(request, response) {
    const body = await readJson(request);
    const text = String(body.text || "").trim();
    const voiceName = String(body.voiceName || "it-IT-Chirp3-HD-Aoede");
    const languageCode = String(body.languageCode || "it-IT");
    const audioEncoding = ["MP3", "LINEAR16"].includes(body.audioEncoding) ? body.audioEncoding : "MP3";

    if (!text) {
        sendJson(response, 400, { error: "Il testo è obbligatorio." });
        return;
    }

    if (text.length > 5000) {
        sendJson(response, 400, { error: "Il testo supera il limite di 5000 caratteri." });
        return;
    }

    const requestBody = {
        input: { text },
        voice: {
            languageCode,
            name: voiceName,
            ssmlGender: body.ssmlGender || "NEUTRAL",
        },
        audioConfig: { audioEncoding },
    };

    const googleResponse = await googleFetch(request, "https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
    const data = await googleResponse.json();

    if (!googleResponse.ok) {
        sendJson(response, googleResponse.status, {
            error: googleErrorMessage(data, "Errore durante la richiesta a Google Text-to-Speech."),
        });
        return;
    }

    sendJson(response, 200, { audioContent: data.audioContent });
}

function serveStatic(response, pathname) {
    const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
    const filePath = path.normalize(path.join(ROOT, safePath));

    if (!filePath.startsWith(ROOT)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, { "Content-Type": type });
        response.end(content);
    });
}

async function requestHandler(request, response) {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);

        if (request.method === "GET" && url.pathname === "/api/voices") {
            await handleVoices(request, response, url);
            return;
        }

        if (request.method === "POST" && url.pathname === "/api/synthesize") {
            await handleSynthesize(request, response);
            return;
        }

        if (request.method === "GET") {
            serveStatic(response, url.pathname);
            return;
        }

        sendJson(response, 405, { error: "Metodo non supportato." });
    } catch (error) {
        sendJson(response, 500, { error: error.message || "Errore interno." });
    }
}

if (process.env.VERCEL) {
    module.exports = requestHandler;
} else {
    const server = http.createServer(requestHandler);

    server.listen(PORT, () => {
        console.log(`SegreteriaVocale pronta su http://localhost:${PORT}`);
    });
}

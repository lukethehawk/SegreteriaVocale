const state = {
    audioContext: null,
    musicBuffer: null,
    currentObjectUrl: null,
    isBusy: false,
    voices: [],
    filteredVoices: [],
    totalCharacterCount: Number(localStorage.getItem("segvocale.charCount") || 0),
};

const nodes = {
    form: document.getElementById("voiceForm"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    saveApiKeyButton: document.getElementById("saveApiKeyButton"),
    clearApiKeyButton: document.getElementById("clearApiKeyButton"),
    textInput: document.getElementById("textInput"),
    voiceTypeFilter: document.getElementById("voiceTypeFilter"),
    voiceSelect: document.getElementById("voiceSelect"),
    encodingSelect: document.getElementById("encodingSelect"),
    musicUpload: document.getElementById("musicUpload"),
    musicVolume: document.getElementById("musicVolume"),
    musicVolumeValue: document.getElementById("musicVolumeValue"),
    previewButton: document.getElementById("previewButton"),
    generateButton: document.getElementById("generateButton"),
    audioPlayer: document.getElementById("audioPlayer"),
    downloadButton: document.getElementById("downloadButton"),
    statusBox: document.getElementById("statusBox"),
    charCounter: document.getElementById("charCounter"),
    usageCounter: document.getElementById("usageCounter"),
    themeToggle: document.getElementById("themeToggle"),
    voiceDetails: document.getElementById("voiceDetails"),
};

const API_KEY_STORAGE = "segvocale.googleApiKey";

function setStatus(message, isError = false) {
    nodes.statusBox.textContent = message;
    nodes.statusBox.classList.toggle("error", isError);
}

function setBusy(isBusy) {
    state.isBusy = isBusy;
    nodes.generateButton.disabled = isBusy;
    nodes.previewButton.disabled = isBusy;
}

function currentApiKey() {
    return (localStorage.getItem(API_KEY_STORAGE) || "").trim();
}

function apiHeaders(extra = {}) {
    const apiKey = currentApiKey();
    return apiKey ? { ...extra, "X-Google-TTS-API-Key": apiKey } : extra;
}

function syncApiKeyInput() {
    const apiKey = currentApiKey();
    nodes.apiKeyInput.value = apiKey;
    nodes.clearApiKeyButton.disabled = !apiKey;
}

function updateCounters() {
    nodes.charCounter.textContent = `Caratteri: ${nodes.textInput.value.length}`;
    nodes.usageCounter.textContent = `Inviati: ${state.totalCharacterCount}`;
}

function saveUsage(count) {
    state.totalCharacterCount += count;
    localStorage.setItem("segvocale.charCount", String(state.totalCharacterCount));
    updateCounters();
}

function getAudioContext() {
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioContext;
}

function selectedVoice() {
    return state.voices.find((voice) => voice.name === nodes.voiceSelect.value);
}

function voiceType(name) {
    if (name.includes("Chirp3-HD")) return "Chirp 3 HD";
    if (name.includes("Chirp-HD")) return "Chirp HD";
    if (name.includes("Neural2")) return "Neural2";
    if (name.includes("Wavenet")) return "Wavenet";
    if (name.includes("Studio")) return "Studio";
    return "Standard";
}

function voiceLabel(voice) {
    const gender = voice.ssmlGender === "SSML_VOICE_GENDER_UNSPECIFIED" ? "" : ` - ${voice.ssmlGender}`;
    return `${voice.name}${gender}`;
}

function renderVoiceDetails() {
    const voice = selectedVoice();
    if (!voice) {
        nodes.voiceDetails.textContent = "";
        return;
    }

    nodes.voiceDetails.textContent = [
        `Voce: ${voice.name}`,
        `Lingue: ${voice.languageCodes.join(", ")}`,
        `Tipo: ${voiceType(voice.name)}`,
        `Hz nativi: ${voice.naturalSampleRateHertz}`,
    ].join(" | ");
}

function sortVoices(voices) {
    const order = ["Chirp 3 HD", "Chirp HD", "Neural2", "Wavenet", "Studio", "Standard"];
    return voices.sort((a, b) => {
        const typeDiff = order.indexOf(voiceType(a.name)) - order.indexOf(voiceType(b.name));
        return typeDiff || a.name.localeCompare(b.name);
    });
}

function groupedVoices(voices) {
    return voices.reduce((groups, voice) => {
        const type = voiceType(voice.name);
        if (!groups[type]) groups[type] = [];
        groups[type].push(voice);
        return groups;
    }, {});
}

function renderVoiceOptions() {
    const selectedType = nodes.voiceTypeFilter.value;
    state.filteredVoices = selectedType === "all"
        ? state.voices
        : state.voices.filter((voice) => voiceType(voice.name) === selectedType);

    nodes.voiceSelect.innerHTML = "";

    const groups = groupedVoices(state.filteredVoices);
    for (const [type, voices] of Object.entries(groups)) {
        const group = document.createElement("optgroup");
        group.label = `${type} (${voices.length})`;

        for (const voice of voices) {
            const option = document.createElement("option");
            option.value = voice.name;
            option.textContent = voiceLabel(voice);
            group.appendChild(option);
        }

        nodes.voiceSelect.appendChild(group);
    }

    const preferred = state.filteredVoices.find((voice) => voice.name === "it-IT-Chirp3-HD-Aoede")
        || state.filteredVoices.find((voice) => voice.name.includes("Chirp3-HD"))
        || state.filteredVoices[0];

    if (preferred) {
        nodes.voiceSelect.value = preferred.name;
        nodes.voiceSelect.disabled = false;
    } else {
        nodes.voiceSelect.innerHTML = "<option value=\"\">Nessuna voce per questo filtro</option>";
        nodes.voiceSelect.disabled = true;
    }

    renderVoiceDetails();
}

function renderVoices(voices) {
    state.voices = sortVoices(voices);
    renderVoiceOptions();
}

async function loadVoices() {
    if (!currentApiKey()) {
        nodes.voiceSelect.innerHTML = "<option value=\"\">Salva la chiave API per caricare le voci</option>";
        nodes.voiceSelect.disabled = true;
        setStatus("Inserisci e salva la chiave API Google per caricare tutte le voci disponibili.");
        return;
    }

    try {
        setStatus("Carico le voci italiane da Google Text-to-Speech...");
        const response = await fetch("/api/voices?languageCode=it-IT", {
            headers: apiHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Impossibile caricare le voci.");
        }

        renderVoices(data.voices || []);
        setStatus(`Pronto. Voci disponibili: ${state.voices.length}.`);
    } catch (error) {
        setStatus(error.message, true);
        nodes.voiceSelect.innerHTML = "<option value=\"\">Voci non caricate</option>";
        nodes.voiceSelect.disabled = true;
    }
}

async function synthesize(text, overrides = {}) {
    const voice = selectedVoice();
    const request = {
        text,
        languageCode: "it-IT",
        voiceName: nodes.voiceSelect.value,
        ssmlGender: voice?.ssmlGender || "NEUTRAL",
        audioEncoding: overrides.audioEncoding || nodes.encodingSelect.value,
    };

    const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(request),
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Errore durante la sintesi vocale.");
    }

    return data.audioContent;
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function decodeAudio(base64Audio) {
    const context = getAudioContext();
    return context.decodeAudioData(base64ToArrayBuffer(base64Audio));
}

async function loadMusicFile(file) {
    if (!file) {
        state.musicBuffer = null;
        return;
    }

    try {
        const context = getAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        state.musicBuffer = await context.decodeAudioData(arrayBuffer);
        setStatus(`Musica caricata: ${file.name}.`);
    } catch (error) {
        state.musicBuffer = null;
        nodes.musicUpload.value = "";
        setStatus("Il file audio di sottofondo non può essere letto.", true);
    }
}

async function mixAudios(voiceBuffer, musicBuffer) {
    const duration = voiceBuffer.duration;
    const sampleRate = voiceBuffer.sampleRate || 44100;
    const channels = Math.max(1, voiceBuffer.numberOfChannels);
    const context = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

    const voiceSource = context.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    voiceSource.connect(context.destination);

    const musicSource = context.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;

    const musicGain = context.createGain();
    musicGain.gain.value = Number(nodes.musicVolume.value);

    musicSource.connect(musicGain).connect(context.destination);
    voiceSource.start(0);
    musicSource.start(0);

    return context.startRendering();
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;
    let position = 0;

    const setUint16 = (data) => {
        view.setUint16(position, data, true);
        position += 2;
    };

    const setUint32 = (data) => {
        view.setUint32(position, data, true);
        position += 4;
    };

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numChannels);
    setUint16(numChannels * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - position - 4);

    for (let i = 0; i < numChannels; i += 1) {
        channels.push(buffer.getChannelData(i));
    }

    while (position < length) {
        for (let i = 0; i < numChannels; i += 1) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset] || 0));
            sample = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(position, sample, true);
            position += 2;
        }
        offset += 1;
    }

    return new Blob([view], { type: "audio/wav" });
}

function publishAudio(blob) {
    if (state.currentObjectUrl) {
        URL.revokeObjectURL(state.currentObjectUrl);
    }

    state.currentObjectUrl = URL.createObjectURL(blob);
    nodes.audioPlayer.src = state.currentObjectUrl;
    nodes.audioPlayer.style.display = "block";
    nodes.downloadButton.href = state.currentObjectUrl;
    nodes.downloadButton.style.display = "inline-flex";
}

async function generateAudio(event) {
    event.preventDefault();

    if (state.isBusy) return;

    const text = nodes.textInput.value.trim();
    if (!currentApiKey()) {
        setStatus("Salva prima la chiave API Google.", true);
        return;
    }

    if (!text) {
        setStatus("Inserisci un testo prima di generare l'audio.", true);
        return;
    }

    try {
        setBusy(true);
        setStatus("Genero la voce con Google Text-to-Speech...");
        const base64Audio = await synthesize(text);
        const voiceBuffer = await decodeAudio(base64Audio);
        const finalBuffer = state.musicBuffer
            ? await mixAudios(voiceBuffer, state.musicBuffer)
            : voiceBuffer;
        publishAudio(audioBufferToWav(finalBuffer));
        saveUsage(text.length);
        setStatus("Audio generato. Puoi ascoltarlo o scaricarlo in WAV.");
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        setBusy(false);
    }
}

async function previewVoice() {
    if (state.isBusy) return;
    if (!currentApiKey()) {
        setStatus("Salva prima la chiave API Google.", true);
        return;
    }

    try {
        setBusy(true);
        setStatus("Genero anteprima voce...");
        const base64Audio = await synthesize("Benvenuto in SegreteriaVocale.", { audioEncoding: "MP3" });
        const blob = new Blob([base64ToArrayBuffer(base64Audio)], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
        await audio.play();
        setStatus("Anteprima in riproduzione.");
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        setBusy(false);
    }
}

function applyTheme() {
    const isDark = localStorage.getItem("segvocale.theme") === "dark";
    document.body.classList.toggle("dark", isDark);
    nodes.themeToggle.firstElementChild.textContent = isDark ? "☾" : "☀";
}

function initEvents() {
    nodes.form.addEventListener("submit", generateAudio);
    nodes.saveApiKeyButton.addEventListener("click", () => {
        const value = nodes.apiKeyInput.value.trim();
        if (!value) {
            setStatus("Inserisci una chiave API valida.", true);
            return;
        }

        localStorage.setItem(API_KEY_STORAGE, value);
        syncApiKeyInput();
        setStatus("Chiave API salvata nel browser.");
        loadVoices();
    });
    nodes.clearApiKeyButton.addEventListener("click", () => {
        localStorage.removeItem(API_KEY_STORAGE);
        syncApiKeyInput();
        state.voices = [];
        nodes.voiceSelect.innerHTML = "<option value=\"\">Salva la chiave API per caricare le voci</option>";
        nodes.voiceSelect.disabled = true;
        setStatus("Chiave API rimossa dal browser.");
    });
    nodes.textInput.addEventListener("input", updateCounters);
    nodes.voiceSelect.addEventListener("change", renderVoiceDetails);
    nodes.voiceTypeFilter.addEventListener("change", renderVoiceOptions);
    nodes.previewButton.addEventListener("click", previewVoice);
    nodes.musicUpload.addEventListener("change", (event) => loadMusicFile(event.target.files[0]));
    nodes.musicVolume.addEventListener("input", () => {
        nodes.musicVolumeValue.textContent = `${Math.round(Number(nodes.musicVolume.value) * 100)}%`;
    });
    nodes.themeToggle.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
        localStorage.setItem("segvocale.theme", nextTheme);
        applyTheme();
    });
}

applyTheme();
syncApiKeyInput();
initEvents();
updateCounters();
loadVoices();

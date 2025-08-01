// scripts/managers/sound_manager.js

window.SoundManager = class SoundManager {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.synth = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            await Tone.start();
            this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
            this.isInitialized = true;
            console.log("SoundManager initialized successfully.");
        } catch (e) {
            console.error("SoundManager initialization failed:", e);
            this.isInitialized = false;
        }
    }

    getSynth() {
        if (!this.isInitialized) {
            this.initialize();
        }
        return this.synth;
    }

    beep() {
        if (!this.isInitialized || !this.synth) {
            console.error("SoundManager not initialized. Cannot play beep.");
            return;
        }
        try {
            this.synth.triggerAttackRelease("G5", "32n", Tone.now());
        } catch (e) {
            console.error("Error playing beep:", e);
        }
    }

    playNote(notes, duration) {
        if (!this.isInitialized || !this.synth) {
            console.error("SoundManager not initialized. Cannot play note.");
            return;
        }
        try {
            const now = Tone.now();
            this.synth.triggerAttackRelease(notes, duration, now);
        } catch (e) {
            console.error(`Error playing note(s): ${notes}`, e);
        }
    }
};
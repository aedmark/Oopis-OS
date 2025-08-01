// scripts/commands/mxml2sh.js

window.Mxml2shCommand = class Mxml2shCommand extends Command {
    constructor() {
        super({
            commandName: "mxml2sh",
            description: "Converts a MusicXML (.musicxml or .mxl) file into a runnable OopisOS script.",
            helpText: `Usage: mxml2sh <inputfile> [output.sh]
      Converts a MusicXML file into an oopis script that uses the 'play' command.

      DESCRIPTION
      This utility converts standardized MusicXML files (.musicxml) or their 
      compressed counterparts (.mxl) into executable scripts. It parses notes, 
      durations, and rests to generate a sequence of 'play' and 'delay' commands.

      If an output file is not specified, it will be named based on the input file.`,
            completionType: "paths",
            validations: {
                args: { min: 1, max: 2, error: "Usage: mxml2sh <inputfile> [output.sh]" },
                paths: [{ argIndex: 0, options: { expectedType: 'file', permissions: ['read'] } }]
            },
        });
    }

    async coreLogic(context) {
        const { args, validatedPaths, dependencies } = context;
        const { ErrorHandler, Utils, FileSystemManager, UserManager, CommandExecutor, OutputManager } = dependencies;

        const inputFileNode = validatedPaths[0].node;
        const inputFilePath = validatedPaths[0].resolvedPath;
        const extension = Utils.getFileExtension(inputFilePath);

        if (!['musicxml', 'mxl', 'xml'].includes(extension)) {
            return ErrorHandler.createError("mxml2sh: Input file must be a .musicxml, .xml, or .mxl file.");
        }

        const outputFilePath = args.length === 2 ? args[1] : inputFilePath.replace(/\.(musicxml|mxl|xml)$/, '.sh');

        try {
            await OutputManager.appendToOutput("Converting MusicXML to script...");
            
            let xmlContent = inputFileNode.content;
            if (extension === 'mxl') {
                await OutputManager.appendToOutput("Decompressing .mxl file...");
                const JSZip = window.JSZip;
                const zip = await JSZip.loadAsync(xmlContent);
                const mainXmlFile = Object.keys(zip.files).find(name => 
                    !name.startsWith('META-INF') && (name.endsWith('.musicxml') || name.endsWith('.xml'))
                );
                if (!mainXmlFile) throw new Error("No valid .musicxml file found in archive");
                xmlContent = await zip.file(mainXmlFile).async("string");
            }

            const { notes, divisions } = this._parseMusicXML(xmlContent);
            if (notes.length === 0) throw new Error("No notes found in file");

            const scriptContent = this._generateScript(notes, divisions);
            const absOutputPath = FileSystemManager.getAbsolutePath(outputFilePath);
            
            const saveResult = await FileSystemManager.createOrUpdateFile(absOutputPath, scriptContent, {
                currentUser: UserManager.getCurrentUser().name,
                primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name)
            });

            if (!saveResult.success) throw new Error(saveResult.error);
            await FileSystemManager.save();
            await CommandExecutor.processSingleCommand(`chmod 755 "${absOutputPath}"`, { isInteractive: false });

            return ErrorHandler.createSuccess(`Script saved to ${absOutputPath}`);
        } catch (error) {
            return ErrorHandler.createError(`mxml2sh: ${error.message}`);
        }
    }

    _parseMusicXML(xmlString) {
        const notes = [];
        let divisions = 1;

        const divisionsMatch = xmlString.match(/<divisions>(\d+)<\/divisions>/);
        if (divisionsMatch) divisions = parseInt(divisionsMatch[1], 10);

        const noteRegex = /<note[^>]*>([\s\S]*?)<\/note>/g;
        let match;
        while ((match = noteRegex.exec(xmlString)) !== null) {
            const noteData = match[1];
            const isRest = /<rest\/>/.test(noteData);
            const durationMatch = noteData.match(/<duration>(\d+)<\/duration>/);
            const duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;
            const isChord = /<chord\/>/.test(noteData);

            if (isRest) {
                notes.push({ type: 'rest', duration });
            } else {
                const stepMatch = noteData.match(/<step>([A-G])<\/step>/);
                const alterMatch = noteData.match(/<alter>(-1|1)<\/alter>/);
                const octaveMatch = noteData.match(/<octave>(\d+)<\/octave>/);

                if (stepMatch && octaveMatch) {
                    let noteName = stepMatch[1];
                    if (alterMatch) noteName += alterMatch[1] === '1' ? '#' : 'b';
                    notes.push({ type: 'note', pitch: `${noteName}${octaveMatch[1]}`, duration, isChord });
                }
            }
        }
        return { notes, divisions };
    }

    _generateScript(notes, divisions) {
        const lines = ["#!/bin/oopis_shell", "# Converted from MusicXML by mxml2sh"];
        let i = 0;

        while (i < notes.length) {
            const note = notes[i];
            const toneDuration = this._durationToToneJS(note.duration, divisions);

            if (note.type === 'rest') {
                const ms = Math.round(new Tone.Time(toneDuration).toSeconds() * 1000);
                lines.push(`delay ${ms}`);
                i++;
                continue;
            }

            const chordPitches = [note.pitch];
            let lookahead = i + 1;
            while (lookahead < notes.length && notes[lookahead].isChord) {
                chordPitches.push(notes[lookahead].pitch);
                lookahead++;
            }

            const notesArg = chordPitches.length > 1 ? `"${chordPitches.join(' ')}"` : chordPitches[0];
            lines.push(`play ${notesArg} ${toneDuration}`);
            i = lookahead;
        }
        return lines.join('\n');
    }

    _durationToToneJS(duration, divisions) {
        const quarterNote = duration / divisions;
        if (quarterNote >= 4) return "1n";
        if (quarterNote >= 2) return "2n";
        if (quarterNote >= 1) return "4n";
        if (quarterNote >= 0.5) return "8n";
        if (quarterNote >= 0.25) return "16n";
        if (quarterNote >= 0.125) return "32n";
        return "64n";
    }
}

window.CommandRegistry.register(new Mxml2shCommand());

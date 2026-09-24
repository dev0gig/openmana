package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.smoke.ScriptedHuman;
import org.openmana.engine.smoke.SmokeDecks;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Plays the human-vs-AI smoke match on the JVM with the scripted human and
 * writes its input transcript. The Wasm tests replay exactly these inputs
 * through the browser's SharedArrayBuffer channel and must reach the same end.
 *
 * <pre>
 * java -cp openmana-engine-jvm.jar org.openmana.engine.jvm.JvmHumanMatchMain \
 *      --bundle forge-res.bin --seed 42 --out transcript.json [--card-loading lazy|eager] [--language en-US|de-DE]
 *      [--concede-in-turn N | --defending] [--messages messages.jsonl]
 * </pre>
 * With {@code --messages} every message the bridge emits is written as one
 * JSON line, so the protocol tests can validate the JVM's output against the
 * schema (engine/protocol) exactly like the Wasm output.
 * With {@code --concede-in-turn} the scripted player concedes at its first
 * input from that turn on; with {@code --defending} it never attacks and
 * blocks where Forge lets it ({@link ScriptedHuman#defending()}).
 */
public final class JvmHumanMatchMain {

    private JvmHumanMatchMain() {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        String out = null;
        long seed = 42;
        ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.DEFAULT;
        ForgeEngine.Language language = ForgeEngine.Language.EN_US;
        int concedeInTurn = 0;
        boolean defending = false;
        String messages = null;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--seed" -> seed = Long.parseLong(args[++i]);
                case "--out" -> out = args[++i];
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                case "--language" -> language = ForgeEngine.Language.parse(args[++i]);
                case "--concede-in-turn" -> concedeInTurn = Integer.parseInt(args[++i]);
                case "--defending" -> defending = true;
                case "--messages" -> messages = args[++i];
                default -> throw new IllegalArgumentException("unknown argument " + args[i]);
            }
        }
        if (bundle == null || out == null) {
            throw new IllegalArgumentException("--bundle <forge-res.bin> and --out <transcript.json> are required");
        }
        final Path root = TempRoot.create();
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            EngineBoot.boot(in, root, cardLoading, language);
        }
        final JsonObject request = SmokeDecks.humanMatchRequest(seed);
        if (defending && concedeInTurn > 0) {
            throw new IllegalArgumentException("--defending and --concede-in-turn exclude each other");
        }
        final ScriptedHuman human = defending ? ScriptedHuman.defending()
                : concedeInTurn > 0 ? ScriptedHuman.concedingInTurn(concedeInTurn) : new ScriptedHuman();
        final JsonObject result;
        if (messages == null) {
            result = HumanMatch.play(human, request);
        } else {
            try (BufferedWriter log = Files.newBufferedWriter(Paths.get(messages), StandardCharsets.UTF_8)) {
                result = HumanMatch.play(recording(human, log), request);
            }
        }
        final JsonObject transcript = human.transcript(request, result);
        Files.writeString(Paths.get(out), new GsonBuilder().setPrettyPrinting().serializeNulls().create().toJson(transcript),
                StandardCharsets.UTF_8);
        System.out.println(JvmSmokeMain.RESULT_PREFIX + new GsonBuilder().serializeNulls().create().toJson(result));
        System.exit(0);
    }

    /** Passes everything through to the player and writes each emitted message as one JSON line. */
    private static EngineHost recording(final EngineHost player, final BufferedWriter out) {
        return new EngineHost() {
            @Override
            public void emit(final JsonObject message) {
                try {
                    out.write(message.toString());
                    out.write('\n');
                } catch (final IOException e) {
                    throw new UncheckedIOException(e);
                }
                player.emit(message);
            }

            @Override
            public JsonObject awaitInput() {
                return player.awaitInput();
            }
        };
    }
}

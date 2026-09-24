package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.bridge.EngineHost;
import org.openmana.engine.bridge.HumanMatch;
import org.openmana.engine.smoke.ScriptedHuman;
import org.openmana.engine.smoke.SmokeDecks;
import org.openmana.engine.trace.EngineTrace;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;

/**
 * Plays a human-vs-AI match on the JVM with the scripted human and writes its
 * input transcript: the reference side of the JVM/Wasm differential tests.
 * The Wasm tests replay exactly these inputs through the browser's
 * SharedArrayBuffer queue and must produce the same engine trace.
 *
 * <pre>
 * java -cp openmana-engine-jvm.jar org.openmana.engine.jvm.JvmHumanMatchMain \
 *      --bundle forge-res.bin --scenario scenario.json --out transcript.json [--messages messages.jsonl]
 * java -cp openmana-engine-jvm.jar org.openmana.engine.jvm.JvmHumanMatchMain \
 *      --bundle forge-res.bin --seed 42 --out transcript.json [--card-loading lazy|eager] [--language en-US|de-DE]
 *      [--concede-in-turn N | --defending] [--trace] [--messages messages.jsonl]
 * </pre>
 * A scenario is a differential test fixture resolved by
 * engine/wasm/test/fixtures.ts ({@code openmana-scenario/1}: match request,
 * player policy, engine language and card loading); its match asks for the
 * engine trace, which goes into the transcript ({@code trace}). Without a
 * scenario the classic smoke match of {@link SmokeDecks} is played (e.g. for
 * the tracing agent, engine/scripts/record-agent-config.sh); {@code --trace}
 * asks for the engine trace there too.
 * With {@code --messages} every message the bridge emits (trace entries
 * included) is written as one JSON line, so the protocol tests can validate
 * the JVM's output against the schema exactly like the Wasm output.
 */
public final class JvmHumanMatchMain {

    /** Resolved differential test fixture, written by engine/wasm/test/fixtures.ts. */
    public static final String SCENARIO_FORMAT = "openmana-scenario/1";

    private JvmHumanMatchMain() {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        String out = null;
        String scenarioFile = null;
        Long seed = null;
        ForgeEngine.CardLoading cardLoading = null;
        ForgeEngine.Language language = null;
        int concedeInTurn = 0;
        boolean defending = false;
        boolean trace = false;
        String messages = null;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--scenario" -> scenarioFile = args[++i];
                case "--seed" -> seed = Long.parseLong(args[++i]);
                case "--out" -> out = args[++i];
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                case "--language" -> language = ForgeEngine.Language.parse(args[++i]);
                case "--concede-in-turn" -> concedeInTurn = Integer.parseInt(args[++i]);
                case "--defending" -> defending = true;
                case "--trace" -> trace = true;
                case "--messages" -> messages = args[++i];
                default -> throw new IllegalArgumentException("unknown argument " + args[i]);
            }
        }
        if (bundle == null || out == null) {
            throw new IllegalArgumentException("--bundle <forge-res.bin> and --out <transcript.json> are required");
        }

        final JsonObject request;
        final ScriptedHuman human;
        final JsonObject engine = new JsonObject();
        String name = null;
        if (scenarioFile != null) {
            if (seed != null || cardLoading != null || language != null || concedeInTurn > 0 || defending || trace) {
                throw new IllegalArgumentException("--scenario carries match, player and engine settings; do not combine it with other options");
            }
            final JsonObject scenario = JsonParser.parseString(Files.readString(Paths.get(scenarioFile), StandardCharsets.UTF_8)).getAsJsonObject();
            if (!scenario.has("format") || !SCENARIO_FORMAT.equals(scenario.get("format").getAsString())) {
                throw new IllegalArgumentException(scenarioFile + " is not a scenario of format " + SCENARIO_FORMAT);
            }
            for (final String field : scenario.keySet()) {
                if (!Set.of("format", "name", "engine", "player", "match").contains(field)) {
                    throw new IllegalArgumentException("unknown scenario field '" + field + "'");
                }
            }
            name = scenario.get("name").getAsString();
            final JsonObject engineSettings = scenario.getAsJsonObject("engine");
            language = ForgeEngine.Language.parse(engineSettings.get("language").getAsString());
            cardLoading = ForgeEngine.CardLoading.parse(engineSettings.get("cardLoading").getAsString());
            request = scenario.getAsJsonObject("match");
            human = ScriptedHuman.fromPolicy(scenario.getAsJsonObject("player"));
        } else {
            if (defending && concedeInTurn > 0) {
                throw new IllegalArgumentException("--defending and --concede-in-turn exclude each other");
            }
            request = SmokeDecks.humanMatchRequest(seed == null ? 42 : seed);
            if (trace) {
                request.addProperty("trace", true);
            }
            human = defending ? ScriptedHuman.defending()
                    : concedeInTurn > 0 ? ScriptedHuman.concedingInTurn(concedeInTurn) : new ScriptedHuman();
        }
        if (cardLoading == null) {
            cardLoading = ForgeEngine.CardLoading.DEFAULT;
        }
        if (language == null) {
            language = ForgeEngine.Language.EN_US;
        }
        engine.addProperty("language", language.tag());
        engine.addProperty("cardLoading", cardLoading.name().toLowerCase(java.util.Locale.ROOT));

        final Path root = TempRoot.create();
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            EngineBoot.boot(in, root, cardLoading, language);
        }
        final JsonArray traceEntries = new JsonArray();
        final JsonObject result;
        if (messages == null) {
            result = HumanMatch.play(recording(human, traceEntries, null), request);
        } else {
            try (BufferedWriter log = Files.newBufferedWriter(Paths.get(messages), StandardCharsets.UTF_8)) {
                result = HumanMatch.play(recording(human, traceEntries, log), request);
            }
        }
        final JsonObject transcript = human.transcript(request, result);
        if (name != null) {
            transcript.addProperty("name", name);
        }
        transcript.add("engine", engine);
        if (request.has("trace") && request.get("trace").getAsBoolean()) {
            transcript.add("trace", traceEntries);
        }
        Files.writeString(Paths.get(out), new GsonBuilder().setPrettyPrinting().serializeNulls().create().toJson(transcript),
                StandardCharsets.UTF_8);
        System.out.println(JvmSmokeMain.RESULT_PREFIX + new GsonBuilder().serializeNulls().create().toJson(result));
        System.exit(0);
    }

    /**
     * Passes everything through to the player, keeps the engine trace entries
     * for the transcript and writes each emitted message as one JSON line.
     */
    private static EngineHost recording(final EngineHost player, final JsonArray trace, final BufferedWriter out) {
        return new EngineHost() {
            @Override
            public void emit(final JsonObject message) {
                if (out != null) {
                    try {
                        out.write(message.toString());
                        out.write('\n');
                    } catch (final IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }
                if (EngineTrace.MESSAGE_TYPE.equals(message.get("type").getAsString())) {
                    trace.add(message);
                    return;
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

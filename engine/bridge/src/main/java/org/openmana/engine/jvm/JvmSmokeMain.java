package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.smoke.AiSmokeMatch;
import org.openmana.engine.trace.EngineTrace;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Runs the engine smoke match on the JVM with the same boot sequence as the
 * Wasm build. Used as the reference side of the JVM/Wasm comparison and to
 * record reachability metadata with GraalVM's tracing agent.
 *
 * <pre>
 * java -Dforge.synchronous=true -jar openmana-engine-bridge-jar-with-dependencies.jar \
 *      --bundle forge-res.bin [--seed 42] [--card-loading lazy|eager] [--language en-US|de-DE]
 *      [--card-language en-US|de-DE] [--root DIR] [--log]
 *      [--trace trace.jsonl]
 * </pre>
 *
 * Prints one line {@code OPENMANA-RESULT:{"boot": …, "result": …}} on stdout;
 * Forge's own console output goes to the same stream, hence the prefix. With
 * {@code --trace} the engine trace of the game (diagnostics.trace entries,
 * {@link EngineTrace}) is written one JSON line per entry: the reference the
 * Wasm AI games are compared with.
 */
public final class JvmSmokeMain {

    public static final String RESULT_PREFIX = "OPENMANA-RESULT:";

    private JvmSmokeMain() {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        long seed = 42;
        ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.DEFAULT;
        ForgeEngine.Language language = ForgeEngine.Language.EN_US;
        ForgeEngine.Language cardLanguage = null;
        Path root = null;
        boolean includeLog = false;
        String trace = null;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--seed" -> seed = Long.parseLong(args[++i]);
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                case "--language" -> language = ForgeEngine.Language.parse(args[++i]);
                case "--card-language" -> cardLanguage = ForgeEngine.Language.parse(args[++i]);
                case "--root" -> root = Paths.get(args[++i]);
                case "--log" -> includeLog = true;
                case "--trace" -> trace = args[++i];
                default -> throw new IllegalArgumentException("unknown argument " + args[i]);
            }
        }
        if (bundle == null) {
            throw new IllegalArgumentException("--bundle <forge-res.bin> is required");
        }
        if (root == null) {
            root = TempRoot.create();
        }

        final JsonObject out = new JsonObject();
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            out.add("boot", EngineBoot.boot(in, root, cardLoading, language, cardLanguage == null ? language : cardLanguage));
        }
        if (trace == null) {
            out.add("result", AiSmokeMatch.run(seed, includeLog));
        } else {
            try (BufferedWriter lines = Files.newBufferedWriter(Paths.get(trace), StandardCharsets.UTF_8)) {
                out.add("result", AiSmokeMatch.run(seed, includeLog, entry -> {
                    try {
                        lines.write(entry.toString());
                        lines.write('\n');
                    } catch (final IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }));
            }
        }
        System.out.println(RESULT_PREFIX + new GsonBuilder().serializeNulls().create().toJson(out));
        // Forge leaves executor threads behind on the JVM; the smoke run is done.
        System.exit(0);
    }
}

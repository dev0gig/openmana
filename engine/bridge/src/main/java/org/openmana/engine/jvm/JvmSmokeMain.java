package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.smoke.AiSmokeMatch;

import java.io.InputStream;
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
 *      --bundle forge-res.bin [--seed 42] [--card-loading lazy|eager] [--root DIR] [--log]
 * </pre>
 *
 * Prints one line {@code OPENMANA-RESULT:{"boot": …, "result": …}} on stdout;
 * Forge's own console output goes to the same stream, hence the prefix.
 */
public final class JvmSmokeMain {

    public static final String RESULT_PREFIX = "OPENMANA-RESULT:";

    private JvmSmokeMain() {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        long seed = 42;
        ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.LAZY;
        Path root = null;
        boolean includeLog = false;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--seed" -> seed = Long.parseLong(args[++i]);
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                case "--root" -> root = Paths.get(args[++i]);
                case "--log" -> includeLog = true;
                default -> throw new IllegalArgumentException("unknown argument " + args[i]);
            }
        }
        if (bundle == null) {
            throw new IllegalArgumentException("--bundle <forge-res.bin> is required");
        }
        if (root == null) {
            root = Files.createTempDirectory("openmana-engine-");
        }

        final JsonObject out = new JsonObject();
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            out.add("boot", EngineBoot.boot(in, root, cardLoading));
        }
        out.add("result", AiSmokeMatch.run(seed, includeLog));
        System.out.println(RESULT_PREFIX + new GsonBuilder().serializeNulls().create().toJson(out));
        // Forge leaves executor threads behind on the JVM; the smoke run is done.
        System.exit(0);
    }
}

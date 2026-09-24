package org.openmana.engine.jvm;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.smoke.CardProbe;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Runs the card probe ({@link CardProbe}) on the JVM with the same boot
 * sequence as the Wasm build: the reference side of the JVM/Wasm comparison
 * of Forge's card scripts.
 *
 * <pre>
 * java -cp openmana-engine-jvm.jar org.openmana.engine.jvm.JvmCardProbeMain \
 *      --bundle forge-res.bin [--card-loading lazy|eager] [--language en-US|de-DE] [--root DIR]
 * </pre>
 *
 * Prints one line {@code OPENMANA-RESULT:{"boot": …, "result": …}} on stdout.
 */
public final class JvmCardProbeMain {

    private JvmCardProbeMain() {
    }

    public static void main(final String[] args) throws Exception {
        String bundle = null;
        ForgeEngine.CardLoading cardLoading = ForgeEngine.CardLoading.DEFAULT;
        ForgeEngine.Language language = ForgeEngine.Language.EN_US;
        Path root = null;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bundle" -> bundle = args[++i];
                case "--card-loading" -> cardLoading = ForgeEngine.CardLoading.parse(args[++i]);
                case "--language" -> language = ForgeEngine.Language.parse(args[++i]);
                case "--root" -> root = Paths.get(args[++i]);
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
            out.add("boot", EngineBoot.boot(in, root, cardLoading, language));
        }
        out.add("result", CardProbe.run());
        System.out.println(JvmSmokeMain.RESULT_PREFIX + new GsonBuilder().serializeNulls().create().toJson(out));
        System.exit(0);
    }
}

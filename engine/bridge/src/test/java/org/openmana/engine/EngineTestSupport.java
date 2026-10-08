package org.openmana.engine;

import com.google.gson.JsonObject;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.testng.Assert.fail;

/**
 * Boots Forge once per test JVM: Forge's model is static, so all test classes
 * share one engine (as all games in one browser worker would).
 */
public final class EngineTestSupport {

    private static JsonObject bootReport;

    private EngineTestSupport() {
    }

    public static synchronized JsonObject boot() throws Exception {
        if (bootReport != null) {
            return bootReport;
        }
        final String bundle = System.getProperty("openmana.resourceBundle");
        if (bundle == null || bundle.isEmpty() || bundle.startsWith("${")) {
            fail("-Dopenmana.resourceBundle is not set; run engine/scripts/build-jvm.sh");
        }
        // Below the module's target/ (removed by every clean build), not /tmp:
        // one boot unpacks ~37 000 files.
        final Path root = Paths.get("target", "engine-test-root").toAbsolutePath();
        Files.createDirectories(root);
        try (InputStream in = Files.newInputStream(Paths.get(bundle))) {
            bootReport = EngineBoot.boot(in, root, ForgeEngine.CardLoading.LAZY);
        }
        return bootReport;
    }
}

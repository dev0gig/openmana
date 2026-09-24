package org.openmana.engine;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * The boot sequence shared by the JVM smoke runner and the Wasm entry point,
 * so both runtimes do exactly the same work in the same order:
 *
 * <ol>
 *   <li>unpack the Forge resource bundle below {@code root/forge/},</li>
 *   <li>configure Forge's runtime ({@code root/home} as {@code user.home}),</li>
 *   <li>initialise Forge with the requested card loading mode and language.</li>
 * </ol>
 */
public final class EngineBoot {

    private EngineBoot() {
    }

    public static JsonObject boot(final InputStream resourceBundle, final Path root,
                                  final ForgeEngine.CardLoading cardLoading) throws IOException {
        return boot(resourceBundle, root, cardLoading, ForgeEngine.Language.EN_US);
    }

    public static JsonObject boot(final InputStream resourceBundle, final Path root,
                                  final ForgeEngine.CardLoading cardLoading,
                                  final ForgeEngine.Language language) throws IOException {
        final long t0 = System.nanoTime();
        final Path assets = root.resolve("forge");
        final Path home = root.resolve("home");
        Files.createDirectories(assets);
        Files.createDirectories(home);
        final ResourceBundleReader.Stats stats = ResourceBundleReader.unpack(resourceBundle, assets);
        final String expectedFiles = ForgeEngine.buildInfo().getProperty("resources.files");
        if (expectedFiles == null || Integer.parseInt(expectedFiles.trim()) != stats.files) {
            throw new IllegalStateException("the Forge data bundle has " + stats.files + " files, this engine was built with "
                    + expectedFiles + ": bundle and engine come from different builds");
        }
        writeEmptyUiPreferences(home);
        final long unpackMillis = (System.nanoTime() - t0) / 1_000_000L;

        ForgeEngine.configureRuntime(assets.toString() + "/", home.toString());
        final long forgeInitMillis = ForgeEngine.initialize(cardLoading, language);

        final JsonObject report = new JsonObject();
        report.addProperty("resourceFiles", stats.files);
        report.addProperty("resourceBytes", stats.bytes);
        report.addProperty("unpackMillis", unpackMillis);
        report.addProperty("forgeInitMillis", forgeInitMillis);
        report.addProperty("cardLoading", cardLoading.name().toLowerCase());
        report.addProperty("language", language.tag());
        report.add("engine", engineInfo());
        return report;
    }

    /**
     * Forge's desktop UI preferences (card stars, deck favourites, list
     * columns) are XML files it reads during {@code FModel.initialize}. The
     * engine has no such UI state, so it provides them empty, identically on
     * both runtimes. Without them the JVM throws FileNotFoundException, which
     * Forge ignores, while Web Image's file system throws NoSuchFileException,
     * which Forge prints as a stack trace: same outcome, noisy log.
     */
    private static void writeEmptyUiPreferences(final Path home) throws IOException {
        final Path prefs = home.resolve(".forge").resolve("preferences");
        Files.createDirectories(prefs);
        for (final String name : new String[]{"card.preferences", "deck.preferences", "item_view.preferences"}) {
            final Path file = prefs.resolve(name);
            if (!Files.exists(file)) {
                Files.writeString(file, "<preferences/>\n");
            }
        }
    }

    /**
     * What this engine is (protocol EngineBuild): Forge version and pinned
     * commit, the patch queue and the OpenMana commit, from the build facts
     * prepare-forge.sh writes.
     */
    public static JsonObject engineInfo() {
        final Properties build = ForgeEngine.buildInfo();
        final JsonObject info = new JsonObject();
        info.addProperty("forgeVersion", ForgeEngine.forgeVersion());
        info.addProperty("forgeCommit", required(build, "forge.commit"));
        info.addProperty("forgeVersionCode", required(build, "forge.versionCode"));
        info.addProperty("patchCount", Integer.parseInt(required(build, "patches.count")));
        info.addProperty("patchesSha256", required(build, "patches.sha256"));
        info.addProperty("openmanaCommit", required(build, "openmana.commit"));
        info.addProperty("engineSourcesModified", Boolean.parseBoolean(required(build, "openmana.engineSourcesModified")));
        info.addProperty("synchronous", forge.util.ThreadUtil.isSynchronous());
        info.addProperty("resourcesSha256", required(build, "resources.sha256"));
        return info;
    }

    private static String required(final Properties build, final String key) {
        final String value = build.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("engine build fact '" + key + "' is missing (openmana/engine-build.properties)");
        }
        return value.trim();
    }
}

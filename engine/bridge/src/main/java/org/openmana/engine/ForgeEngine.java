package org.openmana.engine;

import forge.gui.GuiBase;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.util.BuildInfo;
import forge.util.ThreadUtil;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/**
 * Brings Forge up inside OpenMana, identically on the JVM and in the browser.
 *
 * <p>Two steps, in this order:
 * <ol>
 *   <li>{@link #configureRuntime} before any Forge class is initialised:
 *       synchronous mode (patch 0001), the headless {@code IGuiBase}, and
 *       where Forge's files and its profile directory live;</li>
 *   <li>{@link #initialize} loads Forge's data ({@code FModel.initialize}).</li>
 * </ol>
 *
 * <p>All preferences are set in the {@code adjustPrefs} callback of
 * {@code FModel.initialize}: it runs after the preferences are read and before
 * language, card database and AI profiles are loaded (Anvil lesson: a language
 * set afterwards silently keeps the English tables). Nothing is saved; the
 * browser has no persistent Forge profile.
 */
public final class ForgeEngine {

    /** How Forge reads its 33k card scripts at start (research: open question 2). */
    public enum CardLoading {
        /** Index card names only, read a script on first use ({@code LOAD_CARD_SCRIPTS_LAZILY}). */
        LAZY,
        /** Read and parse every card script during {@code FModel.initialize}. */
        EAGER;

        public static CardLoading parse(final String value) {
            for (final CardLoading mode : values()) {
                if (mode.name().equalsIgnoreCase(value)) {
                    return mode;
                }
            }
            throw new IllegalArgumentException("unknown card loading mode '" + value + "' (lazy|eager)");
        }
    }

    private static boolean runtimeConfigured;
    private static CardLoading initializedWith;

    private ForgeEngine() {
    }

    /**
     * @param assetsDir directory containing Forge's {@code res/} tree
     * @param userHome  writable directory Forge uses as {@code user.home}
     *                  (profile, preferences, logs)
     */
    public static void configureRuntime(final String assetsDir, final String userHome) {
        if (runtimeConfigured) {
            throw new IllegalStateException("Forge runtime is already configured");
        }
        System.setProperty("forge.synchronous", "true");
        System.setProperty("user.home", userHome);
        System.setProperty("java.awt.headless", "true");
        // Checked right away: if anything touched ThreadUtil before this point
        // the flag was read as false and Forge would try to start threads.
        if (!ThreadUtil.isSynchronous()) {
            throw new IllegalStateException("Forge's ThreadUtil was initialised before forge.synchronous was set;"
                    + " configureRuntime must run before any other Forge code");
        }
        GuiBase.setInterface(new HeadlessGuiBase(assetsDir));
        runtimeConfigured = true;
    }

    /** @return milliseconds spent in {@code FModel.initialize} */
    public static long initialize(final CardLoading cardLoading) {
        if (!runtimeConfigured) {
            throw new IllegalStateException("configureRuntime must be called before initialize");
        }
        if (initializedWith != null) {
            throw new IllegalStateException("Forge is already initialised (" + initializedWith + ")");
        }
        final long start = System.nanoTime();
        FModel.initialize(null, prefs -> {
            prefs.setPref(FPref.UI_LANGUAGE, "en-US");
            prefs.setPref(FPref.LOAD_CARD_SCRIPTS_LAZILY, cardLoading == CardLoading.LAZY);
            // The card-based deck generator needs res/deckgendecks, which the
            // engine does not ship; decks always come from the player.
            prefs.setPref(FPref.DECKGEN_CARDBASED, false);
            // Stated explicitly because both change what Forge does: no AI
            // shuffle cheating, no rules shortcuts (ManaBrew turns the latter on).
            prefs.setPref(FPref.UI_ENABLE_AI_CHEATS, false);
            prefs.setPref(FPref.PERFORMANCE_MODE, false);
            return null;
        });
        initializedWith = cardLoading;
        return (System.nanoTime() - start) / 1_000_000L;
    }

    public static CardLoading cardLoading() {
        return initializedWith;
    }

    public static String forgeVersion() {
        return BuildInfo.getVersionString();
    }

    /**
     * Build facts written by {@code engine/scripts/prepare-forge.sh}: pinned
     * Forge commit, hash of the patch queue, bridge commit.
     */
    public static Properties buildInfo() {
        final Properties props = new Properties();
        try (InputStream in = ForgeEngine.class.getResourceAsStream("/openmana/engine-build.properties")) {
            if (in == null) {
                throw new IllegalStateException("openmana/engine-build.properties is missing from the engine build");
            }
            props.load(in);
        } catch (final IOException e) {
            throw new IllegalStateException("cannot read engine build info", e);
        }
        return props;
    }
}

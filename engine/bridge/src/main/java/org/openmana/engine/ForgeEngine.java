package org.openmana.engine;

import forge.gui.GuiBase;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.util.BuildInfo;
import forge.util.ThreadUtil;
import org.tinylog.Logger;
import org.tinylog.configuration.Configuration;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/**
 * Brings Forge up inside OpenMana, identically on the JVM and in the browser.
 *
 * <p>Two steps, in this order:
 * <ol>
 *   <li>{@link #configureRuntime} before any Forge class is initialised:
 *       Forge's logging ({@link #LOGGING}), synchronous mode (patch 0001),
 *       the headless {@code IGuiBase}, and where Forge's files and its
 *       profile directory live;</li>
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

    /**
     * tinylog configuration of the engine, replacing Forge's own
     * {@code tinylog.properties} (forge-gui) on both runtimes.
     *
     * <p>Forge's file names the calling class in every line
     * ({@code {class-name}}) and sets levels per package ({@code level@…}).
     * For both, tinylog looks up the caller on the Java stack, on every
     * enabled log call. WebAssembly (Web Image) has no Java stack to walk: the
     * lookup returns null and tinylog throws a NullPointerException inside
     * Forge (found in prompt 02: {@code InputSyncronizedBase.awaitLatchRelease}
     * logs on the tag NETWORK, which Forge's file enables down to TRACE). This
     * configuration needs no caller: console only, INFO and above, message and
     * level only. The JVM uses it too, so both runtimes behave alike.
     */
    static final Map<String, String> LOGGING = Map.of(
            "writer", "console",
            "writer.level", "info",
            "writer.format", "[{level}] {message}");

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
        configureLogging();
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

    private static void configureLogging() {
        if (!Configuration.isFrozen()) {
            Configuration.replace(LOGGING);
        } else {
            // Something logged before the engine started (the test JVM: TestNG
            // through SLF4J). Then the engine's configuration must already be in
            // effect, set from outside (tinylog.configuration), or nothing runs.
            final boolean same = LOGGING.entrySet().stream().allMatch(e -> e.getValue().equals(Configuration.get(e.getKey())))
                    && Configuration.getSiblings("writer").keySet().equals(Set.of("writer"))
                    && Configuration.getSiblings("level@").isEmpty();
            if (!same) {
                throw new IllegalStateException("tinylog was started with another configuration before the engine;"
                        + " configureRuntime must run first, or tinylog.configuration must name the engine's settings "
                        + LOGGING);
            }
        }
        // An enabled log call right away: if tinylog still needed the caller,
        // the engine fails here at start, not in the middle of a game.
        Logger.info("OpenMana engine: Forge logging configured (INFO and above, without caller lookup)");
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
            // Human seat (Anvil's settings): Forge itself passes priorities in
            // which nothing can be done (APINA) - and only with this pref does
            // Forge compute PlayerView.hasAvailableActions at all; actionable
            // highlights give the "playable" marker per card.
            prefs.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS, true);
            prefs.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, true);
            // Pacing belongs to the UI: no sleeps between phases or resolving
            // spells inside the engine (Thread.sleep does nothing in Web Image).
            prefs.setPref(FPref.YIELD_SKIP_PHASE_DELAY, true);
            prefs.setPref(FPref.YIELD_SKIP_RESOLVE_DELAY, true);
            // Sound and music are the UI's business.
            prefs.setPref(FPref.UI_ENABLE_SOUNDS, false);
            prefs.setPref(FPref.UI_ENABLE_MUSIC, false);
            // A name must exist, otherwise HostedMatch asks for one in a dialog.
            prefs.setPref(FPref.PLAYER_NAME, "Player");
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

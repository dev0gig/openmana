package org.openmana.engine;

import forge.ai.AiProfileUtil;
import forge.gui.GuiBase;
import forge.localinstance.properties.ForgeConstants;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.util.BuildInfo;
import forge.util.CardTranslation;
import forge.util.Localizer;
import forge.util.ThreadUtil;
import org.tinylog.Logger;
import org.tinylog.configuration.Configuration;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;

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

        /**
         * The engine's default: eager. Lazy loading still parses every script
         * once at start (for the name index) and saves only memory, but the
         * first effect or decision that needs all cards (a random card, the
         * player naming a card) makes Forge load the rest of the database in
         * the middle of the game: 17 s in Chrome, 23-42 s in Node on a desktop
         * CPU, measured in prompt 04
         * (docs/implementation/04-forge-resources-card-scripts.md). Eager
         * costs 1.6 s more at start in Chrome and ~90 MiB.
         */
        public static final CardLoading DEFAULT = EAGER;

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
     * A language of Forge's language files ({@code res/languages}), for two
     * things: the language Forge speaks (its own messages: prompts, buttons,
     * the game log) and the language of the cards inside them and in its card
     * views (names, type lines, rules texts: {@code CardTranslation}). By
     * default the cards follow the messages; the card language can be set on
     * its own (prompt 12: German words with English card names for a player
     * who prefers English cards). Card keys on the wire stay English whatever
     * the language (Anvil lesson); how the UI shows cards is Scryfall's
     * business. The engine ships exactly these two (Bible §4: German
     * preferred, English fallback).
     */
    public enum Language {
        EN_US("en-US"),
        DE_DE("de-DE");

        private final String tag;

        Language(final String tag) {
            this.tag = tag;
        }

        /** Forge's locale id, e.g. {@code de-DE}. */
        public String tag() {
            return tag;
        }

        public static Language parse(final String value) {
            for (final Language language : values()) {
                if (language.tag.equalsIgnoreCase(value)) {
                    return language;
                }
            }
            throw new IllegalArgumentException("unknown language '" + value + "' (en-US|de-DE)");
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
    private static Language language;
    private static Language cardLanguage;

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

    /** Cards in the language Forge speaks. @return milliseconds spent in {@code FModel.initialize} */
    public static long initialize(final CardLoading cardLoading, final Language requestedLanguage) {
        return initialize(cardLoading, requestedLanguage, requestedLanguage);
    }

    /**
     * @param requestedLanguage     the language of Forge's own messages
     * @param requestedCardLanguage the language of card names, type lines and
     *                              rules texts in Forge's messages and card views
     * @return milliseconds spent in {@code FModel.initialize} (and in reading
     *         the other card language, if any)
     */
    public static long initialize(final CardLoading cardLoading, final Language requestedLanguage, final Language requestedCardLanguage) {
        if (!runtimeConfigured) {
            throw new IllegalStateException("configureRuntime must be called before initialize");
        }
        if (initializedWith != null) {
            throw new IllegalStateException("Forge is already initialised (" + initializedWith + ")");
        }
        requireLanguageFiles(requestedLanguage);
        requireLanguageFiles(requestedCardLanguage);
        final long start = System.nanoTime();
        FModel.initialize(null, prefs -> {
            // Here and not afterwards: FModel.initialize loads Lang, Localizer and
            // CardTranslation right after this callback (Anvil lesson: a language
            // set later silently keeps the English tables).
            prefs.setPref(FPref.UI_LANGUAGE, requestedLanguage.tag());
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
        if (requestedCardLanguage != requestedLanguage) {
            // FModel.initialize loaded the card translation of UI_LANGUAGE.
            // Forge reads CardTranslation whenever it shows a card (CardView,
            // game log, prompts), so replacing it here changes every card text
            // from now on and nothing else; PaperCard recomputes its sortable
            // name when the selected language changes.
            CardTranslation.preloadTranslation(requestedCardLanguage.tag(), ForgeConstants.LANG_DIR);
        }
        final long millis = (System.nanoTime() - start) / 1_000_000L;
        requireLanguageLoaded(requestedLanguage, requestedCardLanguage);
        initializedWith = cardLoading;
        language = requestedLanguage;
        cardLanguage = requestedCardLanguage;
        return millis;
    }

    /**
     * Forge falls back to English without a word when a language file is
     * missing (Localizer prints a stack trace, CardTranslation a line on
     * stderr). The engine refuses to start instead.
     */
    private static void requireLanguageFiles(final Language requested) {
        if (requested == Language.EN_US) {
            return;
        }
        for (final String name : new String[]{requested.tag() + ".properties", "cardnames-" + requested.tag() + ".txt"}) {
            if (!new File(ForgeConstants.LANG_DIR + name).isFile()) {
                throw new IllegalStateException("language " + requested.tag() + " requested, but res/languages/" + name
                        + " is not in the engine's Forge data (engine/resources.json)");
            }
        }
    }

    /**
     * Checks that Forge really speaks the requested languages: its selected
     * card translation is the card language, and one message that every Forge
     * translation has (lblYes) differs from English. In the browser the messages come from
     * the resource bundles compiled into the module (build-wasm.sh), a
     * different path than on the JVM.
     */
    private static void requireLanguageLoaded(final Language requested, final Language requestedCards) {
        if (!requestedCards.tag().equals(CardTranslation.getLanguageSelected())) {
            throw new IllegalStateException("Forge's card translation is " + CardTranslation.getLanguageSelected()
                    + ", requested was " + requestedCards.tag());
        }
        if (requested != Language.EN_US) {
            final Localizer localizer = Localizer.getInstance();
            if (localizer.getMessage("lblYes").equals(localizer.getEnglishMessage("lblYes"))) {
                throw new IllegalStateException("Forge's messages are still English although " + requested.tag()
                        + " was requested: the language's message bundle did not load");
            }
        }
    }

    public static CardLoading cardLoading() {
        return initializedWith;
    }

    public static Language language() {
        return language;
    }

    public static Language cardLanguage() {
        return cardLanguage;
    }

    /**
     * The AI profiles Forge loaded ({@code res/ai/*.ai}, read by
     * {@code FModel.initialize}; a file Forge cannot read stops the start),
     * sorted by name: the directory listing's order differs between the JVM
     * and the browser's file system.
     */
    public static List<String> aiProfiles() {
        return List.copyOf(new TreeSet<>(AiProfileUtil.getAvailableProfiles()));
    }

    public static String forgeVersion() {
        return BuildInfo.getVersionString();
    }

    /**
     * Build facts written by {@code engine/scripts/prepare-forge.sh} (pinned
     * Forge commit, hash of the patch queue, bridge commit) and by
     * {@code build-jvm.sh} (the Forge data bundle: SHA-256, file count,
     * languages).
     */
    public static Properties buildInfo() {
        final Properties props = new Properties();
        for (final String name : new String[]{"engine-build.properties", "engine-resources.properties"}) {
            try (InputStream in = ForgeEngine.class.getResourceAsStream("/openmana/" + name)) {
                if (in == null) {
                    throw new IllegalStateException("openmana/" + name + " is missing from the engine build");
                }
                props.load(in);
            } catch (final IOException e) {
                throw new IllegalStateException("cannot read engine build info " + name, e);
            }
        }
        return props;
    }
}

package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.deck.CardPool;
import forge.deck.Deck;
import forge.deck.DeckSection;
import forge.game.Game;
import forge.game.GameLogEntry;
import forge.game.GameRules;
import forge.game.GameType;
import forge.game.player.RegisteredPlayer;
import forge.gamemodes.match.HostedMatch;
import forge.item.PaperCard;
import forge.player.GamePlayerUtil;
import forge.util.MyRandom;
import org.openmana.engine.EngineDiagnostics;
import org.openmana.engine.trace.EngineTrace;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TreeSet;

/**
 * Starts a game human (through the protocol) against Forge's AI and runs it
 * to the end on the calling thread.
 *
 * <p>Behavioural reference: Anvil's {@code AnvilSitzung.partieStarten}
 * (forge-anvil) without its server parts: decks come as JSON (from the UI's
 * IndexedDB later) instead of .dck files, there is no log file, no executor,
 * and {@code HostedMatch.startMatch} runs the whole game inline because Forge
 * is in synchronous mode.
 *
 * <p>Request:
 * <pre>
 * { "command": "human-match", "seed": 42 (optional), "format": "constructed" | "commander",
 *   "human": { "name": "…", "deck": DECK },
 *   "ai":    { "name": "…", "profile": "Default", "deck": DECK },
 *   "trace": true (optional, engine tests only) }
 * DECK = { "name": "…", "main": [ {"card": "Mountain", "count": 22}, … ],
 *          "sideboard": […], "commander": […] }
 * </pre>
 * Card names are English (Forge's names, front face of double-faced cards).
 * A name Forge does not know stops the start with the complete list of such
 * names; nothing is dropped silently. With {@code trace} the host also
 * receives the engine trace ({@link EngineTrace}: diagnostics.trace messages)
 * that the differential tests compare between JVM and WebAssembly.
 */
public final class HumanMatch {

    /** A request that does not fit the contract (a field is missing or has the wrong form). */
    public static final class InvalidRequest extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;

        InvalidRequest(final String message) {
            super(message);
        }
    }

    /** A deck that cannot be built as requested. */
    public static final class DeckProblem extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        private final JsonObject report;

        DeckProblem(final String message, final JsonObject report) {
            super(message);
            this.report = report;
        }

        public JsonObject report() {
            return report;
        }
    }

    private HumanMatch() {
    }

    /**
     * Plays one game. Blocks until Forge reports the end.
     *
     * @return the {@code game.end} message plus technical facts: hash of
     *         Forge's game log, fingerprint of the decision messages
     *         ({@link ProtocolTrace}), counts, diagnostics
     */
    public static JsonObject play(final EngineHost playerHost, final JsonObject request) {
        EngineDiagnostics.clear();
        final ProtocolTrace fingerprint = new ProtocolTrace(playerHost);
        // The engine trace sees the bridge's messages on their way out and
        // sends its own entries straight to the player's host, so they are
        // not part of the decision fingerprint.
        final EngineTrace trace = bool(request, "trace") ? new EngineTrace(playerHost::emit) : null;
        final EngineHost host = trace == null ? fingerprint : trace.wrap(fingerprint);
        final GameType type = "commander".equalsIgnoreCase(string(request, "format", "constructed"))
                ? GameType.Commander : GameType.Constructed;
        final JsonObject humanSpec = object(request, "human");
        final JsonObject aiSpec = object(request, "ai");
        final Deck humanDeck = deck(object(humanSpec, "deck"), "Human deck");
        final Deck aiDeck = deck(object(aiSpec, "deck"), "AI deck");

        if (request.has("seed") && !request.get("seed").isJsonNull()) {
            // Forge draws all game randomness from MyRandom (upstream hook).
            MyRandom.setRandom(new Random(request.get("seed").getAsLong()));
        }

        // The singleton GUI player (Forge compares against it in places);
        // naming it also sets PLAYER_NAME, so HostedMatch does not ask for a name.
        final LobbyPlayer human = GamePlayerUtil.getGuiPlayer(string(humanSpec, "name", "Player"), 0, 0, true);
        final String profile = string(aiSpec, "profile", "Default");
        final LobbyPlayer ai = GamePlayerUtil.createAiPlayer(string(aiSpec, "name", "Forge AI"), 1, 0, null, profile);

        final RegisteredPlayer humanSeat = type == GameType.Commander
                ? RegisteredPlayer.forCommander(humanDeck) : new RegisteredPlayer(humanDeck);
        humanSeat.setPlayer(human);
        final RegisteredPlayer aiSeat = type == GameType.Commander
                ? RegisteredPlayer.forCommander(aiDeck) : new RegisteredPlayer(aiDeck);
        aiSeat.setPlayer(ai);
        final List<RegisteredPlayer> seats = new ArrayList<>();
        seats.add(humanSeat);
        seats.add(aiSeat);

        final GameRules rules = new GameRules(type);
        rules.setAppliedVariants(EnumSet.of(type));
        rules.setGamesPerMatch(1);

        final JsonObject started = new JsonObject();
        started.addProperty("type", Protocol.GAME_STARTED);
        started.addProperty("protocol", Protocol.VERSION);
        started.addProperty("human", human.getName());
        started.addProperty("ai", ai.getName());
        started.addProperty("aiProfile", profile);
        started.addProperty("format", type == GameType.Commander ? "commander" : "constructed");
        // For prefetching images: both decks' names in ONE sorted list without
        // owner, so the UI can preload without learning the AI's deck (Anvil).
        started.add("cardNames", cardNames(humanDeck, aiDeck));
        host.emit(started);

        final BridgeGuiGame gui = new BridgeGuiGame(host, trace);
        final HostedMatch match = new HostedMatch();
        gui.installPump();
        final long start = System.nanoTime();
        try {
            match.startMatch(rules, null, seats, humanSeat, gui);
        } finally {
            gui.removePump();
        }
        final long gameMillis = (System.nanoTime() - start) / 1_000_000L;
        if (trace != null) {
            trace.checkHealthy();
        }

        final Game game = match.getGame();
        if (game == null || !game.isGameOver()) {
            throw new IllegalStateException("Forge returned from startMatch before the game ended");
        }
        final JsonObject end = gui.endMessage();
        if (end == null) {
            throw new IllegalStateException("the game ended without Forge calling finishGame");
        }
        final JsonObject result = end.deepCopy();
        // The summary (match.finished) repeats the end, without its message type.
        result.remove("type");
        result.addProperty("gameMillis", gameMillis);
        result.addProperty("inputs", gui.inputsReceived());
        final List<GameLogEntry> log = game.getGameLog().getAllEntries();
        final StringBuilder canonical = new StringBuilder();
        for (final GameLogEntry e : log) {
            canonical.append(e.type().name()).append('\t').append(e.message()).append('\n');
        }
        result.addProperty("logEntries", log.size());
        result.addProperty("logSha256", ProtocolTrace.sha256(canonical.toString()));
        result.addProperty("protocolMessages", fingerprint.messages());
        result.addProperty("protocolSha256", fingerprint.sha256());
        if (trace != null) {
            result.add("trace", trace.summary());
        }
        final JsonObject callbacks = new JsonObject();
        gui.forgeCallbacks().forEach(callbacks::addProperty);
        result.add("forgeCallbacks", callbacks);
        final JsonArray errors = new JsonArray();
        EngineDiagnostics.forgeErrors().forEach(errors::add);
        result.add("forgeErrors", errors);
        final JsonArray threads = new JsonArray();
        EngineDiagnostics.threadViolations().forEach(threads::add);
        result.add("threadViolations", threads);
        match.endCurrentGame();
        return result;
    }

    /** Builds a Forge deck; unknown card names are collected and reported together. */
    static Deck deck(final JsonObject spec, final String fallbackName) {
        final Deck deck = new Deck(string(spec, "name", fallbackName));
        final JsonArray unknown = new JsonArray();
        add(deck, DeckSection.Main, spec.get("main"), unknown);
        add(deck, DeckSection.Sideboard, spec.get("sideboard"), unknown);
        add(deck, DeckSection.Commander, spec.get("commander"), unknown);
        if (!unknown.isEmpty()) {
            final JsonObject report = new JsonObject();
            report.addProperty("deck", deck.getName());
            report.add("unknownCards", unknown);
            throw new DeckProblem("Forge does not know " + unknown.size() + " card(s) of deck '" + deck.getName()
                    + "': " + unknown, report);
        }
        if (deck.getMain().countAll() == 0) {
            throw new DeckProblem("deck '" + deck.getName() + "' has no main deck cards", new JsonObject());
        }
        return deck;
    }

    private static void add(final Deck deck, final DeckSection section, final JsonElement entries, final JsonArray unknown) {
        if (entries == null || entries.isJsonNull()) {
            return;
        }
        if (!entries.isJsonArray()) {
            throw new DeckProblem(section + " must be a list of {card, count}", new JsonObject());
        }
        for (final JsonElement e : entries.getAsJsonArray()) {
            final JsonObject entry = e.getAsJsonObject();
            final String name = string(entry, "card", null);
            final int count = entry.has("count") ? entry.get("count").getAsInt() : 1;
            if (name == null || name.isBlank() || count < 1) {
                throw new DeckProblem("invalid deck entry " + entry, new JsonObject());
            }
            // Resolve through Forge's own card database. For a name it does not
            // know Forge creates an "unsupported" placeholder and removes it
            // again when the game starts - the player would silently play with
            // fewer cards. Such names stop the start instead.
            final CardPool probe = new CardPool();
            probe.add(name, count);
            boolean supported = probe.countAll() == count;
            for (final Map.Entry<PaperCard, Integer> resolved : probe) {
                if (resolved.getKey().getRules() == null || resolved.getKey().getRules().isUnsupported()) {
                    supported = false;
                }
            }
            if (!supported) {
                unknown.add(name);
                continue;
            }
            deck.getOrCreate(section).addAll(probe);
        }
    }

    private static JsonArray cardNames(final Deck... decks) {
        final Set<String> names = new TreeSet<>();
        for (final Deck deck : decks) {
            for (final Map.Entry<DeckSection, CardPool> section : deck) {
                for (final Map.Entry<PaperCard, Integer> entry : section.getValue()) {
                    names.add(entry.getKey().getName());
                }
            }
        }
        final JsonArray a = new JsonArray();
        names.forEach(a::add);
        return a;
    }

    private static boolean bool(final JsonObject o, final String field) {
        final JsonElement e = o.get(field);
        if (e == null || e.isJsonNull()) {
            return false;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isBoolean()) {
            throw new InvalidRequest("'" + field + "' must be a boolean in the match request");
        }
        return e.getAsBoolean();
    }

    private static JsonObject object(final JsonObject o, final String field) {
        final JsonElement e = o.get(field);
        if (e == null || !e.isJsonObject()) {
            throw new InvalidRequest("'" + field + "' is missing in the match request");
        }
        return e.getAsJsonObject();
    }

    private static String string(final JsonObject o, final String field, final String fallback) {
        final JsonElement e = o.get(field);
        if (e == null || e.isJsonNull()) {
            return fallback;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new InvalidRequest("'" + field + "' must be a string in the match request");
        }
        return e.getAsString();
    }
}

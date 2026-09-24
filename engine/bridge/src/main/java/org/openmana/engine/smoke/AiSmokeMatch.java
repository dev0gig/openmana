package org.openmana.engine.smoke;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameLogEntry;
import forge.game.GameOutcome;
import forge.game.GameRules;
import forge.game.GameType;
import forge.game.Match;
import forge.game.player.Player;
import forge.game.player.RegisteredPlayer;
import forge.game.zone.ZoneType;
import forge.player.GamePlayerUtil;
import forge.util.MyRandom;
import org.openmana.engine.EngineDiagnostics;
import org.openmana.engine.trace.EngineTrace;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;
import java.util.function.Consumer;

/**
 * The engine spike's smoke path: one complete Forge-AI-vs-Forge-AI game with a
 * fixed seed, run synchronously on the calling thread.
 *
 * <p>Forge plays every decision (its own AI, profile "Default" on both seats).
 * OpenMana only chooses the decks and the seed and reports what Forge's game
 * log says happened. The SHA-256 over the chronological log is what the JVM
 * and the Wasm build were first compared by; with a trace consumer the game
 * also produces the engine trace ({@link EngineTrace}), the structured record
 * the differential tests compare since prompt 05.
 */
public final class AiSmokeMatch {

    public static final String AI_PROFILE = "Default";

    private AiSmokeMatch() {
    }

    public static JsonObject run(final long seed, final boolean includeLog) {
        return run(seed, includeLog, null);
    }

    /** @param traceOut receives the engine trace entries (diagnostics.trace), or null for no trace */
    public static JsonObject run(final long seed, final boolean includeLog, final Consumer<JsonObject> traceOut) {
        EngineDiagnostics.clear();
        // Forge draws all game randomness (shuffles, coin flip, AI choices)
        // from MyRandom; upstream offers setRandom for deterministic simulation.
        MyRandom.setRandom(new Random(seed));

        final Deck red = SmokeDecks.build("OpenMana Smoke Red", SmokeDecks.redList());
        final Deck green = SmokeDecks.build("OpenMana Smoke Green", SmokeDecks.greenList());

        final List<RegisteredPlayer> players = new ArrayList<>();
        players.add(aiSeat(red, "Red AI", 0));
        players.add(aiSeat(green, "Green AI", 1));

        final GameRules rules = new GameRules(GameType.Constructed);
        rules.setAppliedVariants(EnumSet.of(GameType.Constructed));
        rules.setGamesPerMatch(1);

        final Match match = new Match(rules, players, "OpenMana engine smoke");
        final Game game = match.createGame();
        // Forge's own simulation mode does the same: no views for a UI.
        game.setNoGUIUser();
        final EngineTrace trace = traceOut == null ? null : new EngineTrace(traceOut);
        if (trace != null) {
            trace.attach(game);
        }

        final long start = System.nanoTime();
        match.startGame(game);
        final long gameMillis = (System.nanoTime() - start) / 1_000_000L;

        if (!game.isGameOver()) {
            throw new IllegalStateException("Forge returned from startGame but the game is not over");
        }
        final JsonObject result = describe(seed, game, gameMillis, includeLog);
        if (trace != null) {
            trace.checkHealthy();
            result.add("trace", trace.summary());
        }
        return result;
    }

    private static RegisteredPlayer aiSeat(final Deck deck, final String name, final int avatar) {
        final RegisteredPlayer seat = new RegisteredPlayer(deck);
        // Explicit avatar and sleeve: the shorter overloads draw them from
        // MyRandom and would shift the seeded sequence.
        final LobbyPlayer ai = GamePlayerUtil.createAiPlayer(name, avatar, 0, null, AI_PROFILE);
        seat.setPlayer(ai);
        return seat;
    }

    private static JsonObject describe(final long seed, final Game game, final long gameMillis,
                                       final boolean includeLog) {
        final GameOutcome outcome = game.getOutcome();
        final JsonObject result = new JsonObject();
        result.addProperty("seed", seed);
        result.addProperty("gameMillis", gameMillis);
        result.addProperty("draw", outcome.isDraw());
        result.addProperty("winner", outcome.isDraw() ? null : outcome.getWinningLobbyPlayer().getName());
        result.addProperty("winCondition", String.valueOf(outcome.getWinCondition()));
        result.addProperty("turns", outcome.getLastTurnNumber());

        final JsonArray seats = new JsonArray();
        for (final Player player : game.getRegisteredPlayers()) {
            final JsonObject seat = new JsonObject();
            seat.addProperty("name", player.getName());
            seat.addProperty("life", player.getLife());
            seat.addProperty("library", player.getCardsIn(ZoneType.Library).size());
            seat.addProperty("hand", player.getCardsIn(ZoneType.Hand).size());
            seat.addProperty("battlefield", player.getCardsIn(ZoneType.Battlefield).size());
            seat.addProperty("graveyard", player.getCardsIn(ZoneType.Graveyard).size());
            seats.add(seat);
        }
        result.add("players", seats);

        final List<GameLogEntry> entries = game.getGameLog().getAllEntries();
        final StringBuilder canonical = new StringBuilder();
        final JsonArray log = new JsonArray();
        for (final GameLogEntry entry : entries) {
            final String line = entry.type().name() + "\t" + entry.message();
            canonical.append(line).append('\n');
            log.add(line);
        }
        result.addProperty("logEntries", entries.size());
        result.addProperty("logSha256", sha256(canonical.toString()));
        if (includeLog) {
            result.add("log", log);
        }

        final JsonArray errors = new JsonArray();
        EngineDiagnostics.forgeErrors().forEach(errors::add);
        result.add("forgeErrors", errors);
        return result;
    }

    private static String sha256(final String text) {
        try {
            final byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            final StringBuilder hex = new StringBuilder(digest.length * 2);
            for (final byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (final NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}

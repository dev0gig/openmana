package org.openmana.engine.jvm;

import com.google.common.eventbus.Subscribe;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.LobbyPlayer;
import forge.ai.AiProfileUtil;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameOutcome;
import forge.game.GameRules;
import forge.game.GameType;
import forge.game.Match;
import forge.game.ability.ApiType;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.event.GameEvent;
import forge.game.event.GameEventAttackersDeclared;
import forge.game.event.GameEventBlockersDeclared;
import forge.game.event.GameEventLandPlayed;
import forge.game.event.GameEventMulligan;
import forge.game.event.GameEventPlayerDamaged;
import forge.game.event.GameEventSpellAbilityCast;
import forge.game.event.GameEventTurnBegan;
import forge.game.event.IGameEventVisitor;
import forge.game.player.Player;
import forge.game.player.PlayerView;
import forge.game.player.RegisteredPlayer;
import forge.game.spellability.SpellAbility;
import forge.player.GamePlayerUtil;
import forge.util.MyRandom;
import org.openmana.engine.EngineDiagnostics;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Supplier;

/**
 * Research tool of prompt 12 (JVM only, never part of the Wasm engine): what
 * Forge's AI profiles ({@code res/ai/*.ai}) change in how its AI plays.
 *
 * <p>Plays one Forge-AI-vs-Forge-AI game with a fixed seed, one profile per
 * seat, both seats with the same deck (a mirror match: the profile is the
 * only difference), and counts from Forge's own structured game events what
 * each seat did: turns, mulligans, attacks, blocks, spells, counterspells,
 * spells cast in the opponent's turn, lands, damage taken, life at the end.
 * Nothing is read from Forge's texts. The Wasm engine plays the very same
 * games (prompt 05: identical engine traces), so the JVM is the fast place to
 * measure. Results and conclusions: docs/research/AI_PROFILES.md.
 *
 * <p>Rules like the engine's human games: Constructed, one game per match, no
 * AI sideboarding, no AI shuffle cheating ({@code GameRules} default;
 * the engine also sets {@code UI_ENABLE_AI_CHEATS} to false).
 */
final class AiProfileStudy {

    private AiProfileStudy() {
    }

    /**
     * @param deck    builds a fresh copy of the deck for each seat
     * @param profile the profile of seat 0 and seat 1
     */
    static JsonObject play(final Supplier<Deck> deck, final String[] profile, final long seed) {
        for (final String name : profile) {
            if (!AiProfileUtil.getAvailableProfiles().contains(name)) {
                throw new IllegalArgumentException("Forge has no AI profile '" + name + "' (" + AiProfileUtil.getAvailableProfiles() + ")");
            }
        }
        EngineDiagnostics.clear();
        MyRandom.setRandom(new Random(seed));

        final List<RegisteredPlayer> seats = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            final RegisteredPlayer seat = new RegisteredPlayer(deck.get());
            // Explicit avatar and sleeve: the shorter overloads draw them from MyRandom.
            final LobbyPlayer ai = GamePlayerUtil.createAiPlayer("Seat " + (i + 1), i, 0, null, profile[i]);
            seat.setPlayer(ai);
            seats.add(seat);
        }
        final GameRules rules = new GameRules(GameType.Constructed);
        rules.setAppliedVariants(EnumSet.of(GameType.Constructed));
        rules.setGamesPerMatch(1);
        if (rules.isAllowCheatShuffle()) {
            throw new IllegalStateException("AI shuffle cheating must be off");
        }

        final Match match = new Match(rules, seats, "OpenMana AI profile study");
        final Game game = match.createGame();
        game.setNoGUIUser();
        final Counter counter = new Counter(game);
        game.subscribeToEvents(counter);

        final long start = System.nanoTime();
        match.startGame(game);
        final long millis = (System.nanoTime() - start) / 1_000_000L;
        if (!game.isGameOver()) {
            throw new IllegalStateException("Forge returned from startGame but the game is not over");
        }

        final GameOutcome outcome = game.getOutcome();
        final JsonObject result = new JsonObject();
        result.addProperty("seed", seed);
        result.addProperty("millis", millis);
        result.addProperty("turns", outcome.getLastTurnNumber());
        result.addProperty("draw", outcome.isDraw());
        result.addProperty("winCondition", String.valueOf(outcome.getWinCondition()));
        final JsonArray players = new JsonArray();
        for (final Player player : game.getRegisteredPlayers()) {
            final int seat = counter.seatOf(player.getId());
            final JsonObject p = counter.stats(seat);
            p.addProperty("seat", seat);
            p.addProperty("profile", profile[seat]);
            p.addProperty("won", !outcome.isDraw() && outcome.isWinner(player.getLobbyPlayer()));
            p.addProperty("life", player.getLife());
            players.add(p);
        }
        result.add("players", players);
        final JsonArray errors = new JsonArray();
        counter.errors.forEach(errors::add);
        EngineDiagnostics.forgeErrors().forEach(errors::add);
        result.add("errors", errors);
        return result;
    }

    /** Counts per seat from Forge's game events (Forge's model, not its texts). */
    static final class Counter extends IGameEventVisitor.Base<Void> {
        private static final String[] FIELDS = {
            "ownTurns", "mulligans", "attackTurns", "attackers", "attackersFaced", "blockers", "blockedAttackers",
            "spells", "counterspells", "spellsInOpponentsTurn", "lands", "damageTaken", "combatDamageTaken",
        };

        private final Game game;
        private final Map<Integer, Integer> seatById = new HashMap<>();
        private final int[][] counts = new int[2][FIELDS.length];
        private int activeSeat = -1;
        final List<String> errors = new ArrayList<>();

        Counter(final Game game) {
            this.game = game;
            int seat = 0;
            for (final Player player : game.getRegisteredPlayers()) {
                seatById.put(player.getId(), seat++);
            }
        }

        int seatOf(final int playerId) {
            final Integer seat = seatById.get(playerId);
            if (seat == null) {
                throw new IllegalStateException("unknown player id " + playerId);
            }
            return seat;
        }

        private int seatOf(final PlayerView player) {
            return player == null ? -1 : seatOf(player.getId());
        }

        private void add(final int seat, final String field, final int amount) {
            if (seat < 0) {
                return;
            }
            for (int i = 0; i < FIELDS.length; i++) {
                if (FIELDS[i].equals(field)) {
                    counts[seat][i] += amount;
                    return;
                }
            }
            throw new IllegalArgumentException(field);
        }

        JsonObject stats(final int seat) {
            final JsonObject o = new JsonObject();
            for (int i = 0; i < FIELDS.length; i++) {
                o.addProperty(FIELDS[i], counts[seat][i]);
            }
            return o;
        }

        /** Guava's EventBus swallows exceptions of subscribers: record them instead. */
        @Subscribe
        public void receive(final GameEvent event) {
            try {
                event.visit(this);
            } catch (final RuntimeException e) {
                errors.add("counter: " + e);
            }
        }

        @Override
        public Void visit(final GameEventTurnBegan event) {
            activeSeat = seatOf(event.turnOwner());
            add(activeSeat, "ownTurns", 1);
            return null;
        }

        @Override
        public Void visit(final GameEventMulligan event) {
            add(seatOf(event.player()), "mulligans", 1);
            return null;
        }

        @Override
        public Void visit(final GameEventAttackersDeclared event) {
            final int seat = seatOf(event.player());
            final int attackers = event.attackersMap().size();
            if (attackers > 0) {
                add(seat, "attackTurns", 1);
                add(seat, "attackers", attackers);
                add(1 - seat, "attackersFaced", attackers);
            }
            return null;
        }

        @Override
        public Void visit(final GameEventBlockersDeclared event) {
            final int seat = seatOf(event.defendingPlayer());
            int blockers = 0;
            final java.util.Set<Integer> blocked = new java.util.HashSet<>();
            for (final var byAttacker : event.blockers().values()) {
                for (final Map.Entry<CardView, CardView> e : byAttacker.entries()) {
                    // Forge lists an unblocked attacker with itself.
                    if (!e.getValue().equals(e.getKey())) {
                        blockers++;
                        blocked.add(e.getKey().getId());
                    }
                }
            }
            add(seat, "blockers", blockers);
            add(seat, "blockedAttackers", blocked.size());
            return null;
        }

        @Override
        public Void visit(final GameEventSpellAbilityCast event) {
            if (event.sa() == null || !event.sa().isSpell() || event.si() == null) {
                return null;
            }
            final int seat = seatOf(event.si().getActivatingPlayer());
            add(seat, "spells", 1);
            if (seat != activeSeat) {
                add(seat, "spellsInOpponentsTurn", 1);
            }
            final Card host = event.sa().getHostCard() == null ? null : game.findById(event.sa().getHostCard().getId());
            if (host != null && isCounterspell(host)) {
                add(seat, "counterspells", 1);
            }
            return null;
        }

        private static boolean isCounterspell(final Card card) {
            for (final SpellAbility sa : card.getSpells()) {
                for (SpellAbility part = sa; part != null; part = part.getSubAbility()) {
                    if (part.getApi() == ApiType.Counter) {
                        return true;
                    }
                }
            }
            return false;
        }

        @Override
        public Void visit(final GameEventLandPlayed event) {
            add(seatOf(event.player()), "lands", 1);
            return null;
        }

        @Override
        public Void visit(final GameEventPlayerDamaged event) {
            final int seat = seatOf(event.target());
            add(seat, "damageTaken", event.amount());
            if (event.combat()) {
                add(seat, "combatDamageTaken", event.amount());
            }
            return null;
        }
    }
}

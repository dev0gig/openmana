package org.openmana.engine.trace;

import com.google.common.collect.Multimap;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.card.MagicColor;
import forge.game.GameEntityView;
import forge.game.card.CardView;
import forge.game.event.GameEventAddLog;
import forge.game.event.GameEventAnteCardsSelected;
import forge.game.event.GameEventAttackersDeclared;
import forge.game.event.GameEventBlockersDeclared;
import forge.game.event.GameEventCardAttachment;
import forge.game.event.GameEventCardChangeZone;
import forge.game.event.GameEventCardCounters;
import forge.game.event.GameEventCardDamaged;
import forge.game.event.GameEventCardDestroyed;
import forge.game.event.GameEventCardForetold;
import forge.game.event.GameEventCardModeChosen;
import forge.game.event.GameEventCardPhased;
import forge.game.event.GameEventCardPlotted;
import forge.game.event.GameEventCardRegenerated;
import forge.game.event.GameEventCardSacrificed;
import forge.game.event.GameEventCardStatsChanged;
import forge.game.event.GameEventCardTapped;
import forge.game.event.GameEventCombatChanged;
import forge.game.event.GameEventCombatEnded;
import forge.game.event.GameEventCombatUpdate;
import forge.game.event.GameEventDayTimeChanged;
import forge.game.event.GameEventDoorChanged;
import forge.game.event.GameEventFlipCoin;
import forge.game.event.GameEventGameFinished;
import forge.game.event.GameEventGameOutcome;
import forge.game.event.GameEventGameRestarted;
import forge.game.event.GameEventGameStarted;
import forge.game.event.GameEventLandPlayed;
import forge.game.event.GameEventManaBurn;
import forge.game.event.GameEventManaPool;
import forge.game.event.GameEventMulligan;
import forge.game.event.GameEventPlayerControl;
import forge.game.event.GameEventPlayerCounters;
import forge.game.event.GameEventPlayerDamaged;
import forge.game.event.GameEventPlayerLivesChanged;
import forge.game.event.GameEventPlayerPoisoned;
import forge.game.event.GameEventPlayerPriority;
import forge.game.event.GameEventPlayerRadiation;
import forge.game.event.GameEventPlayerShardsChanged;
import forge.game.event.GameEventPlayerStatsChanged;
import forge.game.event.GameEventRandomLog;
import forge.game.event.GameEventRollDie;
import forge.game.event.GameEventScry;
import forge.game.event.GameEventShuffle;
import forge.game.event.GameEventSnapshotRestored;
import forge.game.event.GameEventSpeedChanged;
import forge.game.event.GameEventSpellAbilityCast;
import forge.game.event.GameEventSpellRemovedFromStack;
import forge.game.event.GameEventSpellResolved;
import forge.game.event.GameEventSprocketUpdate;
import forge.game.event.GameEventSubgameEnd;
import forge.game.event.GameEventSubgameStart;
import forge.game.event.GameEventSurveil;
import forge.game.event.GameEventTokenCreated;
import forge.game.event.GameEventTurnBegan;
import forge.game.event.GameEventTurnEnded;
import forge.game.event.GameEventTurnPhase;
import forge.game.event.GameEventZone;
import forge.game.event.IGameEventVisitor;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbilityView;
import forge.game.spellability.StackItemView;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.IntFunction;

/**
 * Turns every Forge game event into a small, language-independent record:
 * {@code {"e": kind, ...}} with ids, English card keys, enum names and
 * numbers. Forge's display texts (log lines, target and phase descriptions,
 * chosen modes) are left out on purpose: the trace must be the same in every
 * language, and it compares what happened, not how Forge words it.
 *
 * <p>This implements Forge's event visitor interface itself (not its empty
 * base class): a Forge update that adds an event type does not compile until
 * someone decides how to trace it, like a new data folder stops the build
 * (engine/resources.json).
 *
 * <p>Collections Forge hands over as hash sets or hash maps are sorted by id:
 * their iteration order is not part of the game.
 */
final class TraceEvents implements IGameEventVisitor<JsonObject> {

    /** Every kind this class produces; the protocol schema lists the same (ProtocolContractTest). */
    static final Set<String> KINDS = Set.of(
            "ante", "attackers", "blockers", "damage", "destroyed", "attach", "move", "mode", "regenerated",
            "sacrificed", "phased", "tap", "stats", "counters", "combatChanged", "combatEnded", "combatUpdate",
            "finished", "outcome", "coin", "gameStarted", "restarted", "land", "life", "mana", "manaBurn",
            "mulligan", "control", "playerDamage", "playerCounters", "poison", "radiation", "priority", "shards",
            "playerStats", "randomLog", "die", "scry", "shuffle", "speed", "cast", "resolve", "unstack",
            "sprocket", "subgameStart", "subgameEnd", "surveil", "token", "turn", "turnEnded", "phase", "zone",
            "foretold", "plotted", "dayTime", "door", "snapshotRestored", "log");

    /** English key (Forge's oracle name) of a card id, null if the card is gone. */
    private final IntFunction<String> keyOf;

    TraceEvents(final IntFunction<String> keyOf) {
        this.keyOf = keyOf;
    }

    private static JsonObject event(final String kind) {
        final JsonObject o = new JsonObject();
        o.addProperty("e", kind);
        return o;
    }

    private static void player(final JsonObject o, final String field, final PlayerView p) {
        o.addProperty(field, TraceRefs.id(p));
    }

    private void card(final JsonObject o, final String field, final CardView c, final boolean withKey) {
        o.addProperty(field, TraceRefs.id(c));
        if (withKey && c != null) {
            final String key = keyOf.apply(c.getId());
            if (key != null) {
                o.addProperty("key", key);
            }
        }
    }

    @Override
    public JsonObject visit(final GameEventAnteCardsSelected event) {
        final JsonObject o = event("ante");
        o.add("cards", byPlayer(event.cards()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventAttackersDeclared event) {
        final JsonObject o = event("attackers");
        player(o, "player", event.player());
        // defender -> attackers; a HashMultimap, so sorted by defender, then by id
        final Map<String, List<GameEntityView>> byDefender = new TreeMap<>();
        for (final Map.Entry<GameEntityView, CardView> e : event.attackersMap().entries()) {
            byDefender.computeIfAbsent(TraceRefs.entity(e.getKey()), k -> new ArrayList<>()).add(e.getValue());
        }
        final JsonArray attacks = new JsonArray();
        byDefender.forEach((defender, attackers) -> {
            final JsonObject a = new JsonObject();
            a.addProperty("defender", defender);
            a.add("attackers", TraceRefs.sortedIds(attackers));
            attacks.add(a);
        });
        o.add("attacks", attacks);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventBlockersDeclared event) {
        final JsonObject o = event("blockers");
        player(o, "player", event.defendingPlayer());
        // Forge's map: defender -> attacker -> blockers, an unblocked attacker
        // listed with itself (PhaseHandler.declareBlockersTurnBasedAction).
        // Here: attacker -> blockers over all defenders, sorted by attacker id.
        final Map<Integer, List<GameEntityView>> byAttacker = new TreeMap<>();
        for (final Multimap<CardView, CardView> blocks : event.blockers().values()) {
            for (final Map.Entry<CardView, CardView> e : blocks.entries()) {
                final List<GameEntityView> blockers = byAttacker.computeIfAbsent(e.getKey().getId(), k -> new ArrayList<>());
                if (!e.getValue().equals(e.getKey())) {
                    blockers.add(e.getValue());
                }
            }
        }
        final JsonArray blocks = new JsonArray();
        byAttacker.forEach((attacker, blockers) -> {
            final JsonObject b = new JsonObject();
            b.addProperty("attacker", attacker);
            b.add("blockers", TraceRefs.sortedIds(blockers));
            blocks.add(b);
        });
        o.add("blocks", blocks);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardDamaged event) {
        final JsonObject o = event("damage");
        card(o, "card", event.card(), false);
        o.addProperty("source", TraceRefs.id(event.source()));
        o.addProperty("amount", event.amount());
        o.addProperty("kind", event.type() == null ? null : event.type().name());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardDestroyed event) {
        return event("destroyed");
    }

    @Override
    public JsonObject visit(final GameEventCardAttachment event) {
        final JsonObject o = event("attach");
        card(o, "card", event.equipment(), false);
        o.addProperty("from", TraceRefs.entity(event.oldEntity()));
        o.addProperty("to", TraceRefs.entity(event.newTarget()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardChangeZone event) {
        final JsonObject o = event("move");
        card(o, "card", event.card(), true);
        o.addProperty("from", TraceRefs.zone(event.from()));
        o.addProperty("to", TraceRefs.zone(event.to()));
        return o;
    }

    /** The chosen mode itself is Forge's prose; what it does shows in the following events. */
    @Override
    public JsonObject visit(final GameEventCardModeChosen event) {
        final JsonObject o = event("mode");
        player(o, "player", event.player());
        o.addProperty("random", event.random());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardRegenerated event) {
        final JsonObject o = event("regenerated");
        o.add("cards", TraceRefs.sortedIds(event.cards()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardSacrificed event) {
        final JsonObject o = event("sacrificed");
        card(o, "card", event.card(), true);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardPhased event) {
        final JsonObject o = event("phased");
        card(o, "card", event.card(), false);
        o.addProperty("out", event.phaseState());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardTapped event) {
        final JsonObject o = event("tap");
        card(o, "card", event.card(), false);
        o.addProperty("tapped", event.tapped());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardStatsChanged event) {
        final JsonObject o = event("stats");
        o.add("cards", TraceRefs.sortedIds(event.cards()));
        o.addProperty("transform", event.transform());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardCounters event) {
        final JsonObject o = event("counters");
        card(o, "card", event.card(), false);
        o.addProperty("counter", event.type() == null ? null : event.type().getName());
        o.addProperty("from", event.oldValue());
        o.addProperty("to", event.newValue());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCombatChanged event) {
        return event("combatChanged");
    }

    @Override
    public JsonObject visit(final GameEventCombatEnded event) {
        final JsonObject o = event("combatEnded");
        o.add("attackers", TraceRefs.ids(event.attackers()));
        o.add("blockers", TraceRefs.ids(event.blockers()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCombatUpdate event) {
        final JsonObject o = event("combatUpdate");
        o.add("attackers", TraceRefs.ids(event.attackers()));
        o.add("blockers", TraceRefs.ids(event.blockers()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventGameFinished event) {
        return event("finished");
    }

    /** The outcome strings and the match summary are prose; the end itself is in game.end and the last snapshot. */
    @Override
    public JsonObject visit(final GameEventGameOutcome event) {
        final JsonObject o = event("outcome");
        o.addProperty("turn", event.lastTurnNumber());
        o.addProperty("winner", event.winningPlayerName());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventFlipCoin event) {
        return event("coin");
    }

    @Override
    public JsonObject visit(final GameEventGameStarted event) {
        final JsonObject o = event("gameStarted");
        o.addProperty("gameType", event.gameType() == null ? null : event.gameType().name());
        player(o, "first", event.firstTurn());
        o.add("players", TraceRefs.ids(event.players()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventGameRestarted event) {
        final JsonObject o = event("restarted");
        player(o, "player", event.whoRestarted());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventLandPlayed event) {
        final JsonObject o = event("land");
        player(o, "player", event.player());
        card(o, "card", event.land(), true);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerLivesChanged event) {
        final JsonObject o = event("life");
        player(o, "player", event.player());
        o.addProperty("from", event.oldLives());
        o.addProperty("to", event.newLives());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventManaPool event) {
        final JsonObject o = event("mana");
        player(o, "player", event.player());
        o.addProperty("mode", event.mode() == null ? null : event.mode().name());
        final Set<String> colors = new TreeSet<>();
        if (event.colors() != null) {
            for (final MagicColor.Color c : event.colors()) {
                colors.add(letter(c));
            }
        }
        final JsonArray a = new JsonArray();
        colors.forEach(a::add);
        o.add("colors", a);
        return o;
    }

    private static String letter(final MagicColor.Color c) {
        return switch (c) {
            case WHITE -> "W";
            case BLUE -> "U";
            case BLACK -> "B";
            case RED -> "R";
            case GREEN -> "G";
            case COLORLESS -> "C";
        };
    }

    @Override
    public JsonObject visit(final GameEventManaBurn event) {
        final JsonObject o = event("manaBurn");
        player(o, "player", event.player());
        o.addProperty("amount", event.amount());
        o.addProperty("lifeLoss", event.causedLifeLoss());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventMulligan event) {
        final JsonObject o = event("mulligan");
        player(o, "player", event.player());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerControl event) {
        final JsonObject o = event("control");
        player(o, "player", event.player());
        o.addProperty("human", event.newControllerIsHuman());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerDamaged event) {
        final JsonObject o = event("playerDamage");
        player(o, "player", event.target());
        o.addProperty("source", TraceRefs.id(event.source()));
        o.addProperty("amount", event.amount());
        o.addProperty("combat", event.combat());
        o.addProperty("infect", event.infect());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerCounters event) {
        final JsonObject o = event("playerCounters");
        player(o, "player", event.receiver());
        o.addProperty("counter", event.type() == null ? null : event.type().getName());
        o.addProperty("from", event.oldValue());
        o.addProperty("amount", event.amount());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerPoisoned event) {
        final JsonObject o = event("poison");
        player(o, "player", event.receiver());
        player(o, "source", event.source());
        o.addProperty("from", event.oldValue());
        o.addProperty("amount", event.amount());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerRadiation event) {
        final JsonObject o = event("radiation");
        player(o, "player", event.receiver());
        player(o, "source", event.source());
        o.addProperty("change", event.change());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerPriority event) {
        final JsonObject o = event("priority");
        player(o, "player", event.priority());
        player(o, "active", event.turn());
        o.addProperty("phase", event.phase() == null ? null : event.phase().name());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerShardsChanged event) {
        final JsonObject o = event("shards");
        player(o, "player", event.player());
        o.addProperty("from", event.oldShards());
        o.addProperty("to", event.newShards());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventPlayerStatsChanged event) {
        final JsonObject o = event("playerStats");
        o.add("players", TraceRefs.sortedIds(event.players()));
        return o;
    }

    /** Forge's debug line about a random choice; the choice shows in what follows. */
    @Override
    public JsonObject visit(final GameEventRandomLog event) {
        return event("randomLog");
    }

    @Override
    public JsonObject visit(final GameEventRollDie event) {
        return event("die");
    }

    @Override
    public JsonObject visit(final GameEventScry event) {
        final JsonObject o = event("scry");
        player(o, "player", event.player());
        o.addProperty("top", event.toTop());
        o.addProperty("bottom", event.toBottom());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventShuffle event) {
        final JsonObject o = event("shuffle");
        player(o, "player", event.player());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSpeedChanged event) {
        final JsonObject o = event("speed");
        player(o, "player", event.player());
        o.addProperty("from", event.oldValue());
        o.addProperty("to", event.newValue());
        return o;
    }

    /**
     * A spell or ability goes on the stack. Its targets are in the next
     * snapshot's stack; Forge's target description here is prose.
     */
    @Override
    public JsonObject visit(final GameEventSpellAbilityCast event) {
        final JsonObject o = event("cast");
        final SpellAbilityView sa = event.sa();
        final StackItemView si = event.si();
        card(o, "card", sa == null ? null : sa.getHostCard(), true);
        player(o, "player", si == null ? null : si.getActivatingPlayer());
        o.addProperty("spell", sa != null && sa.isSpell());
        o.addProperty("trigger", si != null && si.isTrigger());
        o.addProperty("stack", event.stackIndex());
        final JsonArray targets = new JsonArray();
        if (si != null) {
            for (StackItemView s = si; s != null; s = s.getSubInstance()) {
                if (s.getTargetCards() != null) {
                    for (final CardView c : s.getTargetCards()) {
                        targets.add(TraceRefs.entity(c));
                    }
                }
                if (s.getTargetPlayers() != null) {
                    for (final PlayerView p : s.getTargetPlayers()) {
                        targets.add(TraceRefs.entity(p));
                    }
                }
            }
        }
        o.add("targets", targets);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSpellResolved event) {
        final JsonObject o = event("resolve");
        card(o, "card", event.spell() == null ? null : event.spell().getHostCard(), true);
        o.addProperty("fizzled", event.hasFizzled());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSpellRemovedFromStack event) {
        final JsonObject o = event("unstack");
        card(o, "card", event.sa() == null ? null : event.sa().getHostCard(), true);
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSprocketUpdate event) {
        final JsonObject o = event("sprocket");
        card(o, "card", event.contraption(), false);
        o.addProperty("from", event.oldSprocket());
        o.addProperty("to", event.sprocket());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSubgameStart event) {
        return event("subgameStart");
    }

    @Override
    public JsonObject visit(final GameEventSubgameEnd event) {
        return event("subgameEnd");
    }

    @Override
    public JsonObject visit(final GameEventSurveil event) {
        final JsonObject o = event("surveil");
        player(o, "player", event.player());
        o.addProperty("library", event.toLibrary());
        o.addProperty("graveyard", event.toGraveyard());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventTokenCreated event) {
        return event("token");
    }

    @Override
    public JsonObject visit(final GameEventTurnBegan event) {
        final JsonObject o = event("turn");
        player(o, "player", event.turnOwner());
        o.addProperty("turn", event.turnNumber());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventTurnEnded event) {
        return event("turnEnded");
    }

    @Override
    public JsonObject visit(final GameEventTurnPhase event) {
        final JsonObject o = event("phase");
        player(o, "player", event.playerTurn());
        o.addProperty("phase", event.phase() == null ? null : event.phase().name());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventZone event) {
        final JsonObject o = event("zone");
        o.addProperty("zone", event.zoneType() == null ? null : event.zoneType().name());
        player(o, "player", event.player());
        o.addProperty("mode", event.mode() == null ? null : event.mode().name());
        o.addProperty("card", TraceRefs.id(event.card()));
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardForetold event) {
        final JsonObject o = event("foretold");
        player(o, "player", event.activatingPlayer());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventCardPlotted event) {
        final JsonObject o = event("plotted");
        card(o, "card", event.card(), false);
        player(o, "player", event.activatingPlayer());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventDayTimeChanged event) {
        final JsonObject o = event("dayTime");
        o.addProperty("day", event.daytime());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventDoorChanged event) {
        final JsonObject o = event("door");
        card(o, "card", event.card(), false);
        player(o, "player", event.activatingPlayer());
        o.addProperty("state", event.state() == null ? null : event.state().name());
        o.addProperty("unlock", event.unlock());
        return o;
    }

    @Override
    public JsonObject visit(final GameEventSnapshotRestored event) {
        final JsonObject o = event("snapshotRestored");
        o.addProperty("start", event.start());
        return o;
    }

    /** A line of Forge's game log: its kind and card, not its (translated) sentence. */
    @Override
    public JsonObject visit(final GameEventAddLog event) {
        final JsonObject o = event("log");
        o.addProperty("kind", event.type() == null ? null : event.type().name());
        o.addProperty("card", TraceRefs.id(event.sourceCard()));
        return o;
    }

    /** Player -> cards, both sorted by id. */
    private static JsonArray byPlayer(final Multimap<PlayerView, CardView> cards) {
        final Map<Integer, Collection<CardView>> sorted = new TreeMap<>();
        if (cards != null) {
            for (final Map.Entry<PlayerView, Collection<CardView>> e : cards.asMap().entrySet()) {
                sorted.put(e.getKey() == null ? -1 : e.getKey().getId(), e.getValue());
            }
        }
        final JsonArray a = new JsonArray();
        sorted.forEach((player, list) -> {
            final JsonObject o = new JsonObject();
            o.addProperty("player", player);
            o.add("cards", TraceRefs.sortedIds(list));
            a.add(o);
        });
        return a;
    }
}

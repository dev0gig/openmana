package org.openmana.engine.bridge;

import com.google.common.collect.Multimap;
import com.google.common.eventbus.Subscribe;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.game.Game;
import forge.game.GameEntityView;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.event.GameEvent;
import forge.game.event.GameEventAttackersDeclared;
import forge.game.event.GameEventBlockersDeclared;
import forge.game.event.GameEventCardChangeZone;
import forge.game.event.GameEventCardDamaged;
import forge.game.event.GameEventLandPlayed;
import forge.game.event.GameEventPlayerDamaged;
import forge.game.event.GameEventPlayerLivesChanged;
import forge.game.event.GameEventSpellAbilityCast;
import forge.game.event.GameEventSpellResolved;
import forge.game.event.GameEventTurnBegan;
import forge.game.event.GameEventTurnEnded;
import forge.game.event.IGameEventVisitor;
import forge.game.phase.PhaseHandler;
import forge.game.phase.PhaseType;
import forge.game.player.Player;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.SpellAbilityView;
import forge.game.spellability.StackItemView;
import forge.game.zone.MagicStack;
import forge.game.zone.ZoneView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Forge's public actions of a game, collected from Forge's own game events
 * (protocol 10, prompt 48): turn begin and end, land played, spell cast,
 * ability activated, trigger put on the stack, attackers and blockers
 * declared, a resolution and combat damage with what they publicly did.
 *
 * <p>It only listens: Forge's event bus calls it on the game thread, it reads
 * the events' views and Forge's stack and phase, and it never waits, sends
 * or decides anything. The bridge takes the collected actions at stable
 * points ({@link #drain()}) and sends them as one observation.
 *
 * <p>Only what the player may see: a card is a full view only if Forge lets
 * the player see it at that moment (the bridge's {@code mayView}), otherwise
 * hidden; a card that moves into a zone the player cannot see is left out of
 * the results. Nothing is read from Forge's prose (log lines, descriptions).
 *
 * <p>How results are grouped: the events of a resolution (from the first
 * event while Forge resolves a stack item to its next action) and of combat
 * damage belong to that action, including the state-based actions Forge
 * checks before the next priority (a creature dying of the damage). Results
 * outside such an action - the costs of a spell, the land moving onto the
 * battlefield when it is played - are part of the action itself or of the
 * state and are not repeated. Every action is reported exactly once; a
 * resolution that is sent in its middle (Forge asks the player during it)
 * goes on as a new action marked {@code continued}.
 */
final class ObservationLog {

    /** Kinds of results-collecting actions. */
    private static final String RESOLVE = "resolve";
    private static final String COMBAT_DAMAGE = "combatDamage";

    private final BridgeGuiGame gui;
    private final StateBuilder cards;
    private final Visitor visitor = new Visitor();
    private Game game;

    /** Actions not sent yet, in Forge's order. */
    private final List<JsonObject> pending = new ArrayList<>();
    /** The action collecting results now (resolve or combatDamage), or null. */
    private JsonObject open;
    /** What {@link #open} belongs to: the resolving stack item's id, or the combat damage step. */
    private String openKey;
    /** The open action went out with an observation; further results start a continued action. */
    private boolean openSent;
    /**
     * The combat damage step whose damage was sent: combat damage is dealt
     * before the step's first priority, so nothing later in that step is.
     */
    private String sentCombatKey;
    private int nextNr = 1;
    private RuntimeException failure;

    ObservationLog(final BridgeGuiGame gui, final StateBuilder cards) {
        this.gui = gui;
        this.cards = cards;
    }

    /** Starts listening to the game's events (when Forge opens the view, before the mulligans). */
    void attach(final Game game0) {
        if (game != null) {
            throw new IllegalStateException("the observation log is already attached to a game");
        }
        game = game0;
        game.subscribeToEvents(this);
    }

    /**
     * Forge's event bus calls this for every game event, on the game thread.
     * The bus would swallow an exception (Guava only logs it), so a failure is
     * kept and thrown when the bridge next takes the actions.
     */
    @Subscribe
    public void receive(final GameEvent event) {
        if (failure != null) {
            return;
        }
        try {
            event.visit(visitor);
        } catch (final RuntimeException e) {
            failure = new IllegalStateException("the observation log failed on " + event.getClass().getSimpleName() + ": " + e, e);
        }
    }

    /** Whether actions wait to be sent. */
    boolean hasPending() {
        checkHealthy();
        return !pending.isEmpty();
    }

    /**
     * The actions since the last call, in Forge's order. After this, an open
     * resolution that is still resolving (Forge asks the player in its
     * middle) continues as a new action; anything else is complete.
     */
    List<JsonObject> drain() {
        checkHealthy();
        final List<JsonObject> actions = new ArrayList<>(pending);
        pending.clear();
        final String now = currentKey();
        if (now != null && now.startsWith("combat:")) {
            sentCombatKey = now;
        }
        if (open != null) {
            if (openKey.startsWith("resolve:") && openKey.equals(now)) {
                // Forge asks the player in the middle of this resolution.
                openSent = true;
            } else {
                closeOpen();
            }
        }
        return actions;
    }

    /**
     * Whether a hold at this observation is worth it (ObservationMode hold): it
     * contains an action of anyone but the player, a turn begin or end, or
     * combat damage. The player's own lands, spells and their resolution are
     * their own inputs and need no stop.
     */
    static boolean holds(final List<JsonObject> actions, final PlayerView me) {
        for (final JsonObject a : actions) {
            final String kind = a.get("kind").getAsString();
            if ("turn".equals(kind) || "turnEnd".equals(kind) || COMBAT_DAMAGE.equals(kind)) {
                return true;
            }
            final boolean mine = me != null && a.get("player").isJsonPrimitive() && a.get("player").getAsInt() == me.getId();
            if (!mine) {
                return true;
            }
        }
        return false;
    }

    private void checkHealthy() {
        if (failure != null) {
            throw failure;
        }
    }

    /** The resolving stack item's key, else the combat damage step's, else null. */
    private String currentKey() {
        if (game == null) {
            return null;
        }
        final MagicStack stack = game.getStack();
        if (stack.isResolving()) {
            if (stack.isEmpty()) {
                // Forge took the item off the stack and finishes its resolution: still the open one.
                return openKey != null && openKey.startsWith("resolve:") ? openKey : null;
            }
            final SpellAbility sa = stack.peekAbility();
            return sa == null ? null : "resolve:" + sa.getId();
        }
        final PhaseHandler ph = game.getPhaseHandler();
        final PhaseType phase = ph.getPhase();
        if (phase == PhaseType.COMBAT_DAMAGE || phase == PhaseType.COMBAT_FIRST_STRIKE_DAMAGE) {
            return "combat:" + ph.getTurn() + ":" + phase.name();
        }
        return null;
    }

    // ── Actions ─────────────────────────────────────────────────────────────────

    private JsonObject action(final String kind, final Integer player) {
        closeOpen();
        final JsonObject a = new JsonObject();
        a.addProperty("n", nextNr++);
        a.addProperty("kind", kind);
        a.addProperty("player", player);
        pending.add(a);
        return a;
    }

    private void closeOpen() {
        open = null;
        openKey = null;
        openSent = false;
    }

    /**
     * The action that collects the results of the resolution or combat damage
     * going on now; null if none does (the event belongs to another action or
     * to none). {@code opens}: damage and life changes open the combat damage
     * action; a card moving in the combat damage step does not (it may be a
     * creature dying of it, which belongs to an action opened already).
     */
    private JsonObject resultsAction(final boolean opens) {
        String key = currentKey();
        if (key != null && key.equals(sentCombatKey)) {
            key = null;
        }
        if (key == null || (key.startsWith("combat:") && !opens && !key.equals(openKey))) {
            // Outside a resolution and the combat damage results belong to the
            // open action up to the next action (state-based actions).
            return open != null && !openSent ? open : null;
        }
        boolean continued = false;
        if (open != null && key.equals(openKey)) {
            if (!openSent) {
                return open;
            }
            continued = true;
        }
        final JsonObject a = key.startsWith("resolve:")
                ? resolveAction(game.getStack().isEmpty() ? null : game.getStack().peekAbility()) : combatDamageAction();
        if (continued) {
            a.addProperty("continued", true);
        }
        open = a;
        openKey = key;
        openSent = false;
        return open;
    }

    private JsonObject resolveAction(final SpellAbility sa) {
        final JsonObject a = action(RESOLVE, playerId(sa == null ? null : sa.getActivatingPlayer()));
        final Card host = sa == null ? null : sa.getHostCard();
        a.add("card", host == null ? com.google.gson.JsonNull.INSTANCE : card(CardView.get(host)));
        a.addProperty("stack", sa == null || sa.isSpell() ? "spell" : sa.isTrigger() ? "trigger" : "ability");
        a.addProperty("fizzled", false);
        a.add("results", results());
        return a;
    }

    private JsonObject combatDamageAction() {
        final JsonObject a = action(COMBAT_DAMAGE, playerId(game.getPhaseHandler().getPlayerTurn()));
        a.add("results", results());
        return a;
    }

    private static JsonObject results() {
        final JsonObject r = new JsonObject();
        r.add("moves", new JsonArray());
        r.add("damage", new JsonArray());
        r.add("life", new JsonArray());
        return r;
    }

    // ── Views ───────────────────────────────────────────────────────────────────

    /** A card as Forge shows it to the player now, or hidden; never Forge's markers of what can be done. */
    private JsonObject card(final CardView c) {
        if (c == null || !gui.mayViewNow(c)) {
            final JsonObject hidden = new JsonObject();
            hidden.addProperty("hidden", true);
            return hidden;
        }
        return cards.publicCard(c);
    }

    private static Integer playerId(final Player p) {
        return p == null ? null : p.getId();
    }

    private static Integer playerId(final PlayerView p) {
        return p == null ? null : p.getId();
    }

    /** A card or player the player may see, or null. */
    private JsonObject entity(final GameEntityView e) {
        if (e == null) {
            return null;
        }
        final JsonObject o = new JsonObject();
        if (e instanceof PlayerView p) {
            o.addProperty("kind", "player");
            o.addProperty("id", p.getId());
            return o;
        }
        if (e instanceof CardView c && !gui.mayViewNow(c)) {
            return null;
        }
        o.addProperty("kind", "card");
        o.addProperty("id", e.getId());
        return o;
    }

    private static JsonObject zone(final ZoneView z) {
        if (z == null || z.zoneType() == null) {
            return null;
        }
        final JsonObject o = new JsonObject();
        final String name = switch (z.zoneType()) {
            case Battlefield, Hand, Graveyard, Exile, Command, Library, Stack -> z.zoneType().name().toLowerCase(Locale.ROOT);
            default -> "other";
        };
        o.addProperty("zone", name);
        o.addProperty("player", playerId(z.player()));
        return o;
    }

    private static void addZone(final JsonObject o, final String field, final ZoneView z) {
        final JsonObject zone = zone(z);
        if (zone == null) {
            o.add(field, com.google.gson.JsonNull.INSTANCE);
        } else {
            o.add(field, zone);
        }
    }

    // ── Forge's events ──────────────────────────────────────────────────────────

    private final class Visitor extends IGameEventVisitor.Base<Void> {

        @Override
        public Void visit(final GameEventTurnBegan event) {
            final JsonObject a = action("turn", playerId(event.turnOwner()));
            a.addProperty("turn", event.turnNumber());
            return null;
        }

        @Override
        public Void visit(final GameEventTurnEnded event) {
            final PhaseHandler ph = game.getPhaseHandler();
            final JsonObject a = action("turnEnd", playerId(ph.getPlayerTurn()));
            a.addProperty("turn", ph.getTurn());
            return null;
        }

        @Override
        public Void visit(final GameEventLandPlayed event) {
            final JsonObject a = action("land", playerId(event.player()));
            a.add("card", card(event.land()));
            return null;
        }

        /** Cast, activate or trigger: Forge put a spell or ability on the stack. */
        @Override
        public Void visit(final GameEventSpellAbilityCast event) {
            final SpellAbilityView sa = event.sa();
            final StackItemView si = event.si();
            final String kind = sa != null && sa.isSpell() ? "cast" : si != null && si.isTrigger() ? "trigger" : "activate";
            final JsonObject a = action(kind, playerId(si == null ? null : si.getActivatingPlayer()));
            final CardView host = sa == null ? null : sa.getHostCard();
            a.add("card", host == null ? com.google.gson.JsonNull.INSTANCE : card(host));
            final JsonArray targets = new JsonArray();
            for (StackItemView s = si; s != null; s = s.getSubInstance()) {
                if (s.getTargetCards() != null) {
                    for (final CardView c : s.getTargetCards()) {
                        final JsonObject t = entity(c);
                        if (t != null) {
                            targets.add(t);
                        }
                    }
                }
                if (s.getTargetPlayers() != null) {
                    for (final PlayerView p : s.getTargetPlayers()) {
                        targets.add(entity(p));
                    }
                }
            }
            a.add("targets", targets);
            return null;
        }

        /** Attackers by id; Forge hands them over in a hash multimap. */
        @Override
        public Void visit(final GameEventAttackersDeclared event) {
            final Multimap<GameEntityView, CardView> map = event.attackersMap();
            if (map == null || map.isEmpty()) {
                return null;
            }
            final Map<Integer, JsonObject> byAttacker = new TreeMap<>();
            for (final Map.Entry<GameEntityView, CardView> e : map.entries()) {
                final JsonObject attack = new JsonObject();
                attack.add("attacker", card(e.getValue()));
                final JsonObject defender = entity(e.getKey());
                attack.add("defender", defender == null ? com.google.gson.JsonNull.INSTANCE : defender);
                byAttacker.put(e.getValue().getId(), attack);
            }
            final JsonObject a = action("attack", playerId(event.player()));
            final JsonArray attacks = new JsonArray();
            byAttacker.values().forEach(attacks::add);
            a.add("attacks", attacks);
            return null;
        }

        /**
         * Forge's map: defender -> attacker -> blockers, an unblocked attacker
         * listed with itself (PhaseHandler.declareBlockersTurnBasedAction).
         */
        @Override
        public Void visit(final GameEventBlockersDeclared event) {
            final Map<Integer, List<CardView>> byAttacker = new TreeMap<>();
            if (event.blockers() != null) {
                for (final Multimap<CardView, CardView> blocks : event.blockers().values()) {
                    for (final Map.Entry<CardView, CardView> e : blocks.entries()) {
                        final List<CardView> blockers = byAttacker.computeIfAbsent(e.getKey().getId(), k -> new ArrayList<>());
                        if (!e.getValue().equals(e.getKey())) {
                            blockers.add(e.getValue());
                        }
                    }
                }
            }
            if (byAttacker.isEmpty()) {
                return null;
            }
            final JsonObject a = action("block", playerId(event.defendingPlayer()));
            final JsonArray blocks = new JsonArray();
            byAttacker.forEach((attacker, blockers) -> {
                blockers.sort(java.util.Comparator.comparingInt(CardView::getId));
                final JsonObject b = new JsonObject();
                b.addProperty("attacker", attacker);
                final JsonArray list = new JsonArray();
                for (final CardView c : blockers) {
                    list.add(card(c));
                }
                b.add("blockers", list);
                blocks.add(b);
            });
            a.add("blocks", blocks);
            return null;
        }

        /** The end of a resolution: its action exists from its first result, or is made now. */
        @Override
        public Void visit(final GameEventSpellResolved event) {
            final JsonObject a = resultsAction(false);
            if (a != null && RESOLVE.equals(a.get("kind").getAsString()) && event.hasFizzled() && !openSent) {
                a.addProperty("fizzled", true);
            }
            return null;
        }

        @Override
        public Void visit(final GameEventCardChangeZone event) {
            final CardView c = event.card();
            if (c == null || !gui.mayViewNow(c)) {
                return null;
            }
            final JsonObject a = resultsAction(false);
            if (a == null) {
                return null;
            }
            final JsonObject move = new JsonObject();
            move.add("card", cards.publicCard(c));
            addZone(move, "from", event.from());
            addZone(move, "to", event.to());
            a.getAsJsonObject("results").getAsJsonArray("moves").add(move);
            return null;
        }

        @Override
        public Void visit(final GameEventCardDamaged event) {
            final JsonObject target = entity(event.card());
            if (target == null) {
                return null;
            }
            damage(target, event.source(), event.amount());
            return null;
        }

        @Override
        public Void visit(final GameEventPlayerDamaged event) {
            damage(entity(event.target()), event.source(), event.amount());
            return null;
        }

        private void damage(final JsonObject target, final CardView source, final int amount) {
            final JsonObject a = resultsAction(true);
            if (a == null || target == null) {
                return;
            }
            final JsonObject d = new JsonObject();
            d.add("target", target);
            d.addProperty("amount", amount);
            d.addProperty("source", source != null && gui.mayViewNow(source) ? source.getId() : null);
            a.getAsJsonObject("results").getAsJsonArray("damage").add(d);
        }

        @Override
        public Void visit(final GameEventPlayerLivesChanged event) {
            final JsonObject a = resultsAction(true);
            if (a == null || event.player() == null) {
                return null;
            }
            final JsonObject l = new JsonObject();
            l.addProperty("player", event.player().getId());
            l.addProperty("from", event.oldLives());
            l.addProperty("to", event.newLives());
            a.getAsJsonObject("results").getAsJsonArray("life").add(l);
            return null;
        }
    }
}

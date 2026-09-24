package org.openmana.engine.trace;

import com.google.common.collect.Multiset;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.card.CardStateName;
import forge.card.MagicColor;
import forge.game.Game;
import forge.game.GameEntity;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.card.CounterType;
import forge.game.combat.Combat;
import forge.game.phase.PhaseHandler;
import forge.game.player.Player;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.SpellAbilityStackInstance;
import forge.game.spellability.TargetChoices;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.AbstractGuiGame;

import java.util.Collection;
import java.util.Map;
import java.util.TreeMap;

/**
 * The complete state of a game at one point of the engine trace, read from
 * Forge's model (not from the views a UI gets): every zone of every player
 * including the library order and the hidden hand of the AI, the stack with
 * targets, combat, and for a human seat the markers Forge set for the GUI and
 * the questions that are open. Ids, English card keys (Forge's oracle names),
 * enum names and numbers only - no display text, so the snapshot is the same
 * in every language.
 *
 * <p>Engine tests only: it contains hidden information and never goes to a
 * player. Reading has no side effects on the game (the traced game plays
 * exactly like the untraced one; EngineTraceTest checks it).
 */
final class TraceSnapshot {

    private static final ZoneType[] CARD_ZONES = {ZoneType.Hand, ZoneType.Graveyard, ZoneType.Exile, ZoneType.Command};
    private static final String[] CARD_ZONE_NAMES = {"hand", "graveyard", "exile", "command"};

    private TraceSnapshot() {
    }

    /**
     * @param gui       the human seat's GUI, or null (AI-only games)
     * @param questions the open questions (structural form, see EngineTrace), or null
     */
    static JsonObject of(final Game game, final AbstractGuiGame gui, final Collection<JsonObject> questions) {
        final JsonObject o = new JsonObject();
        final PhaseHandler ph = game.getPhaseHandler();
        o.addProperty("turn", ph.getTurn());
        o.addProperty("phase", ph.getPhase() == null ? null : ph.getPhase().name());
        o.addProperty("active", TraceRefs.id(ph.getPlayerTurn()));
        o.addProperty("priority", TraceRefs.id(ph.getPriorityPlayer()));
        if (gui != null) {
            o.addProperty("human", TraceRefs.id(gui.getCurrentPlayer()));
        }
        final JsonArray players = new JsonArray();
        for (final Player p : game.getRegisteredPlayers()) {
            players.add(player(game, p));
        }
        o.add("players", players);
        o.add("stack", stack(game));
        o.add("combat", combat(game.getCombat()));
        if (gui != null) {
            o.add("gui", markers(game, gui));
        }
        if (questions != null) {
            final JsonArray open = new JsonArray();
            questions.forEach(q -> open.add(q.deepCopy()));
            o.add("questions", open);
        }
        return o;
    }

    private static JsonObject player(final Game game, final Player p) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", p.getId());
        o.addProperty("life", p.getLife());
        o.addProperty("lost", p.hasLost());
        o.add("counters", counters(p.getCounters()));
        o.add("mana", mana(p));
        o.addProperty("lands", p.getLandsPlayedThisTurn());
        // The library in order, ids only: a card's key shows once it is drawn.
        o.add("library", TraceRefs.cardIds(p.getZone(ZoneType.Library).getCards()));
        for (int i = 0; i < CARD_ZONES.length; i++) {
            final JsonArray cards = new JsonArray();
            for (final Card c : p.getZone(CARD_ZONES[i]).getCards()) {
                cards.add(cardRef(c));
            }
            o.add(CARD_ZONE_NAMES[i], cards);
        }
        final JsonArray battlefield = new JsonArray();
        // getCards(false): phased-out permanents are still on the battlefield
        for (final Card c : p.getZone(ZoneType.Battlefield).getCards(false)) {
            battlefield.add(permanent(c, p));
        }
        o.add("battlefield", battlefield);
        if (!p.getCommanders().isEmpty()) {
            final JsonArray commanders = new JsonArray();
            for (final Card c : p.getCommanders()) {
                final JsonObject cmd = new JsonObject();
                cmd.addProperty("card", c.getId());
                cmd.addProperty("cast", p.getCommanderCast(c));
                final JsonObject damage = new JsonObject();
                for (final Player q : game.getRegisteredPlayers()) {
                    final int dealt = q.getCommanderDamage(c);
                    if (dealt > 0) {
                        damage.addProperty(String.valueOf(q.getId()), dealt);
                    }
                }
                cmd.add("damage", damage);
                commanders.add(cmd);
            }
            o.add("commanders", commanders);
        }
        return o;
    }

    /** A card outside the battlefield: identity and the face it shows. */
    private static JsonObject cardRef(final Card c) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", c.getId());
        o.addProperty("key", c.getName());
        state(o, c);
        return o;
    }

    /** A permanent with everything that can change on the battlefield. */
    private static JsonObject permanent(final Card c, final Player zoneOwner) {
        final JsonObject o = cardRef(c);
        if (c.getOwner() != zoneOwner) {
            o.addProperty("owner", TraceRefs.id(c.getOwner()));
        }
        if (c.isTapped()) {
            o.addProperty("tapped", true);
        }
        if (c.isSick()) {
            o.addProperty("sick", true);
        }
        if (c.getDamage() != 0) {
            o.addProperty("damage", c.getDamage());
        }
        final JsonObject counters = counters(c.getCounters());
        if (counters.size() > 0) {
            o.add("counters", counters);
        }
        if (c.isCreature()) {
            o.addProperty("power", c.getNetPower());
            o.addProperty("toughness", c.getNetToughness());
        }
        if (c.isPlaneswalker()) {
            o.addProperty("loyalty", c.getCurrentLoyalty());
        }
        if (c.isBattle()) {
            o.addProperty("defense", c.getCurrentDefense());
        }
        final GameEntity attachedTo = c.getEntityAttachedTo();
        if (attachedTo != null) {
            o.addProperty("attachedTo", TraceRefs.entity(attachedTo));
        }
        if (c.isPhasedOut()) {
            o.addProperty("phasedOut", true);
        }
        return o;
    }

    private static void state(final JsonObject o, final Card c) {
        final CardStateName state = c.getCurrentStateName();
        if (state != null && state != CardStateName.Original) {
            o.addProperty("state", state.name());
        }
        if (c.isToken()) {
            o.addProperty("token", true);
        }
        if (c.isFaceDown()) {
            o.addProperty("faceDown", true);
        }
    }

    /** Top of the stack first: source card, who, what kind of effect (Forge's ApiType), targets. */
    private static JsonArray stack(final Game game) {
        final JsonArray a = new JsonArray();
        for (final SpellAbilityStackInstance si : game.getStack()) {
            final SpellAbility sa = si.getSpellAbility();
            final JsonObject o = new JsonObject();
            final Card source = si.getSourceCard();
            o.addProperty("card", TraceRefs.id(source));
            o.addProperty("key", source == null ? null : source.getName());
            o.addProperty("player", TraceRefs.id(si.getActivatingPlayer()));
            o.addProperty("api", sa == null || sa.getApi() == null ? null : sa.getApi().name());
            o.addProperty("spell", si.isSpell());
            o.addProperty("trigger", si.isTrigger());
            final JsonArray targets = new JsonArray();
            for (SpellAbility s = sa; s != null; s = s.getSubAbility()) {
                final TargetChoices t = s.getTargets();
                if (t == null) {
                    continue;
                }
                for (final Card c : t.getTargetCards()) {
                    targets.add(TraceRefs.entity(c));
                }
                for (final Player p : t.getTargetPlayers()) {
                    targets.add(TraceRefs.entity(p));
                }
                for (final SpellAbility spell : t.getTargetSpells()) {
                    targets.add("s" + (spell.getHostCard() == null ? "?" : spell.getHostCard().getId()));
                }
            }
            o.add("targets", targets);
            a.add(o);
        }
        return a;
    }

    private static JsonArray combat(final Combat combat) {
        final JsonArray a = new JsonArray();
        if (combat == null) {
            return a;
        }
        for (final Card attacker : combat.getAttackers()) {
            final JsonObject o = new JsonObject();
            o.addProperty("attacker", attacker.getId());
            o.addProperty("defender", TraceRefs.entity(combat.getDefenderByAttacker(attacker)));
            o.add("blockers", TraceRefs.cardIds(combat.getBlockers(attacker)));
            a.add(o);
        }
        return a;
    }

    /**
     * What Forge marked for the human seat's GUI: playable (weakly
     * selectable), highlighted, selectable. Ids in the order of the players'
     * zones. These are look-ups in the GUI's own sets. What a tap would do
     * (the state's "action") is deliberately not traced: Forge computes it
     * through SpellAbilityRestriction.canPlay, which sets a missing
     * activating player as a side effect - asking for every card at every
     * checkpoint could change the game the trace is meant to describe.
     */
    private static JsonObject markers(final Game game, final AbstractGuiGame gui) {
        final JsonArray playable = new JsonArray();
        final JsonArray highlighted = new JsonArray();
        final JsonArray selectable = new JsonArray();
        for (final Player p : game.getRegisteredPlayers()) {
            for (final ZoneType zone : new ZoneType[]{ZoneType.Battlefield, ZoneType.Hand, ZoneType.Command,
                    ZoneType.Graveyard, ZoneType.Exile}) {
                for (final Card c : zone == ZoneType.Battlefield ? p.getZone(zone).getCards(false) : p.getZone(zone).getCards()) {
                    final CardView v = c.getView();
                    if (gui.isWeaklySelectable(v)) {
                        playable.add(c.getId());
                    }
                    if (gui.isHighlighted(v)) {
                        highlighted.add(c.getId());
                    }
                    if (gui.isSelectable(v)) {
                        selectable.add(c.getId());
                    }
                }
            }
        }
        final JsonObject o = new JsonObject();
        o.add("playable", playable);
        o.add("highlighted", highlighted);
        o.add("selectable", selectable);
        return o;
    }

    private static JsonObject counters(final Multiset<CounterType> counters) {
        final Map<String, Integer> sorted = new TreeMap<>();
        if (counters != null) {
            for (final Multiset.Entry<CounterType> e : counters.entrySet()) {
                if (e.getCount() != 0) {
                    sorted.put(e.getElement().getName(), e.getCount());
                }
            }
        }
        final JsonObject o = new JsonObject();
        sorted.forEach(o::addProperty);
        return o;
    }

    /** Mana in the pool, only colours with an amount. */
    private static JsonObject mana(final Player p) {
        final JsonObject o = new JsonObject();
        final String[] letters = {"W", "U", "B", "R", "G", "C"};
        final byte[] colors = MagicColor.WUBRGC;
        for (int i = 0; i < colors.length; i++) {
            final int amount = p.getManaPool().getAmountOfColor(colors[i]);
            if (amount != 0) {
                o.addProperty(letters[i], amount);
            }
        }
        return o;
    }
}

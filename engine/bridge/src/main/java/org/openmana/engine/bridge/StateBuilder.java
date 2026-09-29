package org.openmana.engine.bridge;

import com.google.common.collect.Multiset;
import com.google.gson.JsonArray;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import forge.card.ColorSet;
import forge.card.MagicColor;
import forge.game.GameEntityView;
import forge.game.GameView;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.card.CardView.CardStateView;
import forge.game.card.CounterType;
import forge.game.combat.CombatView;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbility;
import forge.game.spellability.StackItemView;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.AbstractGuiGame;
import forge.gamemodes.match.input.Input;
import forge.gamemodes.match.input.InputPassPriority;
import forge.gamemodes.match.input.InputPayMana;
import forge.gamemodes.match.input.InputQueue;
import forge.interfaces.IGameController;
import forge.player.PlayerControllerHuman;
import forge.util.CardTranslation;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Builds the complete game state as JSON from Forge's {@link GameView}.
 *
 * <p>Adapted from Anvil's {@code AnvilZustand} (dev0gig/forge, forge-anvil),
 * field names in English. Always a full snapshot, never a diff (Anvil lesson:
 * robust, and every recording is a replayable game).
 *
 * <p>Nothing here evaluates a card name, a mechanic or a rule. It copies what
 * Forge says: visibility comes from {@code mayView}, playability from Forge's
 * actionable highlights, what a tap would do from the running input, combat
 * pairings from {@link CombatView}, the stack from Forge's stack views.
 *
 * <p>Looking must not change the game: the only query here with a side effect
 * on Forge's objects (what a tap would do, during priority and payment) is
 * asked only where Forge's own highlights or the player's own cards need it
 * (see {@link #asksChangeTheGame()}).
 */
final class StateBuilder {

    private static final ZoneType[] VISIBLE_ZONES = {
        ZoneType.Battlefield, ZoneType.Hand, ZoneType.Graveyard, ZoneType.Exile, ZoneType.Command,
    };
    private static final String[] ZONE_NAMES = {"battlefield", "hand", "graveyard", "exile", "command"};

    /** Rules text only where it is read, to keep snapshots small. */
    private static final Set<ZoneType> WITH_TEXT = EnumSet.of(ZoneType.Battlefield, ZoneType.Command);

    private final AbstractGuiGame gui;
    private long sequence;

    StateBuilder(final AbstractGuiGame gui) {
        this.gui = gui;
    }

    /**
     * The complete state, or null while Forge has no game view yet (there is
     * nothing to show, and the contract has no partial snapshot).
     */
    JsonObject build() {
        final GameView game = gui.getGameView();
        if (game == null) {
            return null;
        }
        final JsonObject o = new JsonObject();
        o.addProperty("type", Protocol.STATE);
        o.addProperty("seq", ++sequence);
        o.addProperty("running", !game.isGameOver());
        o.addProperty("turn", game.getTurn());
        o.addProperty("phase", game.getPhase() == null ? null : game.getPhase().name());
        o.addProperty("activePlayer", id(game.getPlayerTurn()));
        final PlayerView me = gui.getCurrentPlayer();
        o.addProperty("me", id(me));

        final JsonArray players = new JsonArray();
        for (final PlayerView p : game.getPlayers()) {
            players.add(player(game, p, me));
        }
        o.add("players", players);
        o.add("stack", stack(game));
        o.add("combat", combat(game.getCombat()));
        // The payment in progress, asked of Forge's payment input (protocol 6).
        final JsonObject payment = RunningInput.payment(gui.getGameController());
        if (payment != null) {
            o.add("payment", payment);
        }
        // The declaration of attackers in progress, asked of Forge's attack input (protocol 7).
        final JsonObject attack = RunningInput.attack(gui.getGameController());
        if (attack != null) {
            o.add("attack", attack);
        }
        return o;
    }

    private JsonObject player(final GameView game, final PlayerView p, final PlayerView me) {
        final JsonObject o = new JsonObject();
        o.addProperty("id", id(p));
        o.addProperty("name", p.getLobbyPlayerName());
        o.addProperty("ai", p.isAI());
        o.addProperty("me", p.equals(me));
        o.addProperty("life", p.getLife());
        o.addProperty("hasPriority", p.getHasPriority());
        // Whether anything can be done at all is computed by FORGE
        // (AvailableActions); needs YIELD_AUTO_PASS_NO_ACTIONS (Anvil lesson).
        o.addProperty("canAct", p.hasAvailableActions());
        // Whether a tap on this player would do something now: asked of
        // Forge's running input (protocol 6, RunningInput), like a card's action.
        if (RunningInput.selectable(gui.getGameController(), p)) {
            o.addProperty("selectable", true);
        }
        // Forge's highlight on a player: a target chosen so far.
        if (gui.isHighlighted(p)) {
            o.addProperty("highlighted", true);
        }
        o.addProperty("lost", p.getHasLost());
        o.addProperty("maxHandSize", p.getMaxHandSize());
        o.addProperty("landsPlayed", p.getNumLandThisTurn());
        o.addProperty("landsAllowed", p.getMaxLandPlay());
        o.add("counters", counters(p.getCounters()));
        o.add("mana", mana(p));

        final JsonObject zones = new JsonObject();
        for (int i = 0; i < VISIBLE_ZONES.length; i++) {
            final ZoneType zone = VISIBLE_ZONES[i];
            final JsonArray cards = new JsonArray();
            final Iterable<CardView> content = p.getCards(zone);
            if (content != null) {
                for (final CardView c : content) {
                    cards.add(card(c, WITH_TEXT.contains(zone) || (zone == ZoneType.Hand && p.equals(me))));
                }
            }
            zones.add(ZONE_NAMES[i], cards);
        }
        o.add("zones", zones);
        // The library is never sent as a list, only its size.
        o.addProperty("library", p.getZoneSize(ZoneType.Library));
        o.add("commanders", commanders(game, p));
        return o;
    }

    /**
     * Commanders with tax and dealt damage. The tax formula (2 per previous
     * cast) is Forge's (CostAdjustment); computing it here keeps it out of the
     * UI, as in Anvil. Outside Commander Forge returns no commanders.
     */
    private JsonArray commanders(final GameView game, final PlayerView p) {
        final JsonArray a = new JsonArray();
        final Iterable<CardView> own = p.getCommanders();
        if (own == null) {
            return a;
        }
        for (final CardView c : own) {
            final JsonObject o = new JsonObject();
            o.add("card", card(c, true));
            final int cast = p.getCommanderCast(c);
            o.addProperty("cast", cast);
            o.addProperty("tax", cast * 2);
            final JsonArray damage = new JsonArray();
            for (final PlayerView q : game.getPlayers()) {
                final int value = q.getCommanderDamage(c);
                if (value > 0) {
                    final JsonObject d = new JsonObject();
                    d.addProperty("player", id(q));
                    d.addProperty("amount", value);
                    damage.add(d);
                }
            }
            o.add("damage", damage);
            a.add(o);
        }
        return a;
    }

    private static JsonObject mana(final PlayerView p) {
        final JsonObject o = new JsonObject();
        o.addProperty("W", p.getMana(MagicColor.WHITE));
        o.addProperty("U", p.getMana(MagicColor.BLUE));
        o.addProperty("B", p.getMana(MagicColor.BLACK));
        o.addProperty("R", p.getMana(MagicColor.RED));
        o.addProperty("G", p.getMana(MagicColor.GREEN));
        o.addProperty("C", p.getMana(MagicColor.COLORLESS));
        return o;
    }

    private static JsonObject counters(final Multiset<CounterType> counters) {
        final JsonObject o = new JsonObject();
        if (counters != null) {
            for (final Multiset.Entry<CounterType> e : counters.entrySet()) {
                if (e.getCount() != 0) {
                    o.addProperty(e.getElement().getName(), e.getCount());
                }
            }
        }
        return o;
    }

    /**
     * One card. {@code key} is the English oracle name (stable identity for
     * Scryfall); {@code name}/{@code type}/{@code text} are Forge's display
     * texts in the engine's language.
     */
    JsonObject card(final CardView c, final boolean withText) {
        return card(c, withText, true);
    }

    /**
     * One card; {@code usable}: with Forge's markers of what can be done with
     * it now (playable, action, ways). Off for a card on the stack: the bridge
     * never taps one there (only cards in the player's zones).
     */
    private JsonObject card(final CardView c, final boolean withText, final boolean usable) {
        final JsonObject o = new JsonObject();
        if (c == null) {
            return o;
        }
        if (!mayView(c)) {
            // Only that there is a card. Not even its id: ids are handed out
            // in deck-list order, so an id would reveal the card (Anvil sent
            // it; Forge's own hidden ids exist only for face-down cards).
            o.addProperty("hidden", true);
            return o;
        }
        o.addProperty("id", c.getId());
        final CardStateView state = c.getCurrentState();
        if (state != null) {
            o.addProperty("key", state.getOracleName());
            o.addProperty("name", state.getTranslatedName());
            o.addProperty("typeLine", state.getType() == null ? null : CardTranslation.getTranslatedType(state));
            // Only what the card really has: Forge reports "no cost" and 0/0
            // for lands otherwise (Anvil, 27.8.2026).
            if (state.getManaCost() != null && !state.getManaCost().isNoCost()) {
                o.addProperty("cost", state.getManaCost().toString());
            }
            o.addProperty("set", state.getSetCode());
            if (state.isCreature() || state.hasPrintedPT()) {
                o.addProperty("power", state.getPower());
                o.addProperty("toughness", state.getToughness());
            }
            if (state.isPlaneswalker()) {
                o.addProperty("loyalty", state.getLoyalty());
            }
            if (withText) {
                o.addProperty("text", CardTranslation.getTranslatedOracle(state));
            }
            colors(o, state);
        }
        o.addProperty("tapped", c.isTapped());
        o.addProperty("sick", c.isSick());
        o.addProperty("faceDown", c.isFaceDown());
        o.addProperty("damage", c.getDamage());
        o.addProperty("owner", id(c.getOwner()));
        o.addProperty("controller", id(c.getController()));
        if (c.isAttacking()) {
            o.addProperty("attacking", true);
        }
        if (c.isBlocking()) {
            o.addProperty("blocking", true);
        }
        if (c.isToken()) {
            o.addProperty("token", true);
        }
        if (c.isPhasedOut()) {
            o.addProperty("phasedOut", true);
        }
        // Forge's own marker: something can be done with this card now
        // (AvailableActions.collectActionable -> setWeaklySelectable).
        final boolean playable = usable && gui.isWeaklySelectable(c);
        if (playable) {
            o.addProperty("playable", true);
        }
        // What a tap on this card would do, in Forge's words, from the input
        // that is running right now. Absent = a tap would do nothing, except
        // in the two mulligan inputs, which never answer (Anvil lesson).
        final String action = usable && mayAskAction(c, playable) ? action(c) : null;
        if (action != null) {
            o.addProperty("action", action);
        }
        if (playable) {
            final JsonArray ways = ways(c);
            if (ways != null && ways.size() > 1) {
                o.add("ways", ways);
            }
        }
        // Forge's highlight: the London mulligan marks the cards to put back
        // only this way (it never calls setSelectables).
        if (gui.isHighlighted(c)) {
            o.addProperty("highlighted", true);
        }
        final JsonObject counters = counters(c.getCounters());
        if (counters.size() > 0) {
            o.add("counters", counters);
        }
        final CardView attachedTo = c.getAttachedTo();
        if (attachedTo != null) {
            o.addProperty("attachedTo", attachedTo.getId());
        }
        final List<CardView> attached = c.getAttachedCards();
        if (attached != null && !attached.isEmpty()) {
            final JsonArray a = new JsonArray();
            for (final CardView at : attached) {
                a.add(at.getId());
            }
            o.add("attached", a);
        }
        return o;
    }

    /**
     * Current colours if they differ from the printed ones. Careful, Forge's
     * names are swapped: getOriginalColors() is the CURRENT colour,
     * getColors() the printed one (Anvil, 29.8.2026).
     */
    private static void colors(final JsonObject o, final CardStateView state) {
        if (!state.hasChangeColors()) {
            return;
        }
        final String now = colorLetters(state.getOriginalColors());
        final String printed = colorLetters(state.getColors());
        if (now.isEmpty() || now.equals(printed)) {
            return;
        }
        o.addProperty("colors", now);
        o.addProperty("printedColors", printed);
    }

    private static String colorLetters(final ColorSet set) {
        if (set == null || set.isColorless()) {
            return "";
        }
        final StringBuilder sb = new StringBuilder(5);
        if (set.hasWhite()) sb.append('W');
        if (set.hasBlue()) sb.append('U');
        if (set.hasBlack()) sb.append('B');
        if (set.hasRed()) sb.append('R');
        if (set.hasGreen()) sb.append('G');
        return sb.toString();
    }

    /**
     * Whether asking what a tap on this card would do leaves Forge's game
     * alone. During priority and payment Forge answers by checking the card's
     * abilities for the player (InputPassPriority.getActivateAction ->
     * Card.getAllPossibleAbilities, InputPayMana -> getAllManaAbilities), and
     * both SET the player as the activating player of every ability they look
     * at - on the opponent's cards a change the AI later sees (prompt 05,
     * §7.2: a game changed that way). There only the player's own cards and
     * the cards Forge itself marks usable (e.g. a card the player may cast
     * from the opponent's exile) are asked. Every other input answers without
     * touching the game - there the opponent's cards must be asked (the
     * attacker a blocker is declared for, a planeswalker to attack).
     */
    private boolean mayAskAction(final CardView c, final boolean playable) {
        if (playable || !asksChangeTheGame()) {
            return true;
        }
        final PlayerView me = gui.getCurrentPlayer();
        return me != null && me.equals(c.getController());
    }

    /** The running input answers "what would a tap do" with a side effect on Forge's game (see mayAskAction). */
    private boolean asksChangeTheGame() {
        final IGameController controller = gui.getGameController();
        if (!(controller instanceof PlayerControllerHuman human)) {
            return false;
        }
        final InputQueue queue = human.getInputQueue();
        final Input input = queue == null ? null : queue.getInput();
        return input instanceof InputPassPriority || input instanceof InputPayMana;
    }

    private String action(final CardView c) {
        final IGameController controller = gui.getGameController();
        if (controller == null) {
            return null;
        }
        try {
            final String text = controller.getActivateDescription(c);
            return text == null || text.trim().isEmpty() ? null : text;
        } catch (final RuntimeException e) {
            return null;
        }
    }

    /** All ways Forge offers for this card (e.g. cast or ninjutsu); only for playable cards. */
    private JsonArray ways(final CardView c) {
        final IGameController controller = gui.getGameController();
        if (!(controller instanceof PlayerControllerHuman human)) {
            return null;
        }
        try {
            final Card card = human.getCard(c);
            if (card == null) {
                return null;
            }
            final JsonArray a = new JsonArray();
            for (final SpellAbility sa : card.getAllPossibleAbilities(human.getPlayer(), true)) {
                final String text = sa == null ? null : sa.toString();
                if (text != null && !text.trim().isEmpty()) {
                    a.add(text.trim());
                }
            }
            return a;
        } catch (final RuntimeException e) {
            return null;
        }
    }

    /** Visibility is Forge's decision (mayView); before the game has a controller everything is shown. */
    private boolean mayView(final CardView c) {
        try {
            return gui.getGameController() == null || gui.mayView(c);
        } catch (final RuntimeException e) {
            return false;
        }
    }

    /**
     * The stack, top first (Forge's order). Each item with its card as the
     * player may see it: a spell's own card lies on the stack, which is no
     * zone of the state, so without it the UI would have only Forge's words
     * (prompt 16). A hidden card leaves the engine without its id.
     */
    private JsonArray stack(final GameView game) {
        final JsonArray a = new JsonArray();
        if (game.getStack() == null) {
            return a;
        }
        for (final StackItemView s : game.getStack()) {
            final JsonObject o = new JsonObject();
            final CardView source = s.getSourceCard();
            o.addProperty("id", s.getId());
            o.addProperty("text", s.getText());
            o.addProperty("source", source != null && mayView(source) ? source.getId() : null);
            o.add("card", source == null ? JsonNull.INSTANCE : card(source, true, false));
            o.addProperty("player", id(s.getActivatingPlayer()));
            o.addProperty("ability", s.isAbility());
            o.addProperty("trigger", s.isTrigger());
            final JsonArray targets = new JsonArray();
            if (s.getTargetCards() != null) {
                for (final CardView c : s.getTargetCards()) {
                    final JsonObject t = new JsonObject();
                    t.addProperty("kind", "card");
                    t.addProperty("id", c.getId());
                    targets.add(t);
                }
            }
            if (s.getTargetPlayers() != null) {
                for (final PlayerView p : s.getTargetPlayers()) {
                    final JsonObject t = new JsonObject();
                    t.addProperty("kind", "player");
                    t.addProperty("id", p.getId());
                    targets.add(t);
                }
            }
            o.add("targets", targets);
            a.add(o);
        }
        return a;
    }

    /**
     * Attackers, their defender and blockers. While blockers are being
     * declared Forge only fills the planned blockers, hence the fallback
     * (Anvil, 4.9.2026). Player and card ids are separate number ranges, so
     * the kind of the defender is stated explicitly.
     */
    private static JsonArray combat(final CombatView combat) {
        final JsonArray a = new JsonArray();
        if (combat == null) {
            return a;
        }
        for (final CardView attacker : combat.getAttackers()) {
            final JsonObject o = new JsonObject();
            o.addProperty("attacker", attacker.getId());
            final GameEntityView defender = combat.getDefender(attacker);
            o.addProperty("defender", id(defender));
            o.addProperty("defenderKind", defender instanceof PlayerView ? "player" : defender instanceof CardView ? "card" : null);
            Iterable<CardView> blockers = combat.getBlockers(attacker);
            if (blockers == null || !blockers.iterator().hasNext()) {
                blockers = combat.getPlannedBlockers(attacker);
            }
            final JsonArray b = new JsonArray();
            if (blockers != null) {
                for (final CardView c : blockers) {
                    b.add(c.getId());
                }
            }
            o.add("blockers", b);
            a.add(o);
        }
        return a;
    }

    static Integer id(final GameEntityView e) {
        return e == null ? null : e.getId();
    }
}

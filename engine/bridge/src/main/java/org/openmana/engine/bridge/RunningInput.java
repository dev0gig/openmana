package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.card.mana.ManaAtom;
import forge.game.Game;
import forge.game.GameEntity;
import forge.game.card.Card;
import forge.game.combat.Combat;
import forge.game.combat.CombatUtil;
import forge.game.player.Player;
import forge.game.player.PlayerView;
import forge.gamemodes.match.input.Input;
import forge.gamemodes.match.input.InputAttack;
import forge.gamemodes.match.input.InputPayMana;
import forge.gamemodes.match.input.InputQueue;
import forge.gamemodes.match.input.InputSelectEntitiesFromList;
import forge.gamemodes.match.input.InputSelectTargets;
import forge.interfaces.IGameController;
import forge.player.PlayerControllerHuman;

/**
 * What Forge's running input for the human seat would take now (protocol 6,
 * prompt 17): a click on a player, floating mana from the pool, and the mana
 * still to pay; and the declaration of attackers in progress (protocol 7,
 * prompt 18): the defender, every defender and why a creature would not be
 * declared. Only asked, never computed: every answer comes from the input
 * itself or from Forge's own check (Forge patches 0007 and 0008 give the
 * inputs the same checks their click runs, without the click's effect).
 *
 * <p>Forge's inputs that react to a player click at all are exactly four
 * (they override {@code onPlayerSelected}): the target selection, the choice
 * of entities from a list, the payment of a cost (life for Phyrexian mana)
 * and the declaration of attackers (a defending player becomes the
 * defender). Any other input ignores a player click.
 */
public final class RunningInput {

    /** WUBRG then colourless, the order of the protocol's letters. */
    private static final byte[] POOL_COLORS = {
        ManaAtom.WHITE, ManaAtom.BLUE, ManaAtom.BLACK, ManaAtom.RED, ManaAtom.GREEN, ManaAtom.COLORLESS,
    };
    private static final String POOL_LETTERS = "WUBRGC";

    /**
     * Engine tests only: whether the running input is asked at all. Off, the
     * state carries none of these answers and taps go to Forge unasked - so a
     * test can replay a game both ways and prove that asking changes nothing
     * (TargetPaymentTest).
     */
    private static volatile boolean asking = true;

    private RunningInput() {
    }

    /** Engine tests only (see {@link #asking}). */
    public static void setAskingForTests(final boolean on) {
        asking = on;
    }

    /** The input Forge waits on for the human seat, or null. */
    static Input current(final IGameController controller) {
        if (controller instanceof PlayerControllerHuman human) {
            final InputQueue queue = human.getInputQueue();
            return queue == null ? null : queue.getInput();
        }
        return null;
    }

    /**
     * Whether a click on this player would do something in the running input
     * now: TRUE / FALSE where Forge's input says so, null while no input runs
     * (or nothing is asked).
     */
    public static Boolean takesPlayer(final IGameController controller, final PlayerView view) {
        final Input input = current(controller);
        if (!asking || input == null || !(controller instanceof PlayerControllerHuman human)) {
            return null;
        }
        final Game game = human.getGame();
        final Player player = game == null || view == null ? null : game.getPlayer(view);
        if (player == null) {
            return Boolean.FALSE;
        }
        try {
            if (input instanceof InputSelectTargets targets) {
                return targets.isSelectablePlayer(player);
            }
            if (input instanceof InputSelectEntitiesFromList<?> list) {
                return list.getValidChoices().contains(player);
            }
            if (input instanceof InputPayMana payment) {
                return payment.isSelectablePlayer(player);
            }
            if (input instanceof InputAttack attack) {
                // Protocol 7: a defending player who is not the defender yet (patch 0008).
                return attack.isSelectablePlayer(player);
            }
        } catch (final RuntimeException e) {
            // Asking must never break the game; a player Forge cannot judge is not offered.
            return Boolean.FALSE;
        }
        // Every other input ignores a player click (InputBase.onPlayerSelected does nothing).
        return Boolean.FALSE;
    }

    /** Whether the player is to be marked selectable in the state (see {@link #takesPlayer}). */
    public static boolean selectable(final IGameController controller, final PlayerView view) {
        return Boolean.TRUE.equals(takesPlayer(controller, view));
    }

    /**
     * The payment in progress as the protocol's Payment, or null when no
     * payment input runs: the mana still to pay as Forge's prompt shows it and
     * the pool's colours Forge would pay with now.
     */
    public static JsonObject payment(final IGameController controller) {
        if (!asking || !(current(controller) instanceof InputPayMana payment)) {
            return null;
        }
        try {
            final JsonObject o = new JsonObject();
            o.addProperty("cost", payment.getRemainingManaCost());
            final StringBuilder pool = new StringBuilder();
            for (int i = 0; i < POOL_COLORS.length; i++) {
                if (payment.canUseManaFromPool(POOL_COLORS[i])) {
                    pool.append(POOL_LETTERS.charAt(i));
                }
            }
            o.addProperty("pool", pool.toString());
            return o;
        } catch (final RuntimeException e) {
            return null;
        }
    }

    /**
     * The declaration of attackers in progress as the protocol's Attack, or
     * null when Forge's attack input does not run (protocol 7, prompt 18):
     * the defender a creature tapped now attacks (Forge's current defender),
     * every defender Forge offers (the combat's, in Forge's order) and the
     * attacking player's creatures on the battlefield that are not attacking
     * and that a tap would not declare - with Forge's reason
     * (CombatUtil.attackRefusal, patch 0008), or "defender" when Forge would
     * let it attack another of the defenders it offers.
     */
    public static JsonObject attack(final IGameController controller) {
        if (!asking || !(current(controller) instanceof InputAttack input) || !(controller instanceof PlayerControllerHuman human)) {
            return null;
        }
        try {
            final Game game = human.getGame();
            final Combat combat = game == null ? null : game.getCombat();
            if (combat == null) {
                return null;
            }
            final GameEntity defender = input.getCurrentDefender();
            final JsonObject o = new JsonObject();
            o.add("defender", defender == null ? com.google.gson.JsonNull.INSTANCE : entity(defender));
            final JsonArray defenders = new JsonArray();
            for (final GameEntity d : combat.getDefenders()) {
                final JsonObject ref = entity(d);
                if (ref != null) {
                    defenders.add(ref);
                }
            }
            o.add("defenders", defenders);
            final JsonArray unavailable = new JsonArray();
            if (defender != null && combat.getAttackingPlayer() != null) {
                for (final Card c : combat.getAttackingPlayer().getCreaturesInPlay()) {
                    if (combat.isAttacking(c)) {
                        continue;
                    }
                    final CombatUtil.AttackRefusal refusal = CombatUtil.attackRefusal(c, defender);
                    if (refusal == null) {
                        continue;
                    }
                    final JsonObject entry = new JsonObject();
                    entry.addProperty("card", c.getId());
                    entry.addProperty("reason", attacksAnother(c, defender, combat) ? Protocol.ATTACK_REFUSAL_DEFENDER : reasonOf(refusal));
                    unavailable.add(entry);
                }
            }
            o.add("unavailable", unavailable);
            return o;
        } catch (final RuntimeException e) {
            // Asking must never break the game.
            return null;
        }
    }

    /** Whether Forge would let the creature attack one of the other defenders it offers. */
    private static boolean attacksAnother(final Card c, final GameEntity defender, final Combat combat) {
        for (final GameEntity other : combat.getDefenders()) {
            if (other != defender && CombatUtil.canAttack(c, other)) {
                return true;
            }
        }
        return false;
    }

    private static String reasonOf(final CombatUtil.AttackRefusal refusal) {
        return switch (refusal) {
            case TAPPED -> Protocol.ATTACK_REFUSAL_TAPPED;
            case SICK -> Protocol.ATTACK_REFUSAL_SICK;
            case PHASED_OUT -> Protocol.ATTACK_REFUSAL_PHASED_OUT;
            case GOADED -> Protocol.ATTACK_REFUSAL_GOADED;
            case CANT_ATTACK -> Protocol.ATTACK_REFUSAL_RESTRICTED;
            case NOT_A_CREATURE -> Protocol.ATTACK_REFUSAL_NOT_CREATURE;
            case TOO_LATE -> Protocol.ATTACK_REFUSAL_TOO_LATE;
        };
    }

    /** A player or a card as the protocol's EntityRef, or null for anything else. */
    private static JsonObject entity(final GameEntity e) {
        final JsonObject o = new JsonObject();
        if (e instanceof Player p) {
            o.addProperty("kind", "player");
            o.addProperty("id", p.getId());
        } else if (e instanceof Card c) {
            o.addProperty("kind", "card");
            o.addProperty("id", c.getId());
        } else {
            return null;
        }
        return o;
    }

    /** The mana-pool colour of a protocol letter (W, U, B, R, G, C), or -1. */
    static byte poolColor(final String letter) {
        final int i = letter == null || letter.length() != 1 ? -1 : POOL_LETTERS.indexOf(letter.charAt(0));
        return i < 0 ? -1 : POOL_COLORS[i];
    }

    /** Whether the running payment would pay with floating mana of this colour now. */
    static boolean takesMana(final IGameController controller, final byte color) {
        if (!asking) {
            // Unasked: Forge's own useMana ignores what it cannot take.
            return color >= 0;
        }
        if (color < 0 || !(current(controller) instanceof InputPayMana payment)) {
            return false;
        }
        try {
            return payment.canUseManaFromPool(color);
        } catch (final RuntimeException e) {
            return false;
        }
    }
}

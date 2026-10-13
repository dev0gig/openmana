package org.openmana.engine.bridge;

import forge.game.card.Card;
import forge.game.player.Player;

/**
 * Protocol 10 (prompt 48): why Forge would not let a player play a land of
 * their hand now - Forge's own check, read only (Player.landPlayRefusal,
 * Forge patch 0010, the very check canPlayLand runs). Shared by the state
 * (VisibleCard.landRefusal) and the engine trace, so the differential tests
 * compare it on the JVM and in WebAssembly.
 *
 * <p>Asked without a particular land ability: listing a card's abilities may
 * create Forge objects (and draw ids from Forge's counters), asking this
 * creates nothing and changes nothing. Forge's own "playable" marker wins
 * (the caller leaves out a card Forge marks playable): it knows permissions
 * - a land played with flash, from another zone - this check does not see.
 * The limit is Forge's: lands played this turn against Forge's maximum, or
 * none at all when Forge lets the player play any number.
 */
public final class LandPlays {

    /** Engine tests only: off = never ask (to prove that asking changes nothing). */
    private static volatile boolean asking = true;

    private LandPlays() {
    }

    /** Engine tests only (see {@link #asking}). */
    public static void setAskingForTests(final boolean on) {
        asking = on;
    }

    /** The protocol's LandRefusal for this card of the player's hand, or null (not a land, or Forge would let them). */
    public static String refusal(final Player player, final Card card) {
        if (!asking || player == null || card == null || !card.isLand()) {
            return null;
        }
        final Player.LandPlayRefusal refusal = player.landPlayRefusal(card, false, null);
        if (refusal == null) {
            return null;
        }
        return switch (refusal) {
            case NOT_YOUR_TURN -> Protocol.LAND_REFUSAL_NOT_YOUR_TURN;
            case TIMING -> Protocol.LAND_REFUSAL_TIMING;
            case NOT_OWNER -> Protocol.LAND_REFUSAL_NOT_OWNER;
            case ZONE -> Protocol.LAND_REFUSAL_ZONE;
            case RESTRICTED -> Protocol.LAND_REFUSAL_RESTRICTED;
            case LIMIT -> Protocol.LAND_REFUSAL_LIMIT;
        };
    }
}

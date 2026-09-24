package org.openmana.engine.trace;

import com.google.gson.JsonArray;
import forge.game.GameEntity;
import forge.game.GameEntityView;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.game.player.Player;
import forge.game.player.PlayerView;
import forge.game.zone.ZoneView;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * How the engine trace names things: numbers and English keys, never Forge's
 * display texts. A game entity is {@code "c<id>"} (card) or {@code "p<id>"}
 * (player), a zone {@code "<ZoneType>:<player id>"}. Forge hands out card and
 * player ids per game in a fixed order, so the same game has the same ids on
 * the JVM and in WebAssembly.
 */
final class TraceRefs {

    private TraceRefs() {
    }

    static Integer id(final GameEntityView e) {
        return e == null ? null : e.getId();
    }

    static Integer id(final GameEntity e) {
        return e == null ? null : e.getId();
    }

    static String entity(final GameEntityView e) {
        if (e == null) {
            return null;
        }
        return (e instanceof PlayerView ? "p" : "c") + e.getId();
    }

    static String entity(final GameEntity e) {
        if (e == null) {
            return null;
        }
        return (e instanceof Player ? "p" : "c") + e.getId();
    }

    static String zone(final ZoneView z) {
        if (z == null || z.zoneType() == null) {
            return null;
        }
        return z.zoneType().name() + ":" + (z.player() == null ? "-" : String.valueOf(z.player().getId()));
    }

    /** Ids of views, ascending: Forge hands some of them over in hash sets, whose order means nothing. */
    static JsonArray sortedIds(final Collection<? extends GameEntityView> views) {
        final List<Integer> ids = new ArrayList<>();
        if (views != null) {
            for (final GameEntityView v : views) {
                if (v != null) {
                    ids.add(v.getId());
                }
            }
        }
        ids.sort(null);
        final JsonArray a = new JsonArray();
        ids.forEach(a::add);
        return a;
    }

    /** Ids of views in Forge's order (lists whose order means something). */
    static JsonArray ids(final Iterable<? extends GameEntityView> views) {
        final JsonArray a = new JsonArray();
        if (views != null) {
            for (final GameEntityView v : views) {
                if (v != null) {
                    a.add(v.getId());
                }
            }
        }
        return a;
    }

    static JsonArray cardIds(final Iterable<Card> cards) {
        final JsonArray a = new JsonArray();
        if (cards != null) {
            for (final Card c : cards) {
                a.add(c.getId());
            }
        }
        return a;
    }

    static boolean isCard(final GameEntityView e) {
        return e instanceof CardView;
    }
}

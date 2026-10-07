package org.openmana.engine.bridge;

import forge.game.GameLogEntry;
import forge.game.GameLogEntryType;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.trackable.TrackableProperty;
import org.testng.annotations.Test;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNull;

/** Actor identity must survive translated/misleading words, and never come from prose. */
public class HistoryTest {
    @Test
    public void actorComesOnlyFromTheStructuredSource() {
        final PlayerView me = new PlayerView(0, null);
        me.set(TrackableProperty.Name, "Spieler");
        final PlayerView opponent = new PlayerView(1, null);
        final CardView source = new CardView(7, null);
        source.set(TrackableProperty.Controller, me);
        assertEquals(BridgeGuiGame.actor(new GameLogEntry(GameLogEntryType.LAND, "Forge-KI spielt etwas", source), me), "me");
        source.set(TrackableProperty.Controller, opponent);
        assertEquals(BridgeGuiGame.actor(new GameLogEntry(GameLogEntryType.STACK_ADD, "Spieler wirkt etwas", source), me), "opponent");
        assertNull(BridgeGuiGame.actor(new GameLogEntry(GameLogEntryType.TURN, "Spieler beginnt seinen Zug", null), me));
        assertNull(BridgeGuiGame.actor(new GameLogEntry(GameLogEntryType.LIFE, null, null), me));
        assertNull(BridgeGuiGame.actor(new GameLogEntry(GameLogEntryType.LAND, "", source), null));
    }
}

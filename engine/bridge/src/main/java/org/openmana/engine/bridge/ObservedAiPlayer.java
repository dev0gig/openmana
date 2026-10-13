package org.openmana.engine.bridge;

import forge.LobbyPlayer;
import forge.ai.LobbyPlayerAi;
import forge.ai.PlayerControllerAi;
import forge.game.Game;
import forge.game.player.Player;
import forge.game.player.PlayerController;
import forge.game.spellability.SpellAbility;

import java.util.List;

/**
 * Forge's AI seat with one addition (protocol 10, prompt 48): right before
 * Forge asks the AI what it plays - a player gets priority, Forge has checked
 * the state-based actions and put the triggers on the stack - the bridge may
 * send the public actions so far and, if the player asked for it, wait until
 * they were looked at ({@link BridgeGuiGame#aiPriority()}).
 *
 * <p>Nothing else changes: the controller is Forge's {@link PlayerControllerAi}
 * with the same profile and settings Forge's {@code GamePlayerUtil.createAiPlayer}
 * gives (the brains, their simulation option, avatar and sleeve); it decides
 * exactly as before, after the observation. Only when the game ended while
 * waiting (the player conceded) the AI is not asked any more and passes.
 */
final class ObservedAiPlayer extends LobbyPlayerAi {

    private Runnable checkpoint = () -> { };

    private ObservedAiPlayer(final String name) {
        super(name, null);
    }

    /** Like GamePlayerUtil.createAiPlayer(name, avatar, sleeve, null, profile). */
    static ObservedAiPlayer create(final String name, final int avatarIndex, final int sleeveIndex, final String profile) {
        final ObservedAiPlayer player = new ObservedAiPlayer(name);
        player.setAiProfile(profile);
        player.setAvatarIndex(avatarIndex);
        player.setSleeveIndex(sleeveIndex);
        return player;
    }

    /** The bridge's stable point before the AI decides. */
    void onPriority(final Runnable checkpoint0) {
        checkpoint = checkpoint0;
    }

    /** As LobbyPlayerAi.createControllerFor (private there): no simulation option. */
    private PlayerControllerAi controllerFor(final Player ai) {
        final PlayerControllerAi controller = new Controller(ai.getGame(), ai, this);
        controller.getAi().setUseSimulation(null);
        return controller;
    }

    @Override
    public PlayerController createMindSlaveController(final Player master, final Player slave) {
        return controllerFor(slave);
    }

    @Override
    public Player createIngamePlayer(final Game game, final int id) {
        final Player ai = new Player(getName(), game, id);
        ai.setFirstController(controllerFor(ai));
        return ai;
    }

    private final class Controller extends PlayerControllerAi {

        Controller(final Game game, final Player p, final LobbyPlayer lp) {
            super(game, p, lp);
        }

        @Override
        public List<SpellAbility> chooseSpellAbilityToPlay() {
            checkpoint.run();
            if (getGame().isGameOver()) {
                return null;
            }
            return super.chooseSpellAbilityToPlay();
        }
    }
}

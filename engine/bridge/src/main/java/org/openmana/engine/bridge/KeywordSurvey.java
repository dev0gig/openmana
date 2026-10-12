package org.openmana.engine.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.StaticData;
import forge.card.CardStateName;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameRules;
import forge.game.GameStage;
import forge.game.GameType;
import forge.game.Match;
import forge.game.card.Card;
import forge.game.card.CardState;
import forge.game.card.CardView;
import forge.game.keyword.KeywordCollectionView;
import forge.game.keyword.KeywordInterface;
import forge.game.keyword.KeywordView;
import forge.game.phase.PhaseType;
import forge.game.player.RegisteredPlayer;
import forge.item.PaperCard;
import forge.player.GamePlayerUtil;
import forge.trackable.TrackableProperty;
import org.openmana.engine.EngineBoot;
import org.openmana.engine.ForgeEngine;
import org.openmana.engine.smoke.AiSmokeMatch;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Every keyword form of every card in Forge's card database, as the bridge
 * sends it (prompt 47): each card made as a game card, each of its states'
 * keywords through {@link StateBuilder#keywords}. JVM only (never reached by
 * the Wasm build); scripts/record-keyword-forms.ts turns the output into the
 * test fixture of the German keyword texts.
 *
 * <pre>
 * java -cp openmana-engine-jvm.jar org.openmana.engine.bridge.KeywordSurvey forge-res.bin out.jsonl
 * </pre>
 *
 * One JSON line per keyword: the bridge's object plus "card" (the card's
 * name in Forge's database). Forge's own console chatter is silenced.
 */
public final class KeywordSurvey {

    private static final int CARDS_PER_GAME = 200;

    private KeywordSurvey() {
    }

    public static void main(final String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("usage: KeywordSurvey <forge-res.bin> <out.jsonl>");
        }
        final Path root = Files.createTempDirectory("openmana-keywords");
        try (InputStream in = Files.newInputStream(Paths.get(args[0]))) {
            EngineBoot.boot(in, root, ForgeEngine.CardLoading.EAGER, ForgeEngine.Language.DE_DE, ForgeEngine.Language.DE_DE);
        }
        final List<PaperCard> cards = new ArrayList<>(StaticData.instance().getCommonCards().getUniqueCards());
        cards.sort(Comparator.comparing(PaperCard::getName));
        final PrintStream out = System.out;
        final PrintStream quiet = new PrintStream(OutputStream.nullOutputStream(), true, StandardCharsets.UTF_8);
        System.setOut(quiet);
        System.setErr(quiet);
        int lines = 0;
        int failed = 0;
        try (PrintWriter writer = new PrintWriter(Files.newBufferedWriter(Paths.get(args[1]), StandardCharsets.UTF_8))) {
            Game game = null;
            int made = 0;
            for (final PaperCard pc : cards) {
                if (made++ % CARDS_PER_GAME == 0) {
                    game = newGame();
                }
                try {
                    final Card card = Card.fromPaperCard(pc, game.getPlayers().get(0));
                    for (final CardStateName name : card.getStates()) {
                        final CardState state = card.getState(name);
                        final List<KeywordView> views = new ArrayList<>();
                        for (final KeywordInterface k : card.getKeywords(state)) {
                            views.add(k.getView());
                        }
                        final CardView.CardStateView view = new CardView(1, null).getCurrentState();
                        view.set(TrackableProperty.Name, state.getName());
                        view.set(TrackableProperty.Keywords, new KeywordCollectionView(views));
                        final JsonArray all = StateBuilder.keywords(view);
                        for (int i = 0; i < all.size(); i++) {
                            final JsonObject o = all.get(i).getAsJsonObject();
                            o.addProperty("card", state.getName());
                            writer.println(o);
                            lines++;
                        }
                    }
                } catch (final RuntimeException e) {
                    failed++;
                }
            }
        } finally {
            System.setOut(out);
            System.setErr(out);
        }
        out.println("OPENMANA-KEYWORDS: cards=" + cards.size() + " keywords=" + lines + " failed=" + failed);
        System.exit(0);
    }

    private static Game newGame() {
        final List<RegisteredPlayer> players = new ArrayList<>();
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe A", 0, 0, null, AiSmokeMatch.AI_PROFILE)));
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe B", 1, 0, null, AiSmokeMatch.AI_PROFILE)));
        final GameRules rules = new GameRules(GameType.Constructed);
        final Game game = new Game(players, rules, new Match(rules, players, "OpenMana keyword survey"));
        game.setAge(GameStage.Play);
        game.getPhaseHandler().devModeSet(PhaseType.MAIN1, game.getPlayers().get(0));
        return game;
    }
}

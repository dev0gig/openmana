package org.openmana.engine.smoke;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.StaticData;
import forge.card.CardDb;
import forge.card.CardEdition;
import forge.card.CardRules;
import forge.card.CardStateName;
import forge.card.ICardFace;
import forge.deck.Deck;
import forge.game.Game;
import forge.game.GameRules;
import forge.game.GameStage;
import forge.game.GameType;
import forge.game.Match;
import forge.game.ability.AbilityFactory;
import forge.game.ability.AbilityUtils;
import forge.game.ability.ApiType;
import forge.game.card.Card;
import forge.game.card.CardFactory;
import forge.game.card.CardState;
import forge.game.keyword.KeywordInterface;
import forge.game.phase.PhaseType;
import forge.game.player.Player;
import forge.game.player.RegisteredPlayer;
import forge.game.replacement.ReplacementEffect;
import forge.game.spellability.SpellAbility;
import forge.game.staticability.StaticAbility;
import forge.game.staticability.StaticAbilityMode;
import forge.game.trigger.Trigger;
import forge.game.zone.ZoneType;
import forge.item.PaperCard;
import forge.item.PaperToken;
import forge.localinstance.properties.ForgeConstants;
import forge.player.GamePlayerUtil;
import forge.util.CardTranslation;
import forge.util.Localizer;
import forge.util.MyRandom;
import org.openmana.engine.EngineDiagnostics;
import org.openmana.engine.ForgeEngine;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TimeZone;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Supplier;

/**
 * Checks that Forge's card scripts load and become game cards, identically on
 * the JVM and in the browser (engine command {@code card-probe}, protocol
 * {@code diagnostics.card-probe}). Engine tests only.
 *
 * <p>What it checks, in this order (the order matters with lazy card loading:
 * nothing before the named-creation cases may load the whole database):
 * <ol>
 *   <li><b>named creation</b>: real Forge effects that bring cards into the game
 *       by name or at random from the whole card pool (conjure a named card,
 *       cast a random copy from a list, name a card and copy it, a token copy
 *       of a random creature with a given mana value, tokens from scripts).
 *       Forge's AI makes every choice; the seed is fixed;</li>
 *   <li><b>representative cards</b> of every card layout (normal, transform,
 *       modal double-faced, split, adventure, flip, meld, …), looked up by
 *       name and turned into game cards;</li>
 *   <li><b>tokens</b>: every token script;</li>
 *   <li><b>the newest editions</b> by release date (also sets that are not
 *       released yet): every card they list;</li>
 *   <li><b>the whole database</b>: every card (and variant card) turned into a
 *       game card, with a fingerprint of the rules and of the game cards.</li>
 * </ol>
 *
 * <p>The report describes cards by structure (layout, faces, types, costs,
 * ability kinds), not by display text, so it does not depend on the UI
 * language. Timings are reported separately and are not part of the
 * fingerprint. Forge alone decides everything; the probe only reads what
 * Forge built (Bible §2). The card names below are test data: nothing in
 * OpenMana may branch on them.
 */
public final class CardProbe {

    public static final String FORMAT = "openmana-card-probe/1";

    /** Fixed seed: Forge's AI choices and random picks repeat on every runtime. */
    static final long SEED = 20_260_924L;

    /** How many of the newest core/expansion editions are checked card by card. */
    static final int NEWEST_EDITIONS = 3;

    /** Game cards created per throwaway game in the whole-database pass (bounds memory). */
    private static final int CARDS_PER_GAME = 2_000;

    /** Category, card name. At least one card of every layout Forge distinguishes. */
    public static final String[][] REPRESENTATIVE = {
            {"normal", "Lightning Bolt"},
            {"normal", "Grizzly Bears"},
            {"normal", "Llanowar Elves"},
            {"normal", "Serra Angel"},
            {"normal", "Sol Ring"},
            {"normal", "Rancor"},
            {"normal", "Counterspell"},
            {"normal", "Wrath of God"},
            {"normal", "Liliana of the Veil"},
            {"normal", "Raise the Alarm"},
            {"basic-land", "Forest"},
            {"transform", "Delver of Secrets"},
            {"transform", "Huntmaster of the Fells"},
            {"modal-double-faced", "Valakut Awakening"},
            {"modal-double-faced", "Shatterskull Smashing"},
            {"battle", "Invasion of Zendikar"},
            {"split", "Fire // Ice"},
            {"split-aftermath", "Cut // Ribbons"},
            {"room", "Bottomless Pool // Locker Room"},
            {"adventure", "Bonecrusher Giant"},
            {"flip", "Bushi Tenderfoot"},
            {"meld", "Bruna, the Fading Light"},
            {"meld", "Gisela, the Broken Blade"},
            {"saga", "History of Benalia"},
            {"class", "Druid Class"},
            {"alchemy-rebalanced", "A-Alrund's Epiphany"},
    };

    /** Token scripts looked at in detail (all token scripts are checked anyway). */
    public static final String[] TOKEN_SAMPLES = {
            "w_1_1_soldier", "c_a_treasure_sac", "c_a_clue_draw", "g_3_3_beast", "c_1_1_a_thopter_flying",
    };

    private CardProbe() {
    }

    public static JsonObject run() {
        EngineDiagnostics.clear();
        MyRandom.setRandom(new Random(SEED));
        final JsonObject millis = new JsonObject();
        final JsonArray failures = new JsonArray();
        final JsonObject result = new JsonObject();
        result.addProperty("format", FORMAT);
        result.addProperty("cardLoading", ForgeEngine.cardLoading().name().toLowerCase());
        result.add("language", language());

        result.add("namedCreation", timed(millis, "namedCreation", () -> namedCreation(failures, millis)));
        result.add("representative", timed(millis, "representative", () -> representative(failures)));
        result.add("tokens", timed(millis, "tokens", () -> tokens(failures)));
        result.add("newestEditions", timed(millis, "newestEditions", () -> newestEditions(failures)));
        result.add("database", timed(millis, "database", () -> database(failures, millis)));

        EngineDiagnostics.forgeErrors().forEach(e -> failures.add("Forge reported an error: " + e));
        final JsonObject sections = new JsonObject();
        for (final String section : new String[]{"namedCreation", "representative", "tokens", "newestEditions", "database"}) {
            sections.addProperty(section, sha256(result.get(section).toString()));
        }
        result.add("sections", sections);
        result.add("failures", failures);
        // Everything but the timings and the language (which is presentation only).
        final JsonObject canonical = result.deepCopy();
        canonical.remove("language");
        result.addProperty("fingerprint", sha256(canonical.toString()));
        result.add("millis", millis);
        return result;
    }

    // --- language ---------------------------------------------------------------

    /**
     * Which language Forge speaks (its messages and card names in prompts and
     * the game log) and a few samples, so a missing translation shows up;
     * plus the runtime's time zone. Not part of the fingerprint.
     */
    private static JsonObject language() {
        final JsonObject o = new JsonObject();
        o.addProperty("selected", CardTranslation.getLanguageSelected());
        final JsonObject messages = new JsonObject();
        for (final String key : new String[]{"lblYes", "lblNo", "lblEndTurn", "lblKeep"}) {
            messages.addProperty(key, Localizer.getInstance().getMessage(key));
        }
        o.add("messages", messages);
        final JsonObject names = new JsonObject();
        for (final String name : new String[]{"Lightning Bolt", "Grizzly Bears", "Counterspell", "Forest"}) {
            names.addProperty(name, CardTranslation.getTranslatedName(name));
        }
        o.add("cardNames", names);
        // Not part of the fingerprint either: where the runtime thinks it is.
        o.addProperty("timeZone", TimeZone.getDefault().getID());
        return o;
    }

    // --- named creation -----------------------------------------------------------

    private static JsonArray namedCreation(final JsonArray failures, final JsonObject millis) {
        final JsonArray cases = new JsonArray();
        cases.add(namedCase(failures, millis, "conjure-by-name", "Emerald Collector", "MakeCard", CardProbe::conjureByName));
        cases.add(namedCase(failures, millis, "random-copy-from-list", "Tibalt the Chaotic", "Play", CardProbe::randomCopyFromList));
        cases.add(namedCase(failures, millis, "name-then-copy", "Garth One-Eye", "NameCard+Play", CardProbe::nameThenCopy));
        cases.add(namedCase(failures, millis, "tokens-from-script", "Raise the Alarm", "Token", CardProbe::tokensFromScript));
        // Last: in lazy mode this loads the whole card database (StaticData.ensureAllCardsLoaded).
        cases.add(namedCase(failures, millis, "random-creature-from-all-cards", "Pool of Vigorous Growth", "CopyPermanent",
                CardProbe::randomCreatureFromAllCards));
        return cases;
    }

    private interface NamedCase {
        void run(Game game, Player player, JsonObject report);
    }

    private static JsonObject namedCase(final JsonArray failures, final JsonObject millis, final String id,
                                        final String source, final String effect, final NamedCase body) {
        final JsonObject report = new JsonObject();
        report.addProperty("id", id);
        report.addProperty("source", source);
        report.addProperty("effect", effect);
        report.addProperty("uniqueCardsKnownBefore", commonCards().getUniqueCards().size());
        final long start = System.nanoTime();
        try {
            final Game game = newGame();
            body.run(game, game.getPlayers().get(0), report);
            report.addProperty("ok", !report.has("problem"));
        } catch (final Throwable t) {
            report.addProperty("ok", false);
            report.addProperty("problem", t.toString());
        }
        millis.addProperty("namedCreation." + id, (System.nanoTime() - start) / 1_000_000L);
        report.addProperty("uniqueCardsKnownAfter", commonCards().getUniqueCards().size());
        if (!report.get("ok").getAsBoolean()) {
            failures.add("named creation " + id + ": " + report.get("problem").getAsString());
        }
        return report;
    }

    /** Emerald Collector: "conjure a card named Mox Emerald into your hand" (MakeCard Name$). */
    private static void conjureByName(final Game game, final Player player, final JsonObject report) {
        final Card host = addCard(game, "Emerald Collector", player, ZoneType.Battlefield);
        report.addProperty("createdLoadedBefore", commonCards().contains("Mox Emerald"));
        resolve(AbilityFactory.getAbility(host.getSVar("TrigConjure"), host), player);
        final List<String> hand = names(player.getCardsIn(ZoneType.Hand));
        report.add("created", toArray(hand));
        expect(report, hand.equals(List.of("Mox Emerald")), "expected Mox Emerald in hand, found " + hand);
    }

    /** Tibalt the Chaotic +1: cast a copy of a random card of a named list (Play AnySupportedCard, RandomCopied). */
    private static void randomCopyFromList(final Game game, final Player player, final JsonObject report) {
        final Card host = addCard(game, "Tibalt the Chaotic", player, ZoneType.Battlefield);
        final List<String> choices = List.of("Ignorant Bliss", "Crack the Earth", "Blazing Volley");
        final JsonObject before = new JsonObject();
        choices.forEach(n -> before.addProperty(n, commonCards().contains(n)));
        report.add("choicesLoadedBefore", before);
        final SpellAbility ability = abilityWithParam(host, ApiType.Play, "AnySupportedCard", "Ignorant Bliss");
        resolve(ability, player);
        final List<String> cast = drainStack(game);
        report.add("created", toArray(cast));
        expect(report, cast.size() == 1 && choices.contains(cast.get(0)), "expected one copy of " + choices + " cast, found " + cast);
    }

    /** Garth One-Eye: choose a name from a list, create a copy of that card, may cast it (NameCard + Play CopyFromChosenName). */
    private static void nameThenCopy(final Game game, final Player player, final JsonObject report) {
        final Card host = addCard(game, "Garth One-Eye", player, ZoneType.Battlefield);
        final List<String> choices = List.of("Disenchant", "Braingeyser", "Terror", "Shivan Dragon", "Regrowth", "Black Lotus");
        final SpellAbility ability = abilityWithParam(host, ApiType.NameCard, "ChooseFromList", "Black Lotus");
        resolve(ability, player);
        final List<String> named = new ArrayList<>(host.getNamedCards());
        report.add("named", toArray(named));
        final List<String> cast = drainStack(game);
        report.add("created", toArray(cast));
        expect(report, named.size() == 1 && choices.contains(named.get(0)), "expected one name of " + choices + ", found " + named);
        expect(report, cast.isEmpty() || cast.equals(named), "the copy cast (" + cast + ") is not the named card " + named);
        if (!named.isEmpty()) {
            report.addProperty("namedCardLoaded", commonCards().contains(named.get(0)));
        }
    }

    /** Raise the Alarm: two 1/1 Soldier tokens from Forge's token scripts. */
    private static void tokensFromScript(final Game game, final Player player, final JsonObject report) {
        final Card spell = addCard(game, "Raise the Alarm", player, ZoneType.Hand);
        resolve(spell.getFirstSpellAbility(), player);
        final List<String> tokens = new ArrayList<>();
        for (final Card c : player.getCardsIn(ZoneType.Battlefield)) {
            if (c.isToken()) {
                tokens.add(c.getName() + " " + c.getNetPower() + "/" + c.getNetToughness());
            }
        }
        report.add("created", toArray(tokens));
        expect(report, tokens.equals(List.of("Soldier Token 1/1", "Soldier Token 1/1")), "expected two 1/1 Soldier tokens, found " + tokens);
    }

    /**
     * Pool of Vigorous Growth with X = 3: a token copy of a random creature card
     * with mana value 3 from all cards Forge knows (CopyPermanent
     * ValidSupportedCopy). With lazy loading Forge first loads every card.
     */
    private static void randomCreatureFromAllCards(final Game game, final Player player, final JsonObject report) {
        final Card host = addCard(game, "Pool of Vigorous Growth", player, ZoneType.Battlefield);
        final SpellAbility ability = abilityWithParam(host, ApiType.CopyPermanent, "ValidSupportedCopy", "Creature");
        ability.setXManaCostPaid(3);
        resolve(ability, player);
        final List<String> created = new ArrayList<>();
        boolean ok = true;
        for (final Card c : player.getCardsIn(ZoneType.Battlefield)) {
            if (c.isToken()) {
                created.add(c.getName());
                ok &= c.isCreature() && c.getCMC() == 3;
            }
        }
        report.add("created", toArray(created));
        expect(report, created.size() == 1 && ok, "expected one creature token with mana value 3, found " + created);
    }

    // --- representative cards -------------------------------------------------------

    private static JsonArray representative(final JsonArray failures) {
        final JsonArray cards = new JsonArray();
        final Game game = newGame();
        final Player owner = game.getPlayers().get(0);
        for (final String[] entry : REPRESENTATIVE) {
            final JsonObject o = new JsonObject();
            o.addProperty("category", entry[0]);
            o.addProperty("request", entry[1]);
            try {
                final PaperCard pc = commonCards().getCard(entry[1]);
                if (pc == null) {
                    o.addProperty("found", false);
                    failures.add("representative card not found: " + entry[1]);
                } else {
                    o.addProperty("found", true);
                    describeRules(o, pc);
                    o.add("game", describeGameCard(Card.fromPaperCard(pc, owner)));
                    if (pc.getRules().isUnsupported()) {
                        failures.add("representative card unsupported by Forge: " + entry[1]);
                    }
                }
            } catch (final Throwable t) {
                o.addProperty("found", o.has("found") && o.get("found").getAsBoolean());
                o.addProperty("problem", t.toString());
                failures.add("representative card " + entry[1] + ": " + t);
            }
            cards.add(o);
        }
        return cards;
    }

    private static void describeRules(final JsonObject o, final PaperCard pc) {
        final CardRules rules = pc.getRules();
        o.addProperty("name", pc.getName());
        o.addProperty("layout", rules.getSplitType().name());
        o.addProperty("unsupported", rules.isUnsupported());
        o.addProperty("printings", commonCards().getAllCards(pc.getName()).size());
        final JsonArray faces = new JsonArray();
        for (final ICardFace face : rules.getAllFaces()) {
            if (face != null) {
                faces.add(describeFace(face));
            }
        }
        o.add("faces", faces);
    }

    private static JsonObject describeFace(final ICardFace face) {
        final JsonObject f = new JsonObject();
        f.addProperty("name", face.getName());
        f.addProperty("type", String.valueOf(face.getType()));
        f.addProperty("cost", String.valueOf(face.getManaCost()));
        addIfPresent(f, "power", face.getPower());
        addIfPresent(f, "toughness", face.getToughness());
        addIfPresent(f, "loyalty", face.getInitialLoyalty());
        addIfPresent(f, "defense", face.getDefense());
        f.addProperty("oracleSha256", sha256(String.valueOf(face.getOracleText())));
        return f;
    }

    /** The game card Forge built: every state (face) with its characteristics and ability kinds. */
    static JsonObject describeGameCard(final Card card) {
        final JsonObject o = new JsonObject();
        o.addProperty("doubleFaced", card.isDoubleFaced());
        o.addProperty("token", card.isToken());
        final JsonArray states = new JsonArray();
        final List<CardStateName> names = new ArrayList<>(card.getStates());
        names.sort(Comparator.comparingInt(Enum::ordinal));
        for (final CardStateName name : names) {
            final CardState state = card.getState(name);
            final JsonObject s = new JsonObject();
            s.addProperty("state", name.name());
            s.addProperty("name", state.getName());
            s.addProperty("type", String.valueOf(state.getType()));
            s.addProperty("cost", String.valueOf(state.getManaCost()));
            s.addProperty("colors", String.valueOf(state.getColor()));
            if (state.getType().isCreature() || state.getBasePower() != 0 || state.getBaseToughness() != 0) {
                s.addProperty("pt", state.getBasePower() + "/" + state.getBaseToughness());
            }
            addIfPresent(s, "loyalty", state.getBaseLoyalty());
            s.add("spellAbilities", toArray(abilityKinds(state)));
            final List<String> triggers = new ArrayList<>();
            for (final Trigger t : state.getTriggers()) {
                triggers.add(String.valueOf(t.getMode()));
            }
            s.add("triggers", toArray(triggers));
            final List<String> statics = new ArrayList<>();
            for (final StaticAbility st : state.getStaticAbilities()) {
                final Set<StaticAbilityMode> modes = new TreeSet<>(st.getMode());
                statics.add(modes.toString());
            }
            s.add("statics", toArray(statics));
            final List<String> replacements = new ArrayList<>();
            for (final ReplacementEffect re : state.getReplacementEffects()) {
                replacements.add(String.valueOf(re.getMode()));
            }
            s.add("replacements", toArray(replacements));
            final List<String> keywords = new ArrayList<>();
            for (final KeywordInterface k : state.getIntrinsicKeywords()) {
                keywords.add(k.getOriginal());
            }
            s.add("keywords", toArray(keywords));
            states.add(s);
        }
        o.add("states", states);
        return o;
    }

    private static List<String> abilityKinds(final CardState state) {
        final List<String> kinds = new ArrayList<>();
        for (final SpellAbility sa : state.getSpellAbilities()) {
            final String role = sa.isSpell() ? "spell" : sa.isManaAbility() ? "mana" : sa.isLandAbility() ? "land" : "ability";
            kinds.add(role + ":" + (sa.getApi() == null ? "-" : sa.getApi().name()));
        }
        return kinds;
    }

    // --- tokens ------------------------------------------------------------------------

    private static JsonObject tokens(final JsonArray failures) {
        final File dir = new File(ForgeConstants.TOKEN_DATA_DIR);
        final String[] files = dir.list((d, name) -> name.endsWith(".txt"));
        final JsonObject o = new JsonObject();
        if (files == null) {
            failures.add("token scripts directory missing: " + dir);
            o.addProperty("scripts", 0);
            return o;
        }
        Arrays.sort(files);
        final MessageDigest digest = newDigest();
        final JsonObject samples = new JsonObject();
        final List<String> sampleNames = List.of(TOKEN_SAMPLES);
        Game game = newGame();
        int built = 0;
        int loaded = 0;
        int abilities = 0;
        final JsonArray problems = new JsonArray();
        for (final String file : files) {
            if (++built % CARDS_PER_GAME == 0) {
                game = newGame();
            }
            final String script = file.substring(0, file.length() - ".txt".length());
            try {
                final PaperToken token = StaticData.instance().getAllTokens().getToken(script);
                if (token == null) {
                    problems.add(script + ": no token");
                    continue;
                }
                final Card card = CardFactory.getCard(token, game.getPlayers().get(0), game);
                final JsonObject described = describeGameCard(card);
                abilities += countAbilities(card);
                digest.update((script + "\t" + described + "\n").getBytes(StandardCharsets.UTF_8));
                if (sampleNames.contains(script)) {
                    samples.add(script, described);
                }
                loaded++;
            } catch (final Throwable t) {
                problems.add(script + ": " + t);
            }
        }
        o.addProperty("scripts", files.length);
        o.addProperty("loaded", loaded);
        o.addProperty("abilities", abilities);
        o.addProperty("sha256", hex(digest.digest()));
        o.add("samples", samples);
        o.add("problems", problems);
        problems.forEach(p -> failures.add("token " + p.getAsString()));
        for (final String sample : TOKEN_SAMPLES) {
            if (!samples.has(sample)) {
                failures.add("token sample missing: " + sample);
            }
        }
        return o;
    }

    // --- newest editions ---------------------------------------------------------------

    private static JsonArray newestEditions(final JsonArray failures) {
        final List<CardEdition> editions = new ArrayList<>();
        for (final CardEdition e : StaticData.instance().getEditions()) {
            if (e.getType() == CardEdition.Type.EXPANSION || e.getType() == CardEdition.Type.CORE) {
                editions.add(e);
            }
        }
        editions.sort(Comparator.comparing(CardEdition::getDate).thenComparing(CardEdition::getCode).reversed());
        // Forge parses edition dates in the runtime's default time zone (on the
        // JVM and in the browser the device's zone); formatting them in the same
        // zone gives the date written in the edition file on every runtime.
        final SimpleDateFormat day = new SimpleDateFormat("yyyy-MM-dd");
        final JsonArray out = new JsonArray();
        for (final CardEdition edition : editions.subList(0, Math.min(NEWEST_EDITIONS, editions.size()))) {
            final JsonObject o = new JsonObject();
            o.addProperty("code", edition.getCode());
            o.addProperty("name", edition.getName());
            o.addProperty("date", day.format(edition.getDate()));
            o.addProperty("type", edition.getType().name());
            final TreeSet<String> names = new TreeSet<>();
            for (final CardEdition.EditionEntry entry : edition.getAllCardsInSet()) {
                names.add(entry.name());
            }
            o.addProperty("entries", edition.getAllCardsInSet().size());
            o.addProperty("distinctCards", names.size());
            final MessageDigest digest = newDigest();
            final JsonArray notImplemented = new JsonArray();
            final JsonArray problems = new JsonArray();
            Game game = newGame();
            int built = 0;
            int loaded = 0;
            int abilities = 0;
            for (final String name : names) {
                if (++built % CARDS_PER_GAME == 0) {
                    game = newGame();
                }
                try {
                    final PaperCard pc = commonCards().getCard(name, edition.getCode());
                    if (pc == null || pc.getRules().isUnsupported()) {
                        notImplemented.add(name);
                        continue;
                    }
                    final Card card = Card.fromPaperCard(pc, game.getPlayers().get(0));
                    abilities += countAbilities(card);
                    digest.update((name + "\t" + pc.getEdition() + "\t" + describeGameCard(card) + "\n").getBytes(StandardCharsets.UTF_8));
                    loaded++;
                } catch (final Throwable t) {
                    problems.add(name + ": " + t);
                }
            }
            o.addProperty("loaded", loaded);
            o.addProperty("abilities", abilities);
            o.addProperty("sha256", hex(digest.digest()));
            o.add("notImplemented", notImplemented);
            o.add("problems", problems);
            problems.forEach(p -> failures.add(edition.getCode() + " card " + p.getAsString()));
            if (loaded == 0) {
                failures.add(edition.getCode() + ": not a single card loads");
            }
            out.add(o);
        }
        if (out.isEmpty()) {
            failures.add("no core or expansion edition found");
        }
        return out;
    }

    // --- whole database ------------------------------------------------------------------

    private static JsonObject database(final JsonArray failures, final JsonObject millis) {
        final long start = System.nanoTime();
        StaticData.instance().ensureAllCardsLoaded();
        millis.addProperty("ensureAllCardsLoaded", (System.nanoTime() - start) / 1_000_000L);

        final JsonObject o = new JsonObject();
        final JsonArray problems = new JsonArray();
        final TreeSet<String> warnings = new TreeSet<>();
        final JsonObject common = databasePass(commonCards(), problems, warnings);
        final JsonObject variants = databasePass(StaticData.instance().getVariantCards(), problems, warnings);
        o.add("cards", common);
        o.add("variantCards", variants);
        final TreeSet<String> codes = new TreeSet<>();
        for (final CardEdition e : StaticData.instance().getEditions()) {
            codes.add(e.getCode());
        }
        o.addProperty("editions", codes.size());
        o.addProperty("editionsSha256", sha256(String.join("\n", codes)));
        o.add("scriptWarnings", toArray(new ArrayList<>(warnings)));
        o.add("problems", problems);
        problems.forEach(p -> failures.add("card " + p.getAsString()));
        return o;
    }

    /**
     * Every card of one database: a fingerprint of the rules (what the scripts
     * say) and of the game cards (what Forge builds from them). Forge's own
     * warnings about broken scripts go to stdout/stderr; they are collected
     * while the cards are built, so they show in the report on every runtime.
     */
    private static JsonObject databasePass(final CardDb db, final JsonArray problems, final TreeSet<String> warnings) {
        final List<PaperCard> cards = new ArrayList<>(db.getUniqueCards());
        cards.sort(Comparator.comparing(PaperCard::getName));
        final MessageDigest rules = newDigest();
        final MessageDigest built = newDigest();
        final Map<String, Integer> layouts = new TreeMap<>();
        int instantiated = 0;
        long abilities = 0;
        long printings = 0;
        final PrintStream out = System.out;
        final PrintStream err = System.err;
        final ByteArrayOutputStream captured = new ByteArrayOutputStream();
        final PrintStream capture = new PrintStream(captured, true, StandardCharsets.UTF_8);
        Game game = newGame();
        int created = 0;
        try {
            System.setOut(capture);
            System.setErr(capture);
            for (final PaperCard pc : cards) {
                if (++created % CARDS_PER_GAME == 0) {
                    game = newGame();
                }
                final CardRules r = pc.getRules();
                final int prints = db.getAllCards(pc.getName()).size();
                printings += prints;
                layouts.merge(r.getSplitType().name(), 1, Integer::sum);
                final StringBuilder line = new StringBuilder(pc.getName()).append('\t').append(r.getSplitType())
                        .append('\t').append(r.isUnsupported()).append('\t').append(prints);
                for (final ICardFace face : r.getAllFaces()) {
                    if (face != null) {
                        line.append('\t').append(describeFace(face));
                    }
                }
                rules.update(line.append('\n').toString().getBytes(StandardCharsets.UTF_8));
                try {
                    final Card card = Card.fromPaperCard(pc, game.getPlayers().get(0));
                    abilities += countAbilities(card);
                    built.update((pc.getName() + "\t" + describeGameCard(card) + "\n").getBytes(StandardCharsets.UTF_8));
                    instantiated++;
                } catch (final Throwable t) {
                    problems.add(pc.getName() + ": " + t);
                }
            }
        } finally {
            System.setOut(out);
            System.setErr(err);
        }
        for (final String line : captured.toString(StandardCharsets.UTF_8).split("\\R")) {
            if (!line.isBlank()) {
                warnings.add(line.strip());
            }
        }
        final JsonObject o = new JsonObject();
        o.addProperty("unique", cards.size());
        o.addProperty("printings", printings);
        o.addProperty("instantiated", instantiated);
        o.addProperty("abilities", abilities);
        final JsonObject layoutCounts = new JsonObject();
        layouts.forEach(layoutCounts::addProperty);
        o.add("layouts", layoutCounts);
        o.addProperty("rulesSha256", hex(rules.digest()));
        o.addProperty("gameCardsSha256", hex(built.digest()));
        return o;
    }

    // --- helpers ---------------------------------------------------------------------------

    private static CardDb commonCards() {
        return StaticData.instance().getCommonCards();
    }

    /** A game between two Forge AI players in the first main phase; nothing runs until asked. */
    private static Game newGame() {
        final List<RegisteredPlayer> players = new ArrayList<>();
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe A", 0, 0, null, AiSmokeMatch.AI_PROFILE)));
        players.add(new RegisteredPlayer(new Deck()).setPlayer(GamePlayerUtil.createAiPlayer("Probe B", 1, 0, null, AiSmokeMatch.AI_PROFILE)));
        final GameRules rules = new GameRules(GameType.Constructed);
        final Match match = new Match(rules, players, "OpenMana card probe");
        final Game game = new Game(players, rules, match);
        game.setAge(GameStage.Play);
        game.getPhaseHandler().devModeSet(PhaseType.MAIN1, game.getPlayers().get(0));
        return game;
    }

    private static Card addCard(final Game game, final String name, final Player owner, final ZoneType zone) {
        final PaperCard pc = commonCards().getCard(name);
        if (pc == null) {
            throw new IllegalStateException("Forge does not know " + name);
        }
        final Card card = Card.fromPaperCard(pc, owner);
        card.setGameTimestamp(game.getNextTimestamp());
        owner.getZone(zone).add(card);
        game.getAction().checkStateEffects(true);
        return card;
    }

    private static SpellAbility abilityWithParam(final Card host, final ApiType api, final String param, final String contains) {
        for (final SpellAbility sa : host.getSpellAbilities()) {
            if (sa.getApi() == api && sa.hasParam(param) && sa.getParam(param).contains(contains)) {
                return sa;
            }
        }
        throw new IllegalStateException(host.getName() + " has no " + api + " ability with " + param + " containing " + contains);
    }

    private static void resolve(final SpellAbility sa, final Player player) {
        sa.setActivatingPlayer(player);
        AbilityUtils.resolve(sa);
        player.getGame().getAction().checkStateEffects(true);
    }

    /** Resolves what Forge put on the stack (copies cast by an effect); returns the names of their sources. */
    private static List<String> drainStack(final Game game) {
        final List<String> cast = new ArrayList<>();
        int guard = 0;
        while (!game.getStack().isEmpty()) {
            if (++guard > 20) {
                throw new IllegalStateException("the stack does not empty");
            }
            cast.add(game.getStack().peekAbility().getHostCard().getName());
            game.getStack().resolveStack();
        }
        return cast;
    }

    private static int countAbilities(final Card card) {
        int n = 0;
        for (final CardStateName name : card.getStates()) {
            final CardState state = card.getState(name);
            n += state.getSpellAbilities().size() + state.getTriggers().size()
                    + state.getStaticAbilities().size() + state.getReplacementEffects().size();
        }
        return n;
    }

    private static List<String> names(final Iterable<Card> cards) {
        final List<String> names = new ArrayList<>();
        cards.forEach(c -> names.add(c.getName()));
        return names;
    }

    private static void expect(final JsonObject report, final boolean condition, final String problem) {
        if (!condition && !report.has("problem")) {
            report.addProperty("problem", problem);
        }
    }

    private static void addIfPresent(final JsonObject o, final String key, final String value) {
        if (value != null && !value.isEmpty()) {
            o.addProperty(key, value);
        }
    }

    private static JsonArray toArray(final List<String> values) {
        final JsonArray a = new JsonArray();
        values.forEach(a::add);
        return a;
    }

    private static <T extends com.google.gson.JsonElement> T timed(final JsonObject millis, final String name, final Supplier<T> section) {
        final long start = System.nanoTime();
        try {
            return section.get();
        } finally {
            millis.addProperty(name, (System.nanoTime() - start) / 1_000_000L);
        }
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (final NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    static String sha256(final String text) {
        return hex(newDigest().digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String hex(final byte[] digest) {
        final StringBuilder hex = new StringBuilder(digest.length * 2);
        for (final byte b : digest) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }
}

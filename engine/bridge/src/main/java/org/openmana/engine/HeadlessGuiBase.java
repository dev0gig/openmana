package org.openmana.engine;

import forge.gamemodes.match.HostedMatch;
import forge.gui.download.GuiDownloadService;
import forge.gui.interfaces.IGuiBase;
import forge.gui.interfaces.IGuiGame;
import forge.item.PaperCard;
import forge.localinstance.skin.FSkinProp;
import forge.localinstance.skin.ISkinImage;
import forge.sound.IAudioClip;
import forge.sound.IAudioMusic;
import forge.util.BuildInfo;
import forge.util.FSerializableFunction;
import forge.util.ImageFetcher;
import org.jupnp.UpnpServiceConfiguration;

import java.io.File;
import java.util.Collection;
import java.util.List;
import java.util.function.Consumer;

/**
 * Forge's environment inside OpenMana: no screen, no sound, no images, no
 * threads. The UI lives in the browser and only ever sees OpenMana's protocol,
 * so everything visual here is intentionally empty.
 *
 * <p>Behavioural reference is Anvil's {@code AnvilGuiBase} (dev0gig/forge,
 * module forge-anvil), with one difference that matters: nothing may start a
 * thread. GraalVM Web Image has exactly one Java thread, so work Forge hands to
 * the "EDT" or to a background task runs directly on the calling thread.
 *
 * <p>{@link #isGuiThread()} must stay {@code false}: Forge's
 * {@code PlayerControllerHuman.useSelectCardsInput()} switches to dialogs when
 * it is {@code true}, and {@code InputSyncronizedBase} asserts it is not on a
 * GUI thread.
 *
 * <p>Anything that is called although it should never be reached during a game
 * fails loudly instead of returning a plausible default.
 */
public final class HeadlessGuiBase implements IGuiBase {

    private final String assetsDir;

    /**
     * @param assetsDir directory that contains Forge's {@code res/} tree,
     *                  with a trailing slash
     */
    public HeadlessGuiBase(final String assetsDir) {
        this.assetsDir = assetsDir.endsWith("/") ? assetsDir : assetsDir + "/";
    }

    private static UnsupportedOperationException notInHeadlessEngine(final String what) {
        return new UnsupportedOperationException("OpenMana engine: '" + what
                + "' is a Forge desktop/mobile UI path and is not available in the headless engine");
    }

    // --- basics --------------------------------------------------------------

    @Override
    public boolean isRunningOnDesktop() {
        // Desktop semantics (like Anvil): Forge then derives its profile
        // directories from user.home instead of the mobile assets layout.
        return true;
    }

    @Override
    public boolean isLibgdxPort() {
        return false;
    }

    @Override
    public String getCurrentVersion() {
        return BuildInfo.getVersionString();
    }

    @Override
    public String getAssetsDir() {
        return assetsDir;
    }

    // --- threads: there is exactly one ---------------------------------------

    @Override
    public void invokeInEdtNow(final Runnable runnable) {
        runnable.run();
    }

    @Override
    public void invokeInEdtLater(final Runnable runnable) {
        runnable.run();
    }

    @Override
    public void invokeInEdtAndWait(final Runnable proc) {
        proc.run();
    }

    @Override
    public void runBackgroundTask(final String message, final Runnable task) {
        // Anvil started a thread here. In the single-threaded engine a new
        // thread would never run, so the task runs now.
        task.run();
    }

    @Override
    public boolean isGuiThread() {
        return false;
    }

    // --- images, skins, sound: owned by the OpenMana UI, not by Forge --------

    @Override
    public ImageFetcher getImageFetcher() {
        return null;
    }

    @Override
    public ISkinImage getSkinIcon(final FSkinProp skinProp) {
        return null;
    }

    @Override
    public ISkinImage getUnskinnedIcon(final String path) {
        return null;
    }

    @Override
    public ISkinImage getCardArt(final PaperCard card, final boolean backFace) {
        return null;
    }

    @Override
    public ISkinImage createLayeredImage(final PaperCard card, final FSkinProp background,
                                         final String overlayFilename, final float opacity) {
        return null;
    }

    @Override
    public void clearImageCache() {
    }

    /** Mana symbols stay as text ({R}, {T}); the UI renders them. */
    @Override
    public String encodeSymbols(final String str, final boolean formatReminderText) {
        return str;
    }

    /** Never 0: Forge takes these modulo. */
    @Override
    public int getAvatarCount() {
        return 1;
    }

    @Override
    public int getSleevesCount() {
        return 1;
    }

    @Override
    public float getScreenScale() {
        return 1f;
    }

    @Override
    public void preventSystemSleep(final boolean preventSleep) {
    }

    @Override
    public boolean isSupportedAudioFormat(final File file) {
        return false;
    }

    @Override
    public IAudioClip createAudioClip(final String filename) {
        return null;
    }

    @Override
    public IAudioMusic createAudioMusic(final String filename) {
        return null;
    }

    @Override
    public void startAltSoundSystem(final String filename, final boolean isSynchronized) {
    }

    // --- Forge's own menus and dialogs outside a match ------------------------

    @Override
    public void download(final GuiDownloadService service, final Consumer<Boolean> callback) {
        throw notInHeadlessEngine("download");
    }

    @Override
    public void copyToClipboard(final String text) {
        throw notInHeadlessEngine("copyToClipboard");
    }

    @Override
    public void browseToUrl(final String url) {
        throw notInHeadlessEngine("browseToUrl");
    }

    @Override
    public void showCardList(final String title, final String message, final List<PaperCard> list) {
        throw notInHeadlessEngine("showCardList");
    }

    @Override
    public boolean showBoxedProduct(final String title, final String message, final List<PaperCard> list) {
        throw notInHeadlessEngine("showBoxedProduct");
    }

    /**
     * Forge reports internal errors here (BugReporter). Forge decides whether
     * the game goes on; the engine records every report so it surfaces in the
     * result and fails the smoke tests instead of vanishing.
     */
    @Override
    public void showBugReportDialog(final String title, final String text, final boolean showExitAppBtn) {
        EngineDiagnostics.recordForgeError(title, text);
    }

    /**
     * Forge's only caller is its achievement system: when a game ends, the
     * human's achievements are updated (FControlGameEventHandler →
     * AchievementCollection.updateAll) and a newly earned one is shown as an
     * image dialog. Achievements belong to Forge's own UIs; the engine drops
     * the dialog. Throwing here (as for the other UI paths) broke the end of
     * a game: Guava's event bus swallowed the exception before Forge called
     * finishGame (found by the Commander fixture of the differential tests,
     * prompt 05).
     */
    @Override
    public void showImageDialog(final ISkinImage image, final String message, final String title) {
        // intentionally empty
    }

    @Override
    public int showOptionDialog(final String message, final String title, final FSkinProp icon,
                                final List<String> options, final int defaultOption) {
        throw notInHeadlessEngine("showOptionDialog: " + title + " / " + message);
    }

    @Override
    public String showInputDialog(final String message, final String title, final FSkinProp icon,
                                  final String initialInput, final List<String> inputOptions,
                                  final boolean isNumeric) {
        throw notInHeadlessEngine("showInputDialog: " + title + " / " + message);
    }

    @Override
    public String showFileDialog(final String title, final String defaultDir) {
        throw notInHeadlessEngine("showFileDialog");
    }

    @Override
    public File getSaveFile(final File defaultFile) {
        throw notInHeadlessEngine("getSaveFile");
    }

    @Override
    public <T> List<T> order(final String title, final String top, final int remainingObjectsMin,
                             final int remainingObjectsMax, final List<T> sourceChoices,
                             final List<T> destChoices) {
        throw notInHeadlessEngine("order: " + title);
    }

    @Override
    public <T> List<T> getChoices(final String message, final int min, final int max,
                                  final Collection<T> choices, final Collection<T> selected,
                                  final FSerializableFunction<T, String> display) {
        throw notInHeadlessEngine("getChoices: " + message);
    }

    @Override
    public PaperCard chooseCard(final String title, final String message, final List<PaperCard> list) {
        throw notInHeadlessEngine("chooseCard: " + title);
    }

    @Override
    public void showSpellShop() {
        throw notInHeadlessEngine("showSpellShop");
    }

    @Override
    public void showBazaar() {
        throw notInHeadlessEngine("showBazaar");
    }

    // --- matches ----------------------------------------------------------------

    /**
     * The engine spike runs AI-only matches through {@code forge.game.Match};
     * a human seat and its {@code IGuiGame} arrive with the bridge (prompt 02).
     */
    @Override
    public IGuiGame getNewGuiGame() {
        throw notInHeadlessEngine("getNewGuiGame");
    }

    @Override
    public HostedMatch hostMatch() {
        return new HostedMatch();
    }

    /** Network play is not part of OpenMana (no UPnP, no server). */
    @Override
    public UpnpServiceConfiguration getUpnpPlatformService() {
        return null;
    }

    @Override
    public boolean hasNetGame() {
        return false;
    }
}

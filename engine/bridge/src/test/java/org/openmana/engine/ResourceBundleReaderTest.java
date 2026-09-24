package org.openmana.engine;

import org.testng.annotations.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertThrows;

public class ResourceBundleReaderTest {

    private static byte[] bundle(final String[][] entries, final boolean trailingGarbage) throws IOException {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        final DataOutputStream out = new DataOutputStream(bytes);
        out.write(ResourceBundleReader.MAGIC);
        out.writeInt(entries.length);
        for (final String[] entry : entries) {
            final byte[] path = entry[0].getBytes(StandardCharsets.UTF_8);
            final byte[] content = entry[1].getBytes(StandardCharsets.UTF_8);
            out.writeShort(path.length);
            out.write(path);
            out.writeInt(content.length);
            out.write(content);
        }
        if (trailingGarbage) {
            out.write(1);
        }
        return bytes.toByteArray();
    }

    @Test
    public void unpacksEveryEntryWithItsPath() throws IOException {
        final Path root = Files.createTempDirectory("omrb-");
        final ResourceBundleReader.Stats stats = ResourceBundleReader.unpack(new ByteArrayInputStream(bundle(new String[][]{
                {"res/cardsfolder/s/shock.txt", "Name:Shock\n"},
                {"res/languages/en-US.properties", "lblOK=OK\n"},
        }, false)), root);
        assertEquals(stats.files, 2);
        assertEquals(Files.readString(root.resolve("res/cardsfolder/s/shock.txt")), "Name:Shock\n");
        assertEquals(Files.readString(root.resolve("res/languages/en-US.properties")), "lblOK=OK\n");
    }

    @Test
    public void rejectsPathsLeavingTheTarget() throws IOException {
        final Path root = Files.createTempDirectory("omrb-");
        assertThrows(IOException.class, () -> ResourceBundleReader.unpack(new ByteArrayInputStream(
                bundle(new String[][]{{"../evil.txt", "x"}}, false)), root));
        assertThrows(IOException.class, () -> ResourceBundleReader.unpack(new ByteArrayInputStream(
                bundle(new String[][]{{"/etc/evil", "x"}}, false)), root));
    }

    @Test
    public void rejectsTruncatedOrOverlongBundles() throws IOException {
        final Path root = Files.createTempDirectory("omrb-");
        final byte[] good = bundle(new String[][]{{"res/a.txt", "abc"}}, false);
        final byte[] truncated = java.util.Arrays.copyOf(good, good.length - 1);
        assertThrows(IOException.class, () -> ResourceBundleReader.unpack(new ByteArrayInputStream(truncated), root));
        assertThrows(IOException.class, () -> ResourceBundleReader.unpack(new ByteArrayInputStream(
                bundle(new String[][]{{"res/a.txt", "abc"}}, true)), root));
        assertThrows(IOException.class, () -> ResourceBundleReader.unpack(new ByteArrayInputStream(
                "NOTABNDL".getBytes(StandardCharsets.US_ASCII)), root));
    }
}

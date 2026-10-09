/*
 * Copyright (C) 2026 OpenMana contributors. GPL-3.0-or-later.
 */
package org.openmana.opentoolchain;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.graalvm.nativeimage.hosted.Feature;

/**
 * Build-time only (Prompt 34, open toolchain): GraalVM CE has no class-level
 * SBOM, so after the points-to analysis this writes every reachable type of
 * the image - the set Oracle GraalVM's class-level SBOM lists - one per line
 * ("class" or "interface", qualified name) to the file named by the builder
 * JVM property openmana.open.reachableTypes. It adds nothing to the image.
 * The builder internals (FeatureImpl, AnalysisUniverse, AnalysisType) are
 * reached by reflection, so this compiles against the public Feature API only;
 * the builder needs -J--add-exports for com.oracle.svm.hosted and
 * com.oracle.graal.pointsto.meta.
 */
public final class ReachableTypesFeature implements Feature {
    @Override
    public void afterAnalysis(AfterAnalysisAccess access) {
        String out = System.getProperty("openmana.open.reachableTypes");
        if (out == null) {
            throw new IllegalStateException("builder property openmana.open.reachableTypes is not set");
        }
        List<String> lines = new ArrayList<>();
        try {
            Object universe = access.getClass().getMethod("getUniverse").invoke(access);
            for (Object type : (Iterable<?>) universe.getClass().getMethod("getTypes").invoke(universe)) {
                if (!(Boolean) type.getClass().getMethod("isReachable").invoke(type)) {
                    continue;
                }
                Class<?> javaClass = (Class<?>) type.getClass().getMethod("getJavaClass").invoke(type);
                if (javaClass.isArray() || javaClass.isPrimitive()) {
                    continue;
                }
                lines.add((javaClass.isInterface() ? "interface " : "class ") + javaClass.getName());
            }
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("cannot read the analysis universe", e);
        }
        if (lines.isEmpty()) {
            throw new IllegalStateException("no reachable types found");
        }
        Collections.sort(lines);
        try {
            Files.write(Path.of(out), lines);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

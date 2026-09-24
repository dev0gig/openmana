package org.openmana.engine.bridge;

import com.google.gson.JsonParser;
import com.google.gson.JsonObject;
import org.testng.annotations.Test;

import java.util.List;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertThrows;

public class AnswersTest {

    private static JsonObject json(final String text) {
        return JsonParser.parseString(text).getAsJsonObject();
    }

    @Test
    public void buttonsMustBeEnabled() throws Exception {
        assertEquals(Answers.button(json("{\"button\":1}"), true, false), 1);
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.button(json("{\"button\":2}"), true, false));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.button(json("{\"button\":3}"), true, true));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.button(json("{}"), true, true));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.button(json("{\"button\":1.5}"), true, true));
    }

    @Test
    public void choicesAreDistinctInRangeAndCounted() throws Exception {
        assertEquals(Answers.choices(json("{\"choices\":[2,1]}"), 3, 1, 2), List.of(2, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.choices(json("{\"choices\":[4]}"), 3, 1, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.choices(json("{\"choices\":[1,1]}"), 3, 1, 3));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.choices(json("{\"choices\":[]}"), 3, 1, 3));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.choices(json("{\"choices\":[1,2,3]}"), 3, 0, 2));
    }

    @Test
    public void optionsMayOnlyBeCancelledWhenAllowed() throws Exception {
        assertEquals(Answers.option(json("{\"option\":0}"), 2, true), 0);
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.option(json("{\"option\":0}"), 2, false));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.option(json("{\"option\":3}"), 2, true));
    }

    @Test
    public void orderIsAFullPermutation() throws Exception {
        assertEquals(Answers.order(json("{\"order\":[3,1,2]}"), 3), List.of(3, 1, 2));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.order(json("{\"order\":[3,1]}"), 3));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.order(json("{\"order\":[1,1,2]}"), 3));
    }

    @Test
    public void dualListOrderRespectsForgesRemainingBounds() throws Exception {
        // scry-like: any number may stay behind (negative maximum)
        assertEquals(Answers.order(json("{\"order\":[]}"), 3, -1, -1), List.of());
        assertEquals(Answers.order(json("{\"order\":[2]}"), 3, -1, -1), List.of(2));
        // exactly one must stay behind
        assertEquals(Answers.order(json("{\"order\":[3,1]}"), 3, 1, 1), List.of(3, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.order(json("{\"order\":[1,2,3]}"), 3, 1, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.order(json("{\"order\":[1]}"), 3, 1, 1));
    }

    @Test
    public void arrangePlacesEveryItemOnceOnAnAllowedSide() throws Exception {
        final Answers.Arrangement a = Answers.arrange(json("{\"top\":[2],\"bottom\":[1,3]}"), 3, true, true);
        assertEquals(a.top, List.of(2));
        assertEquals(a.bottom, List.of(1, 3));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.arrange(json("{\"top\":[1],\"bottom\":[1,2]}"), 2, true, true));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.arrange(json("{\"top\":[1],\"bottom\":[]}"), 2, true, true));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.arrange(json("{\"top\":[],\"bottom\":[1,2]}"), 2, true, false));
    }

    @Test
    public void amountsSumToTheTotalAndRespectTheMinimum() throws Exception {
        assertEquals(Answers.amounts(json("{\"amounts\":[3,1]}"), 2, 4, 1), List.of(3, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.amounts(json("{\"amounts\":[4,0]}"), 2, 4, 1));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.amounts(json("{\"amounts\":[2,1]}"), 2, 4, 0));
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.amounts(json("{\"amounts\":[4]}"), 2, 4, 0));
    }

    @Test
    public void confirmAndValue() throws Exception {
        assertEquals(Answers.yes(json("{\"yes\":false}")), false);
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.yes(json("{\"yes\":\"no\"}")));
        assertEquals(Answers.value(json("{\"value\":\" 7\"}"), true), " 7");
        assertThrows(Answers.InvalidAnswer.class, () -> Answers.value(json("{\"value\":\"seven\"}"), true));
    }
}

import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/product/insights/csv.js";

test("a plain table needs no quoting", () => {
  assert.equal(toCsv({ columns: ["a", "b"], rows: [[1, 2]] }), "a,b\r\n1,2\r\n");
});

test("a field containing a comma is quoted", () => {
  assert.equal(toCsv({ columns: ["x"], rows: [["one, two"]] }), "x\r\n\"one, two\"\r\n");
});

test("an embedded quote is doubled, which is what breaks naive writers", () => {
  assert.equal(toCsv({ columns: ["x"], rows: [['say "hi"']] }), "x\r\n\"say \"\"hi\"\"\"\r\n");
});

test("a newline inside a field is quoted rather than splitting the row", () => {
  const csv = toCsv({ columns: ["x"], rows: [["line one\nline two"]] });
  assert.equal(csv, "x\r\n\"line one\nline two\"\r\n");
});

test("null and undefined become empty cells, not the words null or undefined", () => {
  assert.equal(toCsv({ columns: ["a", "b"], rows: [[null, undefined]] }), "a,b\r\n,\r\n");
});

test("a list cell is joined rather than rendered as an array literal", () => {
  assert.equal(toCsv({ columns: ["models"], rows: [[["a", "b"]]] }), "models\r\na | b\r\n");
});

test("an empty table still emits its header", () => {
  assert.equal(toCsv({ columns: ["a"], rows: [] }), "a\r\n");
});

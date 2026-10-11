import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseGedcom, parseGedcomDate } from '../src/lib/gedcom.ts';
import { buildTimeline } from '../src/lib/story.ts';
import { layoutFamilyTree } from '../src/lib/layout.ts';
import { kinshipLabel } from '../src/lib/relations.ts';

/** A three-generation export exercising the things real files actually do. */
const SAMPLE = `0 HEAD
1 SOUR Geni.com
2 VERS 1.0
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Walter /Hart/
2 GIVN Walter
2 SURN Hart
1 SEX M
1 BIRT
2 DATE 11 JAN 1930
2 PLAC Leeds, England
1 DEAT
2 DATE 28 JUN 2004
1 OCCU Printer
1 NOTE He kept every proof he ever pulled.
2 CONT Three drawers of them.
1 FAMS @F1@
0 @I2@ INDI
1 NAME Rosalind /Hart/
2 GIVN Rosalind
2 SURN Hart
2 NICK Roz
1 NAME Rosalind /Fairweather/
2 TYPE birth
2 SURN Fairweather
1 SEX F
1 BIRT
2 DATE ABT 1934
2 PLAC Leeds, England
1 DEAT
1 RESI
2 DATE 1960
2 PLAC Bradford, England
1 FAMS @F1@
0 @I3@ INDI
1 NAME Joan /Hart/
2 GIVN Joan
1 SEX F
1 BIRT
2 DATE JUL 1959
1 FAMC @F1@
1 FAMS @F2@
0 @I4@ INDI
1 NAME Chidi /Nwosu/
1 SEX M
1 BIRT
2 DATE BET 1955 AND 1958
1 IMMI
2 DATE 1979
2 PLAC Manchester, England
1 FAMS @F2@
0 @I5@ INDI
1 NAME Adaeze /Nwosu/
1 SEX F
1 BIRT
2 DATE 8 SEP 1985
1 FAMC @F2@
0 @I6@ INDI
1 NAME Peter /Hart/
1 SEX M
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 CHIL @I6@
1 MARR
2 DATE 7 APR 1956
2 PLAC Leeds, England
0 @F2@ FAM
1 HUSB @I4@
1 WIFE @I3@
1 CHIL @I5@
1 MARR
2 DATE 21 MAY 1983
1 DIV
2 DATE 2001
0 @F3@ FAM
1 HUSB @I99@
1 CHIL @I5@
0 TRLR
`;

function parsed() {
  const result = parseGedcom(SAMPLE);
  assert.ok(result.ok, 'expected the sample to parse');
  return result;
}

test('GEDCOM dates degrade to whatever precision is recorded', () => {
  assert.equal(parseGedcomDate('11 JAN 1930'), '1930-01-11');
  assert.equal(parseGedcomDate('JUL 1959'), '1959-07');
  assert.equal(parseGedcomDate('1987'), '1987');
  assert.equal(parseGedcomDate('ABT 1934'), '1934');
  assert.equal(parseGedcomDate('EST 1900'), '1900');
  assert.equal(parseGedcomDate('BEF 12 MAR 1910'), '1910-03-12');
  assert.equal(parseGedcomDate('BET 1955 AND 1958'), '1955');
  assert.equal(parseGedcomDate('@#DGREGORIAN@ 5 JUL 1987'), '1987-07-05');
  assert.equal(parseGedcomDate(''), undefined);
  assert.equal(parseGedcomDate('sometime in the war'), undefined);
});

test('a non-GEDCOM file is refused rather than half-parsed', () => {
  assert.deepEqual(parseGedcom('{"people":{}}'), {
    ok: false,
    error: 'That file does not look like a GEDCOM export.',
  });
});

test('a GEDCOM with no people is refused', () => {
  const result = parseGedcom('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR\n');
  assert.equal(result.ok, false);
});

test('individuals carry across with their names, dates, places and work', () => {
  const { tree } = parsed();
  const walter = tree.people.g_I1;
  assert.equal(walter.firstName, 'Walter');
  assert.equal(walter.lastName, 'Hart');
  assert.equal(walter.gender, 'male');
  assert.equal(walter.birthDate, '1930-01-11');
  assert.equal(walter.birthPlace, 'Leeds, England');
  assert.equal(walter.deathDate, '2004-06-28');
  assert.equal(walter.occupation, 'Printer');
  assert.match(walter.bio ?? '', /every proof he ever pulled/);
  assert.match(walter.bio ?? '', /Three drawers/, 'CONT should continue the note');
});

test('a name with no slashes still yields a first name', () => {
  const result = parseGedcom('0 HEAD\n1 GEDC\n0 @I1@ INDI\n1 NAME Mononymous\n0 TRLR\n');
  assert.ok(result.ok);
  assert.equal(result.tree.people.g_I1.firstName, 'Mononymous');
  assert.equal(result.tree.people.g_I1.lastName, undefined);
});

test('a birth-type name becomes the née surname, and NICK the nickname', () => {
  const { tree } = parsed();
  assert.equal(tree.people.g_I2.lastName, 'Hart');
  assert.equal(tree.people.g_I2.birthName, 'Fairweather');
  assert.equal(tree.people.g_I2.nickname, 'Roz');
});

test('a death with no date still marks somebody as deceased', () => {
  const { tree } = parsed();
  assert.equal(tree.people.g_I2.deceased, true);
  assert.equal(tree.people.g_I2.deathDate, undefined);
  assert.equal(tree.people.g_I1.deceased, true);
  assert.equal(tree.people.g_I3.deceased, false);
});

test('children are linked to both parents', () => {
  const { tree } = parsed();
  assert.deepEqual(tree.people.g_I3.parentIds.sort(), ['g_I1', 'g_I2']);
  assert.deepEqual(tree.people.g_I5.parentIds.sort(), ['g_I3', 'g_I4']);
});

test('spouses are linked symmetrically and the union records its status', () => {
  const { tree } = parsed();
  assert.deepEqual(tree.people.g_I1.partnerIds, ['g_I2']);
  assert.deepEqual(tree.people.g_I2.partnerIds, ['g_I1']);

  const married = tree.unions['g_I1~g_I2'];
  assert.equal(married.status, 'widowed', 'a spouse has died');
  assert.equal(married.since, '1956-04-07');

  const divorced = tree.unions['g_I3~g_I4'];
  assert.equal(divorced.status, 'divorced');
  assert.equal(divorced.until, '2001');
});

test('a marriage becomes a moment in both partners’ lives', () => {
  const { tree } = parsed();
  const walter = buildTimeline(tree.people.g_I1).map((e) => e.title);
  const rosalind = buildTimeline(tree.people.g_I2).map((e) => e.title);
  assert.ok(walter.includes('Married Rosalind Hart'));
  assert.ok(rosalind.includes('Married Walter Hart'));
});

test('individual events become dated moments with their place', () => {
  const { tree } = parsed();
  const rosalind = buildTimeline(tree.people.g_I2);
  const resi = rosalind.find((e) => e.title.startsWith('Lived in'));
  assert.equal(resi?.title, 'Lived in Bradford, England');
  assert.equal(resi?.date, '1960');

  const chidi = buildTimeline(tree.people.g_I4);
  assert.ok(chidi.some((e) => e.title === 'Immigrated to Manchester, England'));
});

test('a family naming somebody absent from the file is reported, not fatal', () => {
  const { summary, tree } = parsed();
  assert.equal(summary.people, 6);
  assert.ok(summary.warnings.some((w) => /not in the file/.test(w)));
  // The dangling husband in F3 must not leave a phantom parent behind.
  assert.ok(!tree.people.g_I5.parentIds.includes('g_I99'));
  assert.ok(!tree.people.g_I99);
});

test('nobody ends up with more than two parents', () => {
  const { tree } = parsed();
  for (const person of Object.values(tree.people)) {
    assert.ok(person.parentIds.length <= 2, `${person.firstName} has ${person.parentIds.length} parents`);
  }
});

test('the tree is named after the commonest surname', () => {
  assert.equal(parsed().tree.name, 'The Hart Family');
});

test('the summary counts what was actually recovered', () => {
  const { summary } = parsed();
  assert.equal(summary.source, 'Geni.com');
  assert.equal(summary.families, 3);
  assert.equal(summary.couples, 2);
  assert.equal(summary.withBirthDate, 5);
  assert.equal(summary.withPlace, 2);
  assert.ok(summary.events >= 6);
});

test('an imported tree lays out and names relationships like any other', () => {
  const { tree } = parsed();
  const people = Object.values(tree.people);
  const layout = layoutFamilyTree(people, { unions: tree.unions });
  assert.equal(layout.nodes.length, 6);
  assert.equal(layout.generationRows.length, 3);
  assert.equal(kinshipLabel(tree.people, 'g_I5', 'g_I1'), 'grandfather');
  assert.equal(kinshipLabel(tree.people, 'g_I5', 'g_I6'), 'uncle');
});

test('CRLF line endings and a byte-order mark are tolerated', () => {
  const result = parseGedcom('﻿' + SAMPLE.replace(/\n/g, '\r\n'));
  assert.ok(result.ok);
  assert.equal(result.summary.people, 6);
});

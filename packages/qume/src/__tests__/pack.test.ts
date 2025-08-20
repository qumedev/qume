import assert from 'assert';
import { GraphPack, GraphPackEntry } from '../internal/GraphPack';

// Import your Pack and GraphPackEntry classes here
// import { Pack, GraphPackEntry } from './your-file-name';

describe('Pack', () => {
  let pack: GraphPack<string, string>;

  beforeEach(() => {
    pack = new GraphPack<string, string>();
  });

  it('should add entries with correct depth', () => {
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child", Date.now() + 1000, "key2");
    const entry3 = new GraphPackEntry("3", "2", "Grandchild", Date.now() + 2000, "key3");

    pack.addEntry(entry1);
    pack.addEntry(entry2);
    pack.addEntry(entry3);

    assert.strictEqual(pack.getEntry("1")!.depth, 0);
    assert.strictEqual(pack.getEntry("2")!.depth, 1);
    assert.strictEqual(pack.getEntry("3")!.depth, 2);
  });

  it('should traverse entries in correct depth-first order', () => {
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child1", Date.now() + 1000, "key2");
    const entry3 = new GraphPackEntry("3", "1", "Child2", Date.now() + 2000, "key3");
    const entry4 = new GraphPackEntry("4", "2", "Grandchild", Date.now() + 3000, "key4");

    pack.addEntry(entry1);
    pack.addEntry(entry2);
    pack.addEntry(entry3);
    pack.addEntry(entry4);

    const traversed = pack.traverseByDepth();
    assert.deepStrictEqual(traversed.map(e => e.id), ["1", "2", "3", "4"]);
  });

  it('should handle multiple root entries', () => {
    const entry1 = new GraphPackEntry("1", null, "Root1", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", null, "Root2", Date.now() + 1000, "key2");

    pack.addEntry(entry1);
    pack.addEntry(entry2);

    const traversed = pack.traverseByDepth();
    assert.strictEqual(traversed.length, 2);
    assert.strictEqual(traversed[0].depth, 0);
    assert.strictEqual(traversed[1].depth, 0);
  });

  it('should merge packs correctly', () => {
    const pack1 = new GraphPack<string, string>();
    const pack2 = new GraphPack<string, string>();

    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child in Pack1", Date.now() + 1000, "key2");
    const entry3 = new GraphPackEntry("3", "1", "Child in Pack2", Date.now() + 2000, "key3");

    pack1.addEntry(entry1);
    pack1.addEntry(entry2);

    pack2.addEntry(entry1); // Same root in both packs
    pack2.addEntry(entry3);

    pack1.merge(pack2);

    const traversed = pack1.traverseByDepth();
    assert.strictEqual(traversed.length, 3);
    assert.deepStrictEqual(traversed.map((e: any) => e.id), ["1", "2", "3"]);
  });


  it('should handle circular references gracefully', () => {
    const pack = new GraphPack<string, string>();
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child", Date.now() + 1000, "key2");

    pack.addEntry(entry1);
    pack.addEntry(entry2);

    // This should throw an error because it would create a circular reference
    assert.throws(() => {
      const entry3 = new GraphPackEntry("1", "2", "Circular", Date.now() + 2000, "key3");
      pack.addEntry(entry3);
    }, Error);

    // This should also throw an error (trying to add an entry with an existing id)
    assert.throws(() => {
      const entry4 = new GraphPackEntry("1", null, "Duplicate ID", Date.now() + 3000, "key4");
      pack.addEntry(entry4);
    }, Error);
  });

  it('should retrieve entries by depth range correctly', () => {
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child1", Date.now() + 1000, "key2");
    const entry3 = new GraphPackEntry("3", "1", "Child2", Date.now() + 2000, "key3");
    const entry4 = new GraphPackEntry("4", "2", "Grandchild1", Date.now() + 3000, "key4");
    const entry5 = new GraphPackEntry("5", "2", "Grandchild2", Date.now() + 4000, "key5");

    pack.addEntry(entry1);
    pack.addEntry(entry2);
    pack.addEntry(entry3);
    pack.addEntry(entry4);
    pack.addEntry(entry5);

    const depthRange = pack.getEntriesByDepthRange(1, 2);
    assert.strictEqual(depthRange.length, 4);
    assert.deepStrictEqual(depthRange.map(e => e.id), ["2", "3", "4", "5"]);
  });

  it('should handle out-of-order entry addition', () => {
    const entry2 = new GraphPackEntry("2", "1", "Child", Date.now() + 1000, "key2");
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");

    // Adding child before parent
    assert.throws(() => {
      pack.addEntry(entry2);
    }, Error);

    // Now add in correct order
    pack.addEntry(entry1);
    pack.addEntry(entry2);

    assert.strictEqual(pack.getEntry("1")!.depth, 0);
    assert.strictEqual(pack.getEntry("2")!.depth, 1);
  });

  it('should maintain correct order with same-depth, different timestamp entries', () => {
    const entry1 = new GraphPackEntry("1", null, "Root", Date.now(), "key1");
    const entry2 = new GraphPackEntry("2", "1", "Child1", Date.now() + 1000, "key2");
    const entry3 = new GraphPackEntry("3", "1", "Child2", Date.now() + 500, "key3"); // Earlier timestamp than entry2

    pack.addEntry(entry1);
    pack.addEntry(entry2);
    pack.addEntry(entry3);

    const traversed = pack.traverseByDepth();
    assert.deepStrictEqual(traversed.map(e => e.id), ["1", "3", "2"]); // entry3 should come before entry2
  });
});

// Run the tests (in a real setup, you'd use a test runner like Jest or Mocha)

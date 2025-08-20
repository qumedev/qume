export class GraphPackEntry<K, A> {
  id: string;
  parentId: string | null;
  content: A;
  timestamp: number;
  depth: number;
  key: K;

  constructor(id: string, parentId: string | null, content: A, timestamp: number, key: K) {
    this.id = id;
    this.parentId = parentId;
    this.content = content;
    this.timestamp = timestamp;
    this.depth = 0; // Will be set properly when added to the GraphPack
    this.key = key;
  }
}

export class GraphPack<K, A> {
  private entries: Map<string, GraphPackEntry<K, A>> = new Map();
  private childrenMap: Map<string, Set<string>> = new Map();
  private depthMap: Map<number, Set<string>> = new Map();
  private maxDepth: number = -1;


  addEntry(entry: GraphPackEntry<K, A>): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Entry with id ${entry.id} already exists`);
    }

    if (entry.parentId) {
      const parentEntry = this.entries.get(entry.parentId);
      if (parentEntry) {
        if (this.wouldCreateCircularReference(entry.id, entry.parentId)) {
          throw new Error(`Adding entry ${entry.id} would create a circular reference`);
        }
        entry.depth = parentEntry.depth + 1;
      } else {
        throw new Error(`Parent entry with id ${entry.parentId} not found`);
      }
    } else {
      entry.depth = 0; // Root entries have depth 0
    }

    this.entries.set(entry.id, entry);

    // Update childrenMap
    if (entry.parentId) {
      if (!this.childrenMap.has(entry.parentId)) {
        this.childrenMap.set(entry.parentId, new Set());
      }
      this.childrenMap.get(entry.parentId)!.add(entry.id);
    }

    // Update depthMap
    if (!this.depthMap.has(entry.depth)) {
      this.depthMap.set(entry.depth, new Set());
    }
    this.depthMap.get(entry.depth)!.add(entry.id);

    // Update maxDepth
    this.maxDepth = Math.max(this.maxDepth, entry.depth);
  }

  private wouldCreateCircularReference(newEntryId: string, parentId: string): boolean {
    let currentId: string | null = parentId;
    while (currentId !== null) {
      if (currentId === newEntryId) {
        return true;
      }
      const currentEntry = this.entries.get(currentId);
      if (!currentEntry) {
        break;
      }
      currentId = currentEntry.parentId;
    }
    return false;
  }

  getEntry(id: string): GraphPackEntry<K, A> | undefined {
    return this.entries.get(id);
  }

  getChildren(id: string): GraphPackEntry<K, A>[] {
    const childrenIds = this.childrenMap.get(id) || new Set();
    return Array.from(childrenIds).map(childId => this.entries.get(childId)!);
  }

  merge(other: GraphPack<K, A>): void {
    // Sort other's entries by depth to ensure parents are added before children
    const sortedEntries = Array.from(other.entries.values()).sort((a, b) => a.depth - b.depth);
    for (const entry of sortedEntries) {
      if (!this.entries.has(entry.id)) {
        this.addEntry(entry);
      }
    }
  }

  traverseByDepth(): GraphPackEntry<K, A>[] {
    const result: GraphPackEntry<K, A>[] = [];
    for (let depth = 0; depth <= this.maxDepth; depth++) {
      const entriesAtDepth = this.depthMap.get(depth) || new Set();
      const sortedEntries = Array.from(entriesAtDepth)
        .map(id => this.entries.get(id)!)
        .sort((a, b) => a.timestamp - b.timestamp);
      result.push(...sortedEntries);
    }
    return result;
  }

  getEntriesByDepthRange(startDepth: number, endDepth: number): GraphPackEntry<K, A>[] {
    const result: GraphPackEntry<K, A>[] = [];
    for (let depth = startDepth; depth <= endDepth && depth <= this.maxDepth; depth++) {
      const entriesAtDepth = this.depthMap.get(depth) || new Set();
      const sortedEntries = Array.from(entriesAtDepth)
        .map(id => this.entries.get(id)!)
        .sort((a, b) => a.timestamp - b.timestamp);
      result.push(...sortedEntries);
    }
    return result;
  }
}

// // Example usage
// const pack = new GraphPack<string, string>();
//
// const entry1 = new GraphPackEntry("1", null, "Hello", Date.now(), "key1");
// pack.addEntry(entry1);
//
// const entry2 = new GraphPackEntry("2", "1", "World", Date.now() + 1000, "key2");
// pack.addEntry(entry2);
//
// const entry3 = new GraphPackEntry("3", "1", "Matrix", Date.now() + 2000, "key3");
// pack.addEntry(entry3);
//
// const entry4 = new GraphPackEntry("4", "2", "Inspired", Date.now() + 3000, "key4");
// pack.addEntry(entry4);
//
// console.log("Entries in order:");
// const orderedEntries = pack.traverseByDepth();
// orderedEntries.forEach(entry => console.log(`${entry.id}: ${entry.content} (Depth: ${entry.depth}, Key: ${entry.key})`));
//
// // Merging example
// const otherPack = new GraphPack<string, string>();
// const entry5 = new GraphPackEntry("5", "1", "From Other GraphPack", Date.now() + 4000, "key5");
// otherPack.addEntry(entry5);
//
// pack.merge(otherPack);
//
// console.log("\nEntries after merge:");
// const mergedOrderedEntries = pack.traverseByDepth();
// mergedOrderedEntries.forEach(entry => console.log(`${entry.id}: ${entry.content} (Depth: ${entry.depth}, Key: ${entry.key})`));
//
// console.log("\nEntries at depth 1:");
// const entriesAtDepth1 = pack.getEntriesByDepthRange(1, 1);
// entriesAtDepth1.forEach(entry => console.log(`${entry.id}: ${entry.content} (Depth: ${entry.depth}, Key: ${entry.key})`));

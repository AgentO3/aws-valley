// BDR-012 fixture (risk R8, edge case E8): an async onEnter that rejects, and an onTick that throws
// on each frame. The engine must log the onTick error one time only.
export default {
  async onEnter() {
    await Promise.resolve();
    throw new Error('async enter broken on purpose');
  },
  onTick() {
    throw new Error('tick broken on purpose');
  }
};

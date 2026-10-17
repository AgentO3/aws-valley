// BDR-011 fixture: the door to vault/gold is locked. The rules also read a "score" key, which only
// the arcade writes, so the vault must read null (BDR-011 Scenario 5).
export default {
  onEnter(ctx) {
    ctx.say('score: ' + JSON.stringify(ctx.store.get('score')));
  },
  canEnter(ctx, door) {
    if (door.id === 'vault/gold') {
      ctx.say('The door is locked');
      return false;
    }
    return true;
  }
};
